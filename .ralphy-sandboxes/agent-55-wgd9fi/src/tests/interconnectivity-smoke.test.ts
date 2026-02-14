/**
 * End-to-End Interconnectivity Smoke Test
 *
 * Verifies that key module interconnections work correctly:
 * 1. Create order → inventory decremented
 * 2. Create customer → appears in customer list, selectable in order creation
 * 3. Create product → appears in menu builder product list
 * 4. Complete delivery → order status updated
 *
 * Uses in-memory simulation (same pattern as order-inventory-flow.test.ts)
 * to validate business logic without a live Supabase connection.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// Types — mirror the real domain models
// ============================================================================

interface Product {
  id: string;
  tenant_id: string;
  name: string;
  sku: string;
  available_quantity: number;
  stock_quantity: number;
  is_active: boolean;
  unit_price: number;
  updated_at: string;
}

interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string;
  contact_type: 'retail' | 'wholesale';
  total_orders: number;
  lifetime_value: number;
  created_at: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_type: 'retail' | 'wholesale' | 'menu';
  status: 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  total_amount: number;
  order_number: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

interface MenuProduct {
  product_id: string;
  product_name: string;
  custom_price: number | null;
  is_available: boolean;
}

interface Menu {
  id: string;
  tenant_id: string;
  name: string;
  status: 'draft' | 'active' | 'burned';
  products: MenuProduct[];
  created_at: string;
}

type DeliveryStatus = 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

interface Delivery {
  id: string;
  tenant_id: string;
  order_id: string;
  courier_id: string | null;
  status: DeliveryStatus;
  eta_minutes: number | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// In-Memory Platform Simulation
// ============================================================================

/**
 * Simulates the FloraIQ multi-tenant platform.
 * All operations enforce tenant_id filtering, mirroring RLS policies.
 */
class FloraIQPlatform {
  products: Map<string, Product> = new Map();
  customers: Map<string, Customer> = new Map();
  orders: Map<string, Order> = new Map();
  menus: Map<string, Menu> = new Map();
  deliveries: Map<string, Delivery> = new Map();

  // --- Products ---

  createProduct(product: Product): Product {
    this.products.set(product.id, { ...product });
    return { ...product };
  }

  getProduct(id: string, tenantId: string): Product | undefined {
    const product = this.products.get(id);
    if (!product || product.tenant_id !== tenantId) return undefined;
    return { ...product };
  }

  getActiveProducts(tenantId: string): Product[] {
    return Array.from(this.products.values())
      .filter(p => p.tenant_id === tenantId && p.is_active)
      .map(p => ({ ...p }));
  }

  // --- Customers ---

  createCustomer(customer: Customer): Customer {
    this.customers.set(customer.id, { ...customer });
    return { ...customer };
  }

  getCustomers(tenantId: string): Customer[] {
    return Array.from(this.customers.values())
      .filter(c => c.tenant_id === tenantId)
      .map(c => ({ ...c }));
  }

  getCustomerById(id: string, tenantId: string): Customer | undefined {
    const customer = this.customers.get(id);
    if (!customer || customer.tenant_id !== tenantId) return undefined;
    return { ...customer };
  }

  /**
   * Returns customers selectable in order creation for a given tenant.
   * Mirrors the customer dropdown in the admin order form.
   */
  getSelectableCustomers(tenantId: string): Array<{ id: string; name: string; email: string }> {
    return this.getCustomers(tenantId).map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
    }));
  }

  // --- Orders ---

  /**
   * Creates an order and, if confirmed, decrements inventory.
   * Simulates the create_unified_order RPC + DB trigger behavior.
   */
  createOrder(
    order: Omit<Order, 'items' | 'created_at' | 'updated_at'>,
    items: Omit<OrderItem, 'id' | 'order_id'>[]
  ): { success: boolean; order?: Order; error?: string } {
    // Validate customer belongs to tenant if specified
    if (order.customer_id) {
      const customer = this.getCustomerById(order.customer_id, order.tenant_id);
      if (!customer) {
        return { success: false, error: 'Customer not found for tenant' };
      }
    }

    const now = new Date().toISOString();
    const orderItems: OrderItem[] = items.map((item, i) => ({
      ...item,
      id: `item-${order.id}-${i}`,
      order_id: order.id,
    }));

    const fullOrder: Order = {
      ...order,
      items: orderItems,
      created_at: now,
      updated_at: now,
    };

    this.orders.set(order.id, fullOrder);

    // Update customer order count
    if (order.customer_id) {
      const customer = this.customers.get(order.customer_id);
      if (customer) {
        customer.total_orders += 1;
        customer.lifetime_value += order.total_amount;
      }
    }

    return { success: true, order: { ...fullOrder } };
  }

  /**
   * Confirms an order and decrements product available_quantity.
   * Simulates the update_inventory_from_regular_order() DB trigger.
   */
  confirmOrder(orderId: string, tenantId: string): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order || order.tenant_id !== tenantId) {
      return { success: false, error: 'Order not found' };
    }
    if (order.status !== 'pending') {
      return { success: false, error: `Cannot confirm order with status: ${order.status}` };
    }

    order.status = 'confirmed';
    order.updated_at = new Date().toISOString();

    // Trigger: decrement inventory
    for (const item of order.items) {
      const product = this.products.get(item.product_id);
      if (product && product.tenant_id === tenantId) {
        product.available_quantity = Math.max(0, product.available_quantity - item.quantity);
        product.updated_at = new Date().toISOString();
      }
    }

    return { success: true };
  }

  getOrder(orderId: string, tenantId: string): Order | undefined {
    const order = this.orders.get(orderId);
    if (!order || order.tenant_id !== tenantId) return undefined;
    return { ...order, items: order.items.map(i => ({ ...i })) };
  }

  // --- Menus ---

  /**
   * Gets products available for the menu builder.
   * Only active products with stock for the given tenant.
   */
  getMenuBuilderProducts(tenantId: string): Array<{
    id: string;
    name: string;
    sku: string;
    available_quantity: number;
    unit_price: number;
  }> {
    return this.getActiveProducts(tenantId)
      .filter(p => p.available_quantity > 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        available_quantity: p.available_quantity,
        unit_price: p.unit_price,
      }));
  }

  createMenu(menu: Omit<Menu, 'created_at'>): {
    success: boolean;
    menu?: Menu;
    error?: string;
  } {
    // Validate all products belong to tenant and are active
    for (const mp of menu.products) {
      const product = this.getProduct(mp.product_id, menu.tenant_id);
      if (!product) {
        return { success: false, error: `Product ${mp.product_id} not found for tenant` };
      }
      if (!product.is_active) {
        return { success: false, error: `Product ${mp.product_id} is not active` };
      }
    }

    const fullMenu: Menu = {
      ...menu,
      created_at: new Date().toISOString(),
    };
    this.menus.set(menu.id, fullMenu);
    return { success: true, menu: { ...fullMenu } };
  }

  // --- Deliveries ---

  createDelivery(
    delivery: Omit<Delivery, 'created_at' | 'updated_at' | 'delivered_at'>
  ): { success: boolean; delivery?: Delivery; error?: string } {
    const order = this.orders.get(delivery.order_id);
    if (!order || order.tenant_id !== delivery.tenant_id) {
      return { success: false, error: 'Order not found for tenant' };
    }

    const now = new Date().toISOString();
    const fullDelivery: Delivery = {
      ...delivery,
      delivered_at: null,
      created_at: now,
      updated_at: now,
    };
    this.deliveries.set(delivery.id, fullDelivery);
    return { success: true, delivery: { ...fullDelivery } };
  }

  /**
   * Updates delivery status and syncs to order status.
   * Simulates the useDeliveryOrderSync hook behavior:
   *   delivery in_transit  → order out_for_delivery
   *   delivery delivered   → order delivered
   *   delivery cancelled   → order cancelled
   */
  updateDeliveryStatus(
    deliveryId: string,
    tenantId: string,
    newStatus: DeliveryStatus
  ): { success: boolean; orderStatusUpdated?: boolean; error?: string } {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.tenant_id !== tenantId) {
      return { success: false, error: 'Delivery not found' };
    }

    delivery.status = newStatus;
    delivery.updated_at = new Date().toISOString();

    if (newStatus === 'delivered') {
      delivery.delivered_at = new Date().toISOString();
    }

    // Sync delivery status to order status
    const order = this.orders.get(delivery.order_id);
    if (!order || order.tenant_id !== tenantId) {
      return { success: true, orderStatusUpdated: false };
    }

    const statusMap: Partial<Record<DeliveryStatus, Order['status']>> = {
      in_transit: 'out_for_delivery',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };

    const mappedOrderStatus = statusMap[newStatus];
    if (mappedOrderStatus) {
      order.status = mappedOrderStatus;
      order.updated_at = new Date().toISOString();
      return { success: true, orderStatusUpdated: true };
    }

    return { success: true, orderStatusUpdated: false };
  }

  getDelivery(deliveryId: string, tenantId: string): Delivery | undefined {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.tenant_id !== tenantId) return undefined;
    return { ...delivery };
  }
}

// ============================================================================
// Test Suite
// ============================================================================

const TENANT_ID = 'tenant-smoke-001';
const OTHER_TENANT_ID = 'tenant-smoke-002';

describe('End-to-End Interconnectivity Smoke Tests', () => {
  let platform: FloraIQPlatform;

  beforeEach(() => {
    platform = new FloraIQPlatform();
  });

  // ========================================================================
  // Test 1: Create Order → Verify Inventory Decremented
  // ========================================================================

  describe('Test 1: Order → Inventory Decrement', () => {
    beforeEach(() => {
      platform.createProduct({
        id: 'prod-1',
        tenant_id: TENANT_ID,
        name: 'Blue Dream 1oz',
        sku: 'BD-1OZ',
        available_quantity: 100,
        stock_quantity: 100,
        is_active: true,
        unit_price: 150,
        updated_at: new Date().toISOString(),
      });

      platform.createProduct({
        id: 'prod-2',
        tenant_id: TENANT_ID,
        name: 'OG Kush 1oz',
        sku: 'OGK-1OZ',
        available_quantity: 50,
        stock_quantity: 50,
        is_active: true,
        unit_price: 200,
        updated_at: new Date().toISOString(),
      });
    });

    it('should decrement inventory when order is confirmed', () => {
      // Create order
      const result = platform.createOrder(
        {
          id: 'order-1',
          tenant_id: TENANT_ID,
          customer_id: null,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1500,
          order_number: 'ORD-001',
        },
        [
          { product_id: 'prod-1', product_name: 'Blue Dream 1oz', quantity: 10, unit_price: 150 },
        ]
      );
      expect(result.success).toBe(true);

      // Inventory unchanged while pending
      expect(platform.getProduct('prod-1', TENANT_ID)?.available_quantity).toBe(100);

      // Confirm order → triggers inventory decrement
      const confirmResult = platform.confirmOrder('order-1', TENANT_ID);
      expect(confirmResult.success).toBe(true);

      // Verify inventory decremented
      expect(platform.getProduct('prod-1', TENANT_ID)?.available_quantity).toBe(90);
    });

    it('should decrement multiple products in a single order', () => {
      platform.createOrder(
        {
          id: 'order-2',
          tenant_id: TENANT_ID,
          customer_id: null,
          order_type: 'wholesale',
          status: 'pending',
          total_amount: 7500,
          order_number: 'ORD-002',
        },
        [
          { product_id: 'prod-1', product_name: 'Blue Dream 1oz', quantity: 30, unit_price: 150 },
          { product_id: 'prod-2', product_name: 'OG Kush 1oz', quantity: 20, unit_price: 200 },
        ]
      );

      platform.confirmOrder('order-2', TENANT_ID);

      expect(platform.getProduct('prod-1', TENANT_ID)?.available_quantity).toBe(70);
      expect(platform.getProduct('prod-2', TENANT_ID)?.available_quantity).toBe(30);
    });

    it('should clamp inventory to zero (never go negative)', () => {
      platform.createOrder(
        {
          id: 'order-3',
          tenant_id: TENANT_ID,
          customer_id: null,
          order_type: 'retail',
          status: 'pending',
          total_amount: 30000,
          order_number: 'ORD-003',
        },
        [
          { product_id: 'prod-2', product_name: 'OG Kush 1oz', quantity: 75, unit_price: 200 },
        ]
      );

      platform.confirmOrder('order-3', TENANT_ID);

      // 50 - 75 = clamped to 0
      expect(platform.getProduct('prod-2', TENANT_ID)?.available_quantity).toBe(0);
    });

    it('should not decrement inventory for a different tenant', () => {
      platform.createProduct({
        id: 'prod-other',
        tenant_id: OTHER_TENANT_ID,
        name: 'Other Product',
        sku: 'OTH-1',
        available_quantity: 200,
        stock_quantity: 200,
        is_active: true,
        unit_price: 100,
        updated_at: new Date().toISOString(),
      });

      // Order referencing other tenant's product — tenant_id filtering prevents decrement
      platform.createOrder(
        {
          id: 'order-cross',
          tenant_id: TENANT_ID,
          customer_id: null,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1000,
          order_number: 'ORD-CROSS',
        },
        [
          { product_id: 'prod-other', product_name: 'Other Product', quantity: 10, unit_price: 100 },
        ]
      );

      platform.confirmOrder('order-cross', TENANT_ID);

      // Other tenant's inventory should be untouched
      expect(platform.getProduct('prod-other', OTHER_TENANT_ID)?.available_quantity).toBe(200);
    });
  });

  // ========================================================================
  // Test 2: Create Customer → Appears in List & Selectable in Order
  // ========================================================================

  describe('Test 2: Customer → Customer List & Order Selection', () => {
    it('should make new customer appear in customer list', () => {
      expect(platform.getCustomers(TENANT_ID)).toHaveLength(0);

      platform.createCustomer({
        id: 'cust-1',
        tenant_id: TENANT_ID,
        name: 'Green Valley Dispensary',
        email: 'orders@greenvalley.com',
        phone: '555-0100',
        contact_type: 'wholesale',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      const customers = platform.getCustomers(TENANT_ID);
      expect(customers).toHaveLength(1);
      expect(customers[0].name).toBe('Green Valley Dispensary');
    });

    it('should make new customer selectable in order creation dropdown', () => {
      platform.createCustomer({
        id: 'cust-2',
        tenant_id: TENANT_ID,
        name: 'Sunset Wellness',
        email: 'buy@sunsetwellness.com',
        phone: '555-0200',
        contact_type: 'retail',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      const selectable = platform.getSelectableCustomers(TENANT_ID);
      expect(selectable).toHaveLength(1);
      expect(selectable[0]).toEqual({
        id: 'cust-2',
        name: 'Sunset Wellness',
        email: 'buy@sunsetwellness.com',
      });
    });

    it('should allow creating an order with the new customer', () => {
      platform.createProduct({
        id: 'prod-a',
        tenant_id: TENANT_ID,
        name: 'Test Product',
        sku: 'TP-1',
        available_quantity: 50,
        stock_quantity: 50,
        is_active: true,
        unit_price: 100,
        updated_at: new Date().toISOString(),
      });

      platform.createCustomer({
        id: 'cust-3',
        tenant_id: TENANT_ID,
        name: 'Pacific Herbs',
        email: 'info@pacificherbs.com',
        phone: '555-0300',
        contact_type: 'wholesale',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      // Create order with customer
      const result = platform.createOrder(
        {
          id: 'order-cust',
          tenant_id: TENANT_ID,
          customer_id: 'cust-3',
          order_type: 'wholesale',
          status: 'pending',
          total_amount: 500,
          order_number: 'ORD-CUST',
        },
        [
          { product_id: 'prod-a', product_name: 'Test Product', quantity: 5, unit_price: 100 },
        ]
      );

      expect(result.success).toBe(true);
      expect(result.order?.customer_id).toBe('cust-3');

      // Customer stats updated
      const customer = platform.getCustomerById('cust-3', TENANT_ID);
      expect(customer?.total_orders).toBe(1);
      expect(customer?.lifetime_value).toBe(500);
    });

    it('should reject order with customer from a different tenant', () => {
      platform.createCustomer({
        id: 'cust-other',
        tenant_id: OTHER_TENANT_ID,
        name: 'Other Tenant Customer',
        email: 'other@example.com',
        phone: '555-9999',
        contact_type: 'retail',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      const result = platform.createOrder(
        {
          id: 'order-bad-cust',
          tenant_id: TENANT_ID,
          customer_id: 'cust-other',
          order_type: 'retail',
          status: 'pending',
          total_amount: 100,
          order_number: 'ORD-BAD',
        },
        []
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found for tenant');
    });

    it('should not leak customers between tenants', () => {
      platform.createCustomer({
        id: 'cust-t1',
        tenant_id: TENANT_ID,
        name: 'Tenant 1 Customer',
        email: 't1@example.com',
        phone: '555-0001',
        contact_type: 'retail',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      platform.createCustomer({
        id: 'cust-t2',
        tenant_id: OTHER_TENANT_ID,
        name: 'Tenant 2 Customer',
        email: 't2@example.com',
        phone: '555-0002',
        contact_type: 'retail',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      expect(platform.getCustomers(TENANT_ID)).toHaveLength(1);
      expect(platform.getCustomers(TENANT_ID)[0].name).toBe('Tenant 1 Customer');

      expect(platform.getCustomers(OTHER_TENANT_ID)).toHaveLength(1);
      expect(platform.getCustomers(OTHER_TENANT_ID)[0].name).toBe('Tenant 2 Customer');

      expect(platform.getSelectableCustomers(TENANT_ID)).toHaveLength(1);
      expect(platform.getSelectableCustomers(OTHER_TENANT_ID)).toHaveLength(1);
    });
  });

  // ========================================================================
  // Test 3: Create Product → Appears in Menu Builder
  // ========================================================================

  describe('Test 3: Product → Menu Builder', () => {
    it('should make new active product appear in menu builder product list', () => {
      expect(platform.getMenuBuilderProducts(TENANT_ID)).toHaveLength(0);

      platform.createProduct({
        id: 'prod-menu-1',
        tenant_id: TENANT_ID,
        name: 'Wedding Cake 3.5g',
        sku: 'WC-35',
        available_quantity: 80,
        stock_quantity: 80,
        is_active: true,
        unit_price: 45,
        updated_at: new Date().toISOString(),
      });

      const menuProducts = platform.getMenuBuilderProducts(TENANT_ID);
      expect(menuProducts).toHaveLength(1);
      expect(menuProducts[0]).toMatchObject({
        id: 'prod-menu-1',
        name: 'Wedding Cake 3.5g',
        sku: 'WC-35',
        available_quantity: 80,
        unit_price: 45,
      });
    });

    it('should exclude inactive products from menu builder', () => {
      platform.createProduct({
        id: 'prod-inactive',
        tenant_id: TENANT_ID,
        name: 'Discontinued Strain',
        sku: 'DS-1',
        available_quantity: 20,
        stock_quantity: 20,
        is_active: false,
        unit_price: 30,
        updated_at: new Date().toISOString(),
      });

      expect(platform.getMenuBuilderProducts(TENANT_ID)).toHaveLength(0);
    });

    it('should exclude out-of-stock products from menu builder', () => {
      platform.createProduct({
        id: 'prod-oos',
        tenant_id: TENANT_ID,
        name: 'Sold Out Strain',
        sku: 'SOS-1',
        available_quantity: 0,
        stock_quantity: 0,
        is_active: true,
        unit_price: 50,
        updated_at: new Date().toISOString(),
      });

      expect(platform.getMenuBuilderProducts(TENANT_ID)).toHaveLength(0);
    });

    it('should allow creating a menu with the new product', () => {
      platform.createProduct({
        id: 'prod-menu-2',
        tenant_id: TENANT_ID,
        name: 'Gelato 1oz',
        sku: 'GEL-1OZ',
        available_quantity: 60,
        stock_quantity: 60,
        is_active: true,
        unit_price: 175,
        updated_at: new Date().toISOString(),
      });

      const result = platform.createMenu({
        id: 'menu-1',
        tenant_id: TENANT_ID,
        name: 'Weekend Special',
        status: 'draft',
        products: [
          {
            product_id: 'prod-menu-2',
            product_name: 'Gelato 1oz',
            custom_price: 160,
            is_available: true,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.menu?.products).toHaveLength(1);
      expect(result.menu?.products[0].product_id).toBe('prod-menu-2');
    });

    it('should reject menu creation with product from different tenant', () => {
      platform.createProduct({
        id: 'prod-other-tenant',
        tenant_id: OTHER_TENANT_ID,
        name: 'Other Tenant Product',
        sku: 'OTP-1',
        available_quantity: 100,
        stock_quantity: 100,
        is_active: true,
        unit_price: 100,
        updated_at: new Date().toISOString(),
      });

      const result = platform.createMenu({
        id: 'menu-bad',
        tenant_id: TENANT_ID,
        name: 'Bad Menu',
        status: 'draft',
        products: [
          {
            product_id: 'prod-other-tenant',
            product_name: 'Other Tenant Product',
            custom_price: null,
            is_available: true,
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found for tenant');
    });

    it('should reflect inventory changes in menu builder availability', () => {
      platform.createProduct({
        id: 'prod-stock',
        tenant_id: TENANT_ID,
        name: 'Limited Stock',
        sku: 'LS-1',
        available_quantity: 5,
        stock_quantity: 5,
        is_active: true,
        unit_price: 300,
        updated_at: new Date().toISOString(),
      });

      // Product initially visible in menu builder
      expect(platform.getMenuBuilderProducts(TENANT_ID)).toHaveLength(1);

      // Create and confirm an order that depletes stock
      platform.createOrder(
        {
          id: 'order-deplete',
          tenant_id: TENANT_ID,
          customer_id: null,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1500,
          order_number: 'ORD-DEP',
        },
        [
          { product_id: 'prod-stock', product_name: 'Limited Stock', quantity: 5, unit_price: 300 },
        ]
      );
      platform.confirmOrder('order-deplete', TENANT_ID);

      // Product no longer visible in menu builder (0 stock)
      expect(platform.getProduct('prod-stock', TENANT_ID)?.available_quantity).toBe(0);
      expect(platform.getMenuBuilderProducts(TENANT_ID)).toHaveLength(0);
    });
  });

  // ========================================================================
  // Test 4: Complete Delivery → Order Status Updated
  // ========================================================================

  describe('Test 4: Delivery Completion → Order Status Update', () => {
    beforeEach(() => {
      platform.createProduct({
        id: 'prod-del',
        tenant_id: TENANT_ID,
        name: 'Delivery Product',
        sku: 'DP-1',
        available_quantity: 100,
        stock_quantity: 100,
        is_active: true,
        unit_price: 100,
        updated_at: new Date().toISOString(),
      });

      platform.createOrder(
        {
          id: 'order-del-1',
          tenant_id: TENANT_ID,
          customer_id: null,
          order_type: 'retail',
          status: 'pending',
          total_amount: 500,
          order_number: 'ORD-DEL-1',
        },
        [
          { product_id: 'prod-del', product_name: 'Delivery Product', quantity: 5, unit_price: 100 },
        ]
      );

      platform.confirmOrder('order-del-1', TENANT_ID);
    });

    it('should update order to out_for_delivery when delivery is in transit', () => {
      platform.createDelivery({
        id: 'del-1',
        tenant_id: TENANT_ID,
        order_id: 'order-del-1',
        courier_id: 'courier-1',
        status: 'pending',
        eta_minutes: 30,
      });

      const result = platform.updateDeliveryStatus('del-1', TENANT_ID, 'in_transit');

      expect(result.success).toBe(true);
      expect(result.orderStatusUpdated).toBe(true);

      const order = platform.getOrder('order-del-1', TENANT_ID);
      expect(order?.status).toBe('out_for_delivery');
    });

    it('should update order to delivered when delivery completes', () => {
      platform.createDelivery({
        id: 'del-2',
        tenant_id: TENANT_ID,
        order_id: 'order-del-1',
        courier_id: 'courier-1',
        status: 'pending',
        eta_minutes: 30,
      });

      // Progress through delivery lifecycle
      platform.updateDeliveryStatus('del-2', TENANT_ID, 'picked_up');
      platform.updateDeliveryStatus('del-2', TENANT_ID, 'in_transit');
      platform.updateDeliveryStatus('del-2', TENANT_ID, 'delivered');

      const order = platform.getOrder('order-del-1', TENANT_ID);
      expect(order?.status).toBe('delivered');

      const delivery = platform.getDelivery('del-2', TENANT_ID);
      expect(delivery?.status).toBe('delivered');
      expect(delivery?.delivered_at).not.toBeNull();
    });

    it('should update order to cancelled when delivery is cancelled', () => {
      platform.createDelivery({
        id: 'del-3',
        tenant_id: TENANT_ID,
        order_id: 'order-del-1',
        courier_id: 'courier-1',
        status: 'pending',
        eta_minutes: 30,
      });

      platform.updateDeliveryStatus('del-3', TENANT_ID, 'cancelled');

      const order = platform.getOrder('order-del-1', TENANT_ID);
      expect(order?.status).toBe('cancelled');
    });

    it('should not update order status for picked_up delivery status', () => {
      platform.createDelivery({
        id: 'del-4',
        tenant_id: TENANT_ID,
        order_id: 'order-del-1',
        courier_id: 'courier-1',
        status: 'pending',
        eta_minutes: 45,
      });

      const result = platform.updateDeliveryStatus('del-4', TENANT_ID, 'picked_up');

      expect(result.success).toBe(true);
      expect(result.orderStatusUpdated).toBe(false);

      // Order should still be confirmed
      const order = platform.getOrder('order-del-1', TENANT_ID);
      expect(order?.status).toBe('confirmed');
    });

    it('should not update order for a delivery from different tenant', () => {
      const result = platform.updateDeliveryStatus('del-nonexistent', TENANT_ID, 'delivered');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delivery not found');
    });

    it('should reject delivery for order from different tenant', () => {
      platform.createOrder(
        {
          id: 'order-other-tenant',
          tenant_id: OTHER_TENANT_ID,
          customer_id: null,
          order_type: 'retail',
          status: 'confirmed',
          total_amount: 200,
          order_number: 'ORD-OT',
        },
        []
      );

      const result = platform.createDelivery({
        id: 'del-cross-tenant',
        tenant_id: TENANT_ID,
        order_id: 'order-other-tenant',
        courier_id: null,
        status: 'pending',
        eta_minutes: null,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found for tenant');
    });
  });

  // ========================================================================
  // Cross-Module Integration: Full Lifecycle
  // ========================================================================

  describe('Cross-Module: Full Lifecycle', () => {
    it('should handle the complete flow: product → customer → order → delivery', () => {
      // 1. Create product
      platform.createProduct({
        id: 'prod-full',
        tenant_id: TENANT_ID,
        name: 'Premium Flower',
        sku: 'PF-1',
        available_quantity: 200,
        stock_quantity: 200,
        is_active: true,
        unit_price: 250,
        updated_at: new Date().toISOString(),
      });

      // Product visible in menu builder
      expect(platform.getMenuBuilderProducts(TENANT_ID)).toHaveLength(1);

      // 2. Create customer
      platform.createCustomer({
        id: 'cust-full',
        tenant_id: TENANT_ID,
        name: 'Full Lifecycle Dispensary',
        email: 'orders@fulllife.com',
        phone: '555-1234',
        contact_type: 'wholesale',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      // Customer selectable in order dropdown
      const selectable = platform.getSelectableCustomers(TENANT_ID);
      expect(selectable).toHaveLength(1);
      expect(selectable[0].id).toBe('cust-full');

      // 3. Create and confirm order
      const orderResult = platform.createOrder(
        {
          id: 'order-full',
          tenant_id: TENANT_ID,
          customer_id: 'cust-full',
          order_type: 'wholesale',
          status: 'pending',
          total_amount: 12500,
          order_number: 'ORD-FULL',
        },
        [
          { product_id: 'prod-full', product_name: 'Premium Flower', quantity: 50, unit_price: 250 },
        ]
      );
      expect(orderResult.success).toBe(true);

      platform.confirmOrder('order-full', TENANT_ID);

      // Inventory decremented
      expect(platform.getProduct('prod-full', TENANT_ID)?.available_quantity).toBe(150);

      // Customer stats updated
      expect(platform.getCustomerById('cust-full', TENANT_ID)?.total_orders).toBe(1);
      expect(platform.getCustomerById('cust-full', TENANT_ID)?.lifetime_value).toBe(12500);

      // 4. Create and complete delivery
      platform.createDelivery({
        id: 'del-full',
        tenant_id: TENANT_ID,
        order_id: 'order-full',
        courier_id: 'courier-1',
        status: 'pending',
        eta_minutes: 45,
      });

      platform.updateDeliveryStatus('del-full', TENANT_ID, 'picked_up');
      platform.updateDeliveryStatus('del-full', TENANT_ID, 'in_transit');

      // Order is now out_for_delivery
      expect(platform.getOrder('order-full', TENANT_ID)?.status).toBe('out_for_delivery');

      platform.updateDeliveryStatus('del-full', TENANT_ID, 'delivered');

      // Order is now delivered
      expect(platform.getOrder('order-full', TENANT_ID)?.status).toBe('delivered');

      // Delivery has delivered_at timestamp
      expect(platform.getDelivery('del-full', TENANT_ID)?.delivered_at).not.toBeNull();

      // Product still in menu builder (has remaining stock)
      expect(platform.getMenuBuilderProducts(TENANT_ID)).toHaveLength(1);
      expect(platform.getMenuBuilderProducts(TENANT_ID)[0].available_quantity).toBe(150);
    });

    it('should maintain tenant isolation across all modules', () => {
      // Tenant 1 data
      platform.createProduct({
        id: 'prod-t1',
        tenant_id: TENANT_ID,
        name: 'Tenant 1 Product',
        sku: 'T1-P',
        available_quantity: 100,
        stock_quantity: 100,
        is_active: true,
        unit_price: 100,
        updated_at: new Date().toISOString(),
      });

      platform.createCustomer({
        id: 'cust-t1',
        tenant_id: TENANT_ID,
        name: 'Tenant 1 Customer',
        email: 't1@example.com',
        phone: '555-0001',
        contact_type: 'retail',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      // Tenant 2 data
      platform.createProduct({
        id: 'prod-t2',
        tenant_id: OTHER_TENANT_ID,
        name: 'Tenant 2 Product',
        sku: 'T2-P',
        available_quantity: 200,
        stock_quantity: 200,
        is_active: true,
        unit_price: 200,
        updated_at: new Date().toISOString(),
      });

      platform.createCustomer({
        id: 'cust-t2',
        tenant_id: OTHER_TENANT_ID,
        name: 'Tenant 2 Customer',
        email: 't2@example.com',
        phone: '555-0002',
        contact_type: 'wholesale',
        total_orders: 0,
        lifetime_value: 0,
        created_at: new Date().toISOString(),
      });

      // Tenant 1 sees only its data
      expect(platform.getActiveProducts(TENANT_ID)).toHaveLength(1);
      expect(platform.getCustomers(TENANT_ID)).toHaveLength(1);
      expect(platform.getMenuBuilderProducts(TENANT_ID)).toHaveLength(1);
      expect(platform.getMenuBuilderProducts(TENANT_ID)[0].name).toBe('Tenant 1 Product');

      // Tenant 2 sees only its data
      expect(platform.getActiveProducts(OTHER_TENANT_ID)).toHaveLength(1);
      expect(platform.getCustomers(OTHER_TENANT_ID)).toHaveLength(1);
      expect(platform.getMenuBuilderProducts(OTHER_TENANT_ID)).toHaveLength(1);
      expect(platform.getMenuBuilderProducts(OTHER_TENANT_ID)[0].name).toBe('Tenant 2 Product');

      // Cross-tenant access returns nothing
      expect(platform.getProduct('prod-t1', OTHER_TENANT_ID)).toBeUndefined();
      expect(platform.getProduct('prod-t2', TENANT_ID)).toBeUndefined();
      expect(platform.getCustomerById('cust-t1', OTHER_TENANT_ID)).toBeUndefined();
      expect(platform.getCustomerById('cust-t2', TENANT_ID)).toBeUndefined();
    });
  });
});
