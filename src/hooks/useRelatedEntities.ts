import { useState, useCallback } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccountIdSafe } from '@/hooks/crm/useAccountId';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { RelatedEntityItem } from '@/components/admin/RelatedEntitiesPanel';
import type { EntityType } from '@/types/interconnected';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';

// ============================================================================
// Types for useRelatedEntities unified hook
// ============================================================================

export type RelatedEntityType = Extract<EntityType, 'order' | 'customer' | 'product'>;

/** Customer summary for order relations */
export interface RelatedCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/** Product summary for order/customer relations */
export interface RelatedProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  quantity: number;
  image_url: string | null;
}

/** Delivery summary for order relations */
export interface RelatedDelivery {
  id: string;
  status: string;
  courier_name: string | null;
  courier_phone: string | null;
  scheduled_at: string | null;
  delivered_at: string | null;
  tracking_url: string | null;
}

/** Payment summary for order relations */
export interface RelatedPayment {
  id: string;
  amount: number;
  status: string;
  method: string | null;
  paid_at: string | null;
  transaction_id: string | null;
}

/** Order summary for customer/product relations */
export interface RelatedOrder {
  id: string;
  order_number: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  item_count: number;
}

/** Vendor summary for product relations */
export interface RelatedVendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
}

/** Stock summary for product relations */
export interface RelatedStock {
  location_id: string;
  location_name: string;
  quantity: number;
  reserved: number;
  available: number;
  low_stock_threshold: number | null;
  is_low_stock: boolean;
}

/** Related entities for an Order */
export interface OrderRelatedEntities {
  entityType: 'order';
  customer: RelatedCustomer | null;
  products: RelatedProduct[];
  delivery: RelatedDelivery | null;
  payment: RelatedPayment | null;
}

/** Related entities for a Customer */
export interface CustomerRelatedEntities {
  entityType: 'customer';
  orders: RelatedOrder[];
  totalSpent: number;
  lastOrderDate: string | null;
  orderCount: number;
  averageOrderValue: number;
}

/** Related entities for a Product */
export interface ProductRelatedEntities {
  entityType: 'product';
  vendor: RelatedVendor | null;
  orders: RelatedOrder[];
  stock: RelatedStock[];
  totalStock: number;
  totalOrdered: number;
}

/** Union type for all related entities */
export type RelatedEntities =
  | OrderRelatedEntities
  | CustomerRelatedEntities
  | ProductRelatedEntities;

/** Hook return type */
export interface UseRelatedEntitiesReturn {
  data: RelatedEntities | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for lazy-loading related entity data.
 * Data is only fetched when `enable()` is called (i.e., when the accordion section is expanded).
 */
function useLazyQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  deps: { accountId: string | null; entityId: string | undefined }
) {
  const [enabled, setEnabled] = useState(false);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: enabled && !!deps.accountId && !!deps.entityId,
  });

  const enable = useCallback(() => {
    setEnabled(true);
  }, []);

  return { ...query, enable };
}

/**
 * Related invoices for a client
 */
export function useRelatedClientInvoices(clientId: string | undefined) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.crm.invoices.byClient(clientId || ''), 'related'] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: invoices, error } = await supabase
        .from('crm_invoices')
        .select('id, invoice_number, status, total, invoice_date')
        .eq('client_id', clientId!)
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (invoices || []).map((inv) => ({
        id: inv.id,
        title: `Invoice #${inv.invoice_number}`,
        subtitle: format(new Date(inv.invoice_date), 'MMM d, yyyy'),
        status: inv.status,
        statusVariant: inv.status === 'paid' ? 'default' as const
          : inv.status === 'overdue' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(inv.total),
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related pre-orders for a client
 */
export function useRelatedClientPreOrders(clientId: string | undefined) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.crm.preOrders.byClient(clientId || ''), 'related'] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: preOrders, error } = await supabase
        .from('crm_pre_orders')
        .select('id, pre_order_number, status, total, created_at')
        .eq('client_id', clientId!)
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (preOrders || []).map((po) => ({
        id: po.id,
        title: `Pre-Order #${po.pre_order_number}`,
        subtitle: format(new Date(po.created_at), 'MMM d, yyyy'),
        status: po.status,
        statusVariant: po.status === 'converted' ? 'default' as const
          : po.status === 'cancelled' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(po.total),
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related orders for a customer
 */
export function useRelatedCustomerOrders(customerId: string | undefined) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.orders.all, 'related', 'customer', customerId || ''] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (orders || []).map((order) => ({
        id: order.id,
        title: `Order #${order.id.slice(0, 8)}`,
        subtitle: format(new Date(order.created_at), 'MMM d, yyyy'),
        status: order.status,
        statusVariant: order.status === 'completed' ? 'default' as const
          : order.status === 'cancelled' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(order.total_amount || 0),
      }));
    },
    { accountId, entityId: customerId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related invoices for a pre-order (by same client)
 */
export function useRelatedPreOrderInvoices(clientId: string | undefined, excludeId?: string) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.crm.invoices.byClient(clientId || ''), 'related', 'pre-order', excludeId || ''] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: invoices, error } = await supabase
        .from('crm_invoices')
        .select('id, invoice_number, status, total, invoice_date')
        .eq('client_id', clientId!)
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (invoices || []).map((inv) => ({
        id: inv.id,
        title: `Invoice #${inv.invoice_number}`,
        subtitle: format(new Date(inv.invoice_date), 'MMM d, yyyy'),
        status: inv.status,
        statusVariant: inv.status === 'paid' ? 'default' as const
          : inv.status === 'overdue' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(inv.total),
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related pre-orders for an invoice (by same client)
 */
export function useRelatedInvoicePreOrders(clientId: string | undefined, excludeId?: string) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.crm.preOrders.byClient(clientId || ''), 'related', 'invoice', excludeId || ''] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: preOrders, error } = await supabase
        .from('crm_pre_orders')
        .select('id, pre_order_number, status, total, created_at')
        .eq('client_id', clientId!)
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (preOrders || []).map((po) => ({
        id: po.id,
        title: `Pre-Order #${po.pre_order_number}`,
        subtitle: format(new Date(po.created_at), 'MMM d, yyyy'),
        status: po.status,
        statusVariant: po.status === 'converted' ? 'default' as const
          : po.status === 'cancelled' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(po.total),
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related payments for a client
 */
export function useRelatedClientPayments(clientId: string | undefined) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    ['related-client-payments', clientId || ''] as string[],
    async (): Promise<RelatedEntityItem[]> => {
      const { data: payments, error } = await supabase
        .from('customer_payments')
        .select('id, amount, payment_method, payment_status, created_at')
        .eq('customer_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (payments || []).map((payment) => ({
        id: payment.id,
        title: formatCurrency(payment.amount || 0),
        subtitle: `${payment.payment_method || 'Unknown'} - ${format(new Date(payment.created_at), 'MMM d, yyyy')}`,
        status: payment.payment_status,
        statusVariant: payment.payment_status === 'completed' ? 'default' as const
          : 'secondary' as const,
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

// ============================================================================
// Main useRelatedEntities Hook
// ============================================================================

/**
 * Unified hook for fetching related entities based on entity type.
 *
 * Given an entityType and entityId, fetches all related entities:
 * - For an order: returns customer, products, delivery, payment
 * - For a customer: returns orders, total spent, last order date
 * - For a product: returns vendor, orders containing it, current stock
 *
 * Uses parallel TanStack queries for efficient data fetching.
 */
export function useRelatedEntities(
  entityType: RelatedEntityType,
  entityId: string | undefined
): UseRelatedEntitiesReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Create queries based on entity type
  const queries = useQueries({
    queries: getQueriesForEntityType(entityType, entityId, tenantId) as Array<{
      queryKey: readonly unknown[];
      queryFn: () => Promise<unknown>;
      enabled: boolean;
      staleTime: number;
    }>,
  });

  // Check loading/error states
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.error)?.error as Error | null;

  // Combine results based on entity type
  const data = combineResults(entityType, queries, entityId);

  // Refetch all queries
  const refetch = () => {
    queries.forEach((q) => q.refetch());
  };

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// ============================================================================
// Query Factories for useRelatedEntities
// ============================================================================

function getQueriesForEntityType(
  entityType: RelatedEntityType,
  entityId: string | undefined,
  tenantId: string | undefined
) {
  const enabled = !!entityId && !!tenantId;

  switch (entityType) {
    case 'order':
      return getOrderQueries(entityId, tenantId, enabled);
    case 'customer':
      return getCustomerQueries(entityId, tenantId, enabled);
    case 'product':
      return getProductQueries(entityId, tenantId, enabled);
    default:
      return [];
  }
}

function getOrderQueries(
  orderId: string | undefined,
  tenantId: string | undefined,
  enabled: boolean
) {
  return [
    // Query 1: Order with customer info
    {
      queryKey: [...queryKeys.orders.related(tenantId ?? '', orderId ?? ''), 'customer'],
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from('orders')
          .select('customer_id, customer_name')
          .eq('id', orderId!)
          .eq('tenant_id', tenantId!)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch order customer', error, { orderId, tenantId });
          throw error;
        }

        const orderData = data as { customer_id: string | null; customer_name: string | null } | null;
        if (!orderData || !orderData.customer_id) return null;

        return {
          id: orderData.customer_id,
          name: orderData.customer_name ?? 'Unknown',
          email: null,
          phone: null,
        } as RelatedCustomer;
      },
      enabled,
      staleTime: 30_000,
    },
    // Query 2: Order items with products
    {
      queryKey: [...queryKeys.orders.related(tenantId ?? '', orderId ?? ''), 'products'],
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from('order_items')
          .select(`
            id,
            quantity,
            price_at_order_time,
            product_id,
            products:product_id (
              id,
              name,
              sku,
              price,
              image_url
            )
          `)
          .eq('order_id', orderId!)
          .order('created_at', { ascending: true });

        if (error) {
          logger.error('Failed to fetch order products', error, { orderId });
          throw error;
        }

        interface OrderItemRow {
          id: string;
          quantity: number | null;
          price_at_order_time: number | null;
          product_id: string;
          products: { id: string; name: string; sku: string | null; price: number | null; image_url: string | null } | null;
        }

        return (data ?? []).map((item: OrderItemRow) => {
          const product = item.products;
          return {
            id: product?.id ?? item.product_id,
            name: product?.name ?? 'Unknown Product',
            sku: product?.sku ?? null,
            price: item.price_at_order_time ?? product?.price ?? null,
            quantity: item.quantity ?? 1,
            image_url: product?.image_url ?? null,
          } as RelatedProduct;
        });
      },
      enabled,
      staleTime: 30_000,
    },
    // Query 3: Delivery info
    {
      queryKey: [...queryKeys.orders.related(tenantId ?? '', orderId ?? ''), 'delivery'],
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from('wholesale_deliveries')
          .select(`
            id,
            status,
            tracking_url,
            courier_id,
            couriers:courier_id (
              full_name,
              phone
            )
          `)
          .eq('order_id', orderId!)
          .eq('tenant_id', tenantId!)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch order delivery', error, { orderId, tenantId });
          throw error;
        }

        if (!data) return null;

        interface DeliveryRow {
          id: string;
          status: string | null;
          tracking_url: string | null;
          courier_id: string | null;
          couriers: { full_name: string | null; phone: string | null } | null;
        }

        const deliveryData = data as DeliveryRow;
        const courier = deliveryData.couriers;

        return {
          id: deliveryData.id,
          status: deliveryData.status ?? 'pending',
          courier_name: courier?.full_name ?? null,
          courier_phone: courier?.phone ?? null,
          scheduled_at: null,
          delivered_at: null,
          tracking_url: deliveryData.tracking_url ?? null,
        } as RelatedDelivery;
      },
      enabled,
      staleTime: 30_000,
    },
    // Query 4: Payment info
    {
      queryKey: [...queryKeys.orders.related(tenantId ?? '', orderId ?? ''), 'payment'],
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from('payments')
          .select('id, amount, status, payment_method, paid_at, transaction_id')
          .eq('order_id', orderId!)
          .eq('tenant_id', tenantId!)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch order payment', error, { orderId, tenantId });
          throw error;
        }

        if (!data) return null;

        const paymentData = data as {
          id: string;
          amount: number | null;
          status: string | null;
          payment_method: string | null;
          paid_at: string | null;
          transaction_id: string | null;
        };

        return {
          id: paymentData.id,
          amount: paymentData.amount ?? 0,
          status: paymentData.status ?? 'pending',
          method: paymentData.payment_method ?? null,
          paid_at: paymentData.paid_at ?? null,
          transaction_id: paymentData.transaction_id ?? null,
        } as RelatedPayment;
      },
      enabled,
      staleTime: 30_000,
    },
  ];
}

function getCustomerQueries(
  customerId: string | undefined,
  tenantId: string | undefined,
  enabled: boolean
) {
  return [
    // Query 1: Customer's orders with stats
    {
      queryKey: [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'orders'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            status,
            total_amount,
            created_at,
            order_items (id)
          `)
          .eq('customer_id', customerId!)
          .eq('tenant_id', tenantId!)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          logger.error('Failed to fetch customer orders', error, { customerId, tenantId });
          throw error;
        }

        const orders = (data ?? []).map((order) => ({
          id: order.id,
          order_number: order.order_number ?? null,
          status: order.status ?? 'pending',
          total_amount: Number(order.total_amount) || 0,
          created_at: order.created_at,
          item_count: Array.isArray(order.order_items) ? order.order_items.length : 0,
        })) as RelatedOrder[];

        // Calculate stats
        const completedOrders = orders.filter((o) =>
          ['completed', 'delivered'].includes(o.status)
        );
        const totalSpent = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
        const lastOrderDate = orders.length > 0 ? orders[0].created_at : null;
        const orderCount = orders.length;
        const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

        return {
          orders,
          totalSpent,
          lastOrderDate,
          orderCount,
          averageOrderValue,
        };
      },
      enabled,
      staleTime: 30_000,
    },
  ];
}

function getProductQueries(
  productId: string | undefined,
  tenantId: string | undefined,
  enabled: boolean
) {
  return [
    // Query 1: Product's vendor
    {
      queryKey: [...queryKeys.products.related(tenantId ?? '', productId ?? ''), 'vendor'],
      queryFn: async () => {
        // First get the product's vendor_id
        const { data: product, error: productError } = await (supabase as any)
          .from('products')
          .select('vendor_id')
          .eq('id', productId!)
          .eq('tenant_id', tenantId!)
          .maybeSingle();

        if (productError) {
          logger.error('Failed to fetch product vendor_id', productError, { productId, tenantId });
          throw productError;
        }

        const productData = product as { vendor_id: string | null } | null;
        if (!productData?.vendor_id) return null;

        // Fetch vendor details using suppliers table
        const { data: vendor, error: vendorError } = await (supabase as any)
          .from('suppliers')
          .select('id, company_name, email, phone, contact_name')
          .eq('id', productData.vendor_id)
          .maybeSingle();

        if (vendorError) {
          logger.error('Failed to fetch vendor', vendorError, { vendorId: productData.vendor_id });
          throw vendorError;
        }

        if (!vendor) return null;

        const vendorData = vendor as {
          id: string;
          company_name: string | null;
          email: string | null;
          phone: string | null;
          contact_name: string | null;
        };

        return {
          id: vendorData.id,
          name: vendorData.company_name ?? 'Unknown Vendor',
          email: vendorData.email ?? null,
          phone: vendorData.phone ?? null,
          contact_name: vendorData.contact_name ?? null,
        } as RelatedVendor;
      },
      enabled,
      staleTime: 60_000,
    },
    // Query 2: Orders containing this product
    {
      queryKey: [...queryKeys.products.related(tenantId ?? '', productId ?? ''), 'orders'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            quantity,
            orders:order_id (
              id,
              order_number,
              status,
              total_amount,
              created_at,
              tenant_id
            )
          `)
          .eq('product_id', productId!)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          logger.error('Failed to fetch product orders', error, { productId });
          throw error;
        }

        const filteredData = (data ?? []).filter((item) => {
          const order = item.orders as { tenant_id?: string } | null;
          return order?.tenant_id === tenantId;
        });

        let totalOrdered = 0;
        const orders = filteredData
          .map((item) => {
            totalOrdered += item.quantity ?? 0;
            const order = item.orders as {
              id: string;
              order_number: string | null;
              status: string;
              total_amount: number;
              created_at: string;
            } | null;
            if (!order) return null;
            return {
              id: order.id,
              order_number: order.order_number ?? null,
              status: order.status ?? 'pending',
              total_amount: Number(order.total_amount) || 0,
              created_at: order.created_at,
              item_count: 1, // For product context, we just track this product
            } as RelatedOrder;
          })
          .filter((o): o is RelatedOrder => o !== null);

        return { orders, totalOrdered };
      },
      enabled,
      staleTime: 30_000,
    },
    // Query 3: Current stock across locations
    {
      queryKey: [...queryKeys.products.related(tenantId ?? '', productId ?? ''), 'stock'],
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from('inventory')
          .select(`
            id,
            quantity,
            reserved_quantity,
            location_id,
            low_stock_threshold,
            locations:location_id (
              id,
              name
            )
          `)
          .eq('product_id', productId!)
          .eq('tenant_id', tenantId!);

        if (error) {
          logger.error('Failed to fetch product stock', error, { productId, tenantId });
          throw error;
        }

        interface InventoryRow {
          id: string;
          quantity: number | null;
          reserved_quantity: number | null;
          location_id: string | null;
          low_stock_threshold: number | null;
          locations: { id: string; name: string } | null;
        }

        let totalStock = 0;
        const stock = (data ?? []).map((item: InventoryRow) => {
          const location = item.locations;
          const quantity = item.quantity ?? 0;
          const reserved = item.reserved_quantity ?? 0;
          const available = quantity - reserved;
          const threshold = item.low_stock_threshold ?? 10;

          totalStock += available;

          return {
            location_id: item.location_id ?? location?.id ?? '',
            location_name: location?.name ?? 'Unknown Location',
            quantity,
            reserved,
            available,
            low_stock_threshold: threshold,
            is_low_stock: available <= threshold,
          } as RelatedStock;
        });

        return { stock, totalStock };
      },
      enabled,
      staleTime: 30_000,
    },
  ];
}

// ============================================================================
// Result Combiner for useRelatedEntities
// ============================================================================

function combineResults(
  entityType: RelatedEntityType,
  queries: Array<{ data: unknown; isLoading: boolean }>,
  entityId: string | undefined
): RelatedEntities | null {
  if (!entityId || queries.some((q) => q.isLoading)) {
    return null;
  }

  switch (entityType) {
    case 'order': {
      const [customerQuery, productsQuery, deliveryQuery, paymentQuery] = queries;
      return {
        entityType: 'order',
        customer: (customerQuery?.data as RelatedCustomer | null) ?? null,
        products: (productsQuery?.data as RelatedProduct[]) ?? [],
        delivery: (deliveryQuery?.data as RelatedDelivery | null) ?? null,
        payment: (paymentQuery?.data as RelatedPayment | null) ?? null,
      };
    }
    case 'customer': {
      const [ordersQuery] = queries;
      const ordersData = ordersQuery?.data as {
        orders: RelatedOrder[];
        totalSpent: number;
        lastOrderDate: string | null;
        orderCount: number;
        averageOrderValue: number;
      } | null;

      return {
        entityType: 'customer',
        orders: ordersData?.orders ?? [],
        totalSpent: ordersData?.totalSpent ?? 0,
        lastOrderDate: ordersData?.lastOrderDate ?? null,
        orderCount: ordersData?.orderCount ?? 0,
        averageOrderValue: ordersData?.averageOrderValue ?? 0,
      };
    }
    case 'product': {
      const [vendorQuery, ordersQuery, stockQuery] = queries;
      const ordersData = ordersQuery?.data as { orders: RelatedOrder[]; totalOrdered: number } | null;
      const stockData = stockQuery?.data as { stock: RelatedStock[]; totalStock: number } | null;

      return {
        entityType: 'product',
        vendor: (vendorQuery?.data as RelatedVendor | null) ?? null,
        orders: ordersData?.orders ?? [],
        stock: stockData?.stock ?? [],
        totalStock: stockData?.totalStock ?? 0,
        totalOrdered: ordersData?.totalOrdered ?? 0,
      };
    }
    default:
      return null;
  }
}
