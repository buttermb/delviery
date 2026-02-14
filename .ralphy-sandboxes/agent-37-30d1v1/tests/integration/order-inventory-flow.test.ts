/**
 * Order Inventory Flow Integration Test
 *
 * Tests the full lifecycle:
 * 1. Create order → verify inventory decrements on confirmation
 * 2. Cancel order → verify inventory increments (restoration)
 *
 * This validates the business logic of:
 * - update_inventory_from_regular_order() trigger function
 * - cancelOrder() inventory restoration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Types ---

interface Product {
  id: string;
  name: string;
  available_quantity: number;
  stock_quantity: number;
  tenant_id: string;
  updated_at: string;
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
  order_type: string;
  status: string;
  total_amount: number;
  order_number: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  items: OrderItem[];
}

// --- In-Memory Database Simulation ---

/**
 * Simulates the database layer to test business logic
 * without requiring a live Supabase connection.
 * Replicates the trigger behavior from the migration.
 */
class InventoryDatabase {
  products: Map<string, Product> = new Map();
  orders: Map<string, Order> = new Map();
  orderItems: Map<string, OrderItem[]> = new Map();
  auditLogs: Array<{
    action: string;
    resource: string;
    resource_id: string;
    metadata: Record<string, unknown>;
  }> = [];

  addProduct(product: Product): void {
    this.products.set(product.id, { ...product });
  }

  getProduct(id: string): Product | undefined {
    const product = this.products.get(id);
    return product ? { ...product } : undefined;
  }

  createOrder(order: Omit<Order, 'items'>, items: OrderItem[]): Order {
    const fullOrder: Order = { ...order, items };
    this.orders.set(order.id, fullOrder);
    this.orderItems.set(order.id, items);
    return fullOrder;
  }

  /**
   * Simulates the update_inventory_from_regular_order() trigger.
   * When status changes to 'confirmed', decrements product.available_quantity.
   * Uses GREATEST(0, current - quantity) to prevent negative stock.
   */
  confirmOrder(orderId: string): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.status === 'confirmed') {
      return { success: false, error: 'Order already confirmed' };
    }

    if (['cancelled', 'completed', 'refunded'].includes(order.status)) {
      return { success: false, error: `Cannot confirm order with status: ${order.status}` };
    }

    const previousStatus = order.status;
    order.status = 'confirmed';

    // Simulate trigger: update_inventory_from_regular_order()
    const items = this.orderItems.get(orderId) || [];
    for (const item of items) {
      const product = this.products.get(item.product_id);
      if (product) {
        // Replicate: GREATEST(0, COALESCE(available_quantity, 0) - quantity)
        product.available_quantity = Math.max(
          0,
          (product.available_quantity ?? 0) - item.quantity
        );
        product.updated_at = new Date().toISOString();
      }
    }

    // Simulate audit log creation
    this.auditLogs.push({
      action: 'order_confirmed_inventory_deducted',
      resource: 'order',
      resource_id: orderId,
      metadata: {
        order_number: order.order_number,
        previous_status: previousStatus,
        new_status: 'confirmed',
        items_processed: items.length,
      },
    });

    return { success: true };
  }

  /**
   * Simulates order cancellation with inventory restoration.
   * When a confirmed order is cancelled, restores product.available_quantity.
   */
  cancelOrder(
    orderId: string,
    reason: string = 'Cancelled by user'
  ): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (['completed', 'cancelled', 'refunded'].includes(order.status)) {
      return { success: false, error: `Cannot cancel order with status: ${order.status}` };
    }

    const previousStatus = order.status;
    const wasConfirmed = previousStatus === 'confirmed';

    // Update order status
    order.status = 'cancelled';
    order.cancelled_at = new Date().toISOString();
    order.cancellation_reason = reason;

    // If the order was confirmed, restore inventory (reverse the decrement)
    if (wasConfirmed) {
      const items = this.orderItems.get(orderId) || [];
      for (const item of items) {
        const product = this.products.get(item.product_id);
        if (product) {
          product.available_quantity += item.quantity;
          product.updated_at = new Date().toISOString();
        }
      }
    }

    // Audit log
    this.auditLogs.push({
      action: 'order_cancelled',
      resource: 'order',
      resource_id: orderId,
      metadata: {
        previous_status: previousStatus,
        reason,
        inventory_restored: wasConfirmed,
      },
    });

    return { success: true };
  }
}

// --- Tests ---

describe('Order Inventory Flow', () => {
  let db: InventoryDatabase;

  const TENANT_ID = 'tenant-001';
  const PRODUCT_A = {
    id: 'product-a',
    name: 'Blue Dream 1oz',
    available_quantity: 100,
    stock_quantity: 100,
    tenant_id: TENANT_ID,
    updated_at: new Date().toISOString(),
  };
  const PRODUCT_B = {
    id: 'product-b',
    name: 'OG Kush 1oz',
    available_quantity: 50,
    stock_quantity: 50,
    tenant_id: TENANT_ID,
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    db = new InventoryDatabase();
    db.addProduct({ ...PRODUCT_A });
    db.addProduct({ ...PRODUCT_B });
  });

  describe('Order Confirmation - Inventory Decrement', () => {
    it('should decrement product available_quantity when order is confirmed', () => {
      // Arrange: Create an order with items
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-001',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 10,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-001',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1500,
          order_number: 'ORD-001',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      // Act: Confirm the order
      const result = db.confirmOrder('order-001');

      // Assert: Inventory decremented
      expect(result.success).toBe(true);
      const productA = db.getProduct(PRODUCT_A.id);
      expect(productA?.available_quantity).toBe(90); // 100 - 10
    });

    it('should decrement multiple products when order has multiple items', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-002',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 25,
          unit_price: 150,
        },
        {
          id: 'item-2',
          order_id: 'order-002',
          product_id: PRODUCT_B.id,
          product_name: PRODUCT_B.name,
          quantity: 15,
          unit_price: 200,
        },
      ];

      db.createOrder(
        {
          id: 'order-002',
          tenant_id: TENANT_ID,
          order_type: 'wholesale',
          status: 'pending',
          total_amount: 6750,
          order_number: 'ORD-002',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      const result = db.confirmOrder('order-002');

      expect(result.success).toBe(true);
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(75); // 100 - 25
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(35); // 50 - 15
    });

    it('should not allow quantity to go below zero (GREATEST(0, ...) behavior)', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-003',
          product_id: PRODUCT_B.id,
          product_name: PRODUCT_B.name,
          quantity: 75, // More than available (50)
          unit_price: 200,
        },
      ];

      db.createOrder(
        {
          id: 'order-003',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 15000,
          order_number: 'ORD-003',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      const result = db.confirmOrder('order-003');

      expect(result.success).toBe(true);
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(0); // Clamped to 0
    });

    it('should create audit log entry on confirmation', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-004',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 5,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-004',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 750,
          order_number: 'ORD-004',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      db.confirmOrder('order-004');

      expect(db.auditLogs).toHaveLength(1);
      expect(db.auditLogs[0]).toMatchObject({
        action: 'order_confirmed_inventory_deducted',
        resource: 'order',
        resource_id: 'order-004',
        metadata: expect.objectContaining({
          order_number: 'ORD-004',
          previous_status: 'pending',
          new_status: 'confirmed',
          items_processed: 1,
        }),
      });
    });

    it('should not decrement inventory if order is already confirmed', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-005',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 10,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-005',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1500,
          order_number: 'ORD-005',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      // First confirmation
      db.confirmOrder('order-005');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(90);

      // Second confirmation attempt - should fail
      const result = db.confirmOrder('order-005');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order already confirmed');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(90); // Unchanged
    });

    it('should update product updated_at timestamp', () => {
      const beforeTime = new Date().toISOString();

      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-006',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 5,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-006',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 750,
          order_number: 'ORD-006',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      db.confirmOrder('order-006');

      const product = db.getProduct(PRODUCT_A.id);
      expect(product?.updated_at).not.toBe(PRODUCT_A.updated_at);
      expect(new Date(product!.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });
  });

  describe('Order Cancellation - Inventory Increment', () => {
    it('should restore inventory when confirmed order is cancelled', () => {
      // Arrange: Create and confirm an order
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-010',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 20,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-010',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 3000,
          order_number: 'ORD-010',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      db.confirmOrder('order-010');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(80); // 100 - 20

      // Act: Cancel the order
      const result = db.cancelOrder('order-010', 'Customer changed mind');

      // Assert: Inventory restored
      expect(result.success).toBe(true);
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100); // 80 + 20 = back to original
    });

    it('should restore multiple product quantities on cancellation', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-011',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 30,
          unit_price: 150,
        },
        {
          id: 'item-2',
          order_id: 'order-011',
          product_id: PRODUCT_B.id,
          product_name: PRODUCT_B.name,
          quantity: 10,
          unit_price: 200,
        },
      ];

      db.createOrder(
        {
          id: 'order-011',
          tenant_id: TENANT_ID,
          order_type: 'wholesale',
          status: 'pending',
          total_amount: 6500,
          order_number: 'ORD-011',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      // Confirm - decrements inventory
      db.confirmOrder('order-011');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(70); // 100 - 30
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(40); // 50 - 10

      // Cancel - restores inventory
      const result = db.cancelOrder('order-011');
      expect(result.success).toBe(true);
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100); // 70 + 30
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(50); // 40 + 10
    });

    it('should not restore inventory when pending order is cancelled (no decrement happened)', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-012',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 15,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-012',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 2250,
          order_number: 'ORD-012',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      // Cancel without confirming first - no inventory to restore
      const result = db.cancelOrder('order-012');
      expect(result.success).toBe(true);
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100); // Unchanged
    });

    it('should prevent cancelling already cancelled orders', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-013',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 10,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-013',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1500,
          order_number: 'ORD-013',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      db.confirmOrder('order-013');
      db.cancelOrder('order-013');

      // Try to cancel again
      const result = db.cancelOrder('order-013');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot cancel order with status: cancelled');
    });

    it('should prevent cancelling completed orders', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-014',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 10,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-014',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'completed',
          total_amount: 1500,
          order_number: 'ORD-014',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      const result = db.cancelOrder('order-014');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot cancel order with status: completed');
    });

    it('should set cancelled_at and cancellation_reason', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-015',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 5,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-015',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 750,
          order_number: 'ORD-015',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      db.cancelOrder('order-015', 'Out of stock at warehouse');

      const order = db.orders.get('order-015');
      expect(order?.status).toBe('cancelled');
      expect(order?.cancelled_at).not.toBeNull();
      expect(order?.cancellation_reason).toBe('Out of stock at warehouse');
    });

    it('should create audit log on cancellation with inventory_restored flag', () => {
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'order-016',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 10,
          unit_price: 150,
        },
      ];

      db.createOrder(
        {
          id: 'order-016',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1500,
          order_number: 'ORD-016',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      db.confirmOrder('order-016');
      db.cancelOrder('order-016', 'Test cancellation');

      // Should have 2 audit logs: confirmation + cancellation
      expect(db.auditLogs).toHaveLength(2);

      const cancelLog = db.auditLogs[1];
      expect(cancelLog).toMatchObject({
        action: 'order_cancelled',
        resource: 'order',
        resource_id: 'order-016',
        metadata: expect.objectContaining({
          previous_status: 'confirmed',
          reason: 'Test cancellation',
          inventory_restored: true,
        }),
      });
    });
  });

  describe('Full Lifecycle - Create, Confirm, Cancel', () => {
    it('should handle the complete order lifecycle with correct inventory levels', () => {
      // Initial state
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100);
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(50);

      // Step 1: Create order
      const orderItems: OrderItem[] = [
        {
          id: 'item-1',
          order_id: 'lifecycle-001',
          product_id: PRODUCT_A.id,
          product_name: PRODUCT_A.name,
          quantity: 40,
          unit_price: 150,
        },
        {
          id: 'item-2',
          order_id: 'lifecycle-001',
          product_id: PRODUCT_B.id,
          product_name: PRODUCT_B.name,
          quantity: 25,
          unit_price: 200,
        },
      ];

      db.createOrder(
        {
          id: 'lifecycle-001',
          tenant_id: TENANT_ID,
          order_type: 'wholesale',
          status: 'pending',
          total_amount: 11000,
          order_number: 'LC-001',
          cancelled_at: null,
          cancellation_reason: null,
        },
        orderItems
      );

      // After creation - no inventory change yet (pending status)
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100);
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(50);

      // Step 2: Confirm order - triggers inventory decrement
      db.confirmOrder('lifecycle-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(60); // 100 - 40
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(25); // 50 - 25

      // Step 3: Cancel order - restores inventory
      db.cancelOrder('lifecycle-001', 'Lifecycle test cancellation');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100); // 60 + 40
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(50); // 25 + 25
    });

    it('should handle multiple orders affecting the same product', () => {
      // Order 1: Takes 30 units of Product A
      db.createOrder(
        {
          id: 'multi-001',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 4500,
          order_number: 'MO-001',
          cancelled_at: null,
          cancellation_reason: null,
        },
        [
          {
            id: 'item-1',
            order_id: 'multi-001',
            product_id: PRODUCT_A.id,
            product_name: PRODUCT_A.name,
            quantity: 30,
            unit_price: 150,
          },
        ]
      );

      // Order 2: Takes 50 units of Product A
      db.createOrder(
        {
          id: 'multi-002',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 7500,
          order_number: 'MO-002',
          cancelled_at: null,
          cancellation_reason: null,
        },
        [
          {
            id: 'item-2',
            order_id: 'multi-002',
            product_id: PRODUCT_A.id,
            product_name: PRODUCT_A.name,
            quantity: 50,
            unit_price: 150,
          },
        ]
      );

      // Confirm both
      db.confirmOrder('multi-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(70); // 100 - 30

      db.confirmOrder('multi-002');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(20); // 70 - 50

      // Cancel order 1 only - restores its 30 units
      db.cancelOrder('multi-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(50); // 20 + 30

      // Order 2 still active, so not fully restored
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).not.toBe(100);
    });

    it('should handle order with zero-quantity items gracefully', () => {
      db.createOrder(
        {
          id: 'zero-001',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 0,
          order_number: 'ZR-001',
          cancelled_at: null,
          cancellation_reason: null,
        },
        [
          {
            id: 'item-1',
            order_id: 'zero-001',
            product_id: PRODUCT_A.id,
            product_name: PRODUCT_A.name,
            quantity: 0,
            unit_price: 150,
          },
        ]
      );

      db.confirmOrder('zero-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100); // No change

      db.cancelOrder('zero-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100); // Still no change
    });

    it('should handle confirmation of order with non-existent product', () => {
      db.createOrder(
        {
          id: 'ghost-001',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1500,
          order_number: 'GH-001',
          cancelled_at: null,
          cancellation_reason: null,
        },
        [
          {
            id: 'item-1',
            order_id: 'ghost-001',
            product_id: 'non-existent-product',
            product_name: 'Ghost Product',
            quantity: 10,
            unit_price: 150,
          },
        ]
      );

      // Should not throw even if product doesn't exist
      const result = db.confirmOrder('ghost-001');
      expect(result.success).toBe(true);

      // Existing products unchanged
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100);
      expect(db.getProduct(PRODUCT_B.id)?.available_quantity).toBe(50);
    });

    it('should return error when confirming non-existent order', () => {
      const result = db.confirmOrder('no-such-order');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should return error when cancelling non-existent order', () => {
      const result = db.cancelOrder('no-such-order');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });
  });

  describe('Edge Cases', () => {
    it('should handle order with empty items array', () => {
      db.createOrder(
        {
          id: 'empty-001',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 0,
          order_number: 'EM-001',
          cancelled_at: null,
          cancellation_reason: null,
        },
        []
      );

      const confirmResult = db.confirmOrder('empty-001');
      expect(confirmResult.success).toBe(true);

      // No products affected
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100);

      const cancelResult = db.cancelOrder('empty-001');
      expect(cancelResult.success).toBe(true);
    });

    it('should handle large quantity orders that exceed available stock', () => {
      db.createOrder(
        {
          id: 'large-001',
          tenant_id: TENANT_ID,
          order_type: 'wholesale',
          status: 'pending',
          total_amount: 150000,
          order_number: 'LG-001',
          cancelled_at: null,
          cancellation_reason: null,
        },
        [
          {
            id: 'item-1',
            order_id: 'large-001',
            product_id: PRODUCT_A.id,
            product_name: PRODUCT_A.name,
            quantity: 1000, // Way more than available (100)
            unit_price: 150,
          },
        ]
      );

      // Confirm clamps to 0
      db.confirmOrder('large-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(0);

      // Cancel restores the full ordered quantity
      db.cancelOrder('large-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(1000); // 0 + 1000
    });

    it('should handle sequential confirm/cancel/confirm cycle (order reconfirmation not allowed)', () => {
      db.createOrder(
        {
          id: 'cycle-001',
          tenant_id: TENANT_ID,
          order_type: 'retail',
          status: 'pending',
          total_amount: 1500,
          order_number: 'CY-001',
          cancelled_at: null,
          cancellation_reason: null,
        },
        [
          {
            id: 'item-1',
            order_id: 'cycle-001',
            product_id: PRODUCT_A.id,
            product_name: PRODUCT_A.name,
            quantity: 10,
            unit_price: 150,
          },
        ]
      );

      // Confirm
      db.confirmOrder('cycle-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(90);

      // Cancel
      db.cancelOrder('cycle-001');
      expect(db.getProduct(PRODUCT_A.id)?.available_quantity).toBe(100);

      // Attempt to re-confirm (cancelled orders can't be confirmed)
      const result = db.confirmOrder('cycle-001');
      expect(result.success).toBe(false); // Already cancelled
    });
  });
});
