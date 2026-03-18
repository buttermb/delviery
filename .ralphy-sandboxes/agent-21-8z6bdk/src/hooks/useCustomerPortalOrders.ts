/**
 * Customer Portal Orders Hook
 * Fetches order history for authenticated customers using email matching.
 *
 * Since customer authentication (customer_users) and marketplace orders
 * use different customer tables, we match orders by email address.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface CustomerPortalOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
  total_amount: number;
  subtotal: number;
  tax: number | null;
  shipping_cost: number | null;
  items: CustomerPortalOrderItem[] | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: Record<string, unknown> | null;
  delivery_notes: string | null;
  tracking_token: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

export interface CustomerPortalOrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string | null;
}

export interface CustomerOrderStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalSpent: number;
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'processing', 'shipped'];
const COMPLETED_STATUSES = ['delivered', 'completed'];
const CANCELLED_STATUSES = ['cancelled', 'refunded', 'rejected'];

interface UseCustomerPortalOrdersOptions {
  customerEmail: string | undefined;
  tenantId: string | undefined;
  enabled?: boolean;
}

export function useCustomerPortalOrders({
  customerEmail,
  tenantId,
  enabled = true,
}: UseCustomerPortalOrdersOptions) {
  const queryKey = [...queryKeys.orders.all, 'customer-portal', customerEmail, tenantId];

  const {
    data: orders = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<CustomerPortalOrder[]> => {
      if (!customerEmail || !tenantId) return [];

      // Query marketplace_orders by customer_email and seller_tenant_id
      // This matches orders placed with this email address in the tenant's storefront
      const { data, error: fetchError } = await supabase
        .from('marketplace_orders')
        .select(`
          id,
          order_number,
          status,
          payment_status,
          total_amount,
          subtotal,
          tax,
          shipping_cost,
          items,
          customer_name,
          customer_email,
          customer_phone,
          shipping_address,
          delivery_notes,
          tracking_token,
          tracking_number,
          created_at,
          updated_at,
          confirmed_at,
          shipped_at,
          delivered_at
        `)
        .eq('customer_email', customerEmail.toLowerCase())
        .eq('seller_tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        logger.error('Failed to fetch customer portal orders', fetchError, {
          component: 'useCustomerPortalOrders',
          customerEmail,
          tenantId,
        });
        throw fetchError;
      }

      return (data as unknown as CustomerPortalOrder[]) ?? [];
    },
    enabled: enabled && !!customerEmail && !!tenantId,
  });

  // Memoize order statistics to avoid recomputing on every render
  const orderStats: CustomerOrderStats = useMemo(() => ({
    totalOrders: orders.length,
    activeOrders: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    completedOrders: orders.filter((o) => COMPLETED_STATUSES.includes(o.status)).length,
    totalSpent: orders
      .filter((o) => !CANCELLED_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + (o.total_amount ?? 0), 0),
  }), [orders]);

  // Helper to get order by ID
  const getOrderById = (orderId: string): CustomerPortalOrder | undefined => {
    return orders.find((o) => o.id === orderId);
  };

  // Helper to check if order is active
  const isActiveOrder = (order: CustomerPortalOrder): boolean => {
    return ACTIVE_STATUSES.includes(order.status);
  };

  // Helper to check if order is cancellable (only pending orders)
  const canCancelOrder = (order: CustomerPortalOrder): boolean => {
    return order.status === 'pending';
  };

  // Get status display info
  const getStatusInfo = (status: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Pending', variant: 'secondary' },
      confirmed: { label: 'Confirmed', variant: 'default' },
      preparing: { label: 'Preparing', variant: 'default' },
      ready: { label: 'Ready', variant: 'default' },
      processing: { label: 'Processing', variant: 'default' },
      shipped: { label: 'Shipped', variant: 'default' },
      out_for_delivery: { label: 'Out for Delivery', variant: 'default' },
      delivered: { label: 'Delivered', variant: 'outline' },
      completed: { label: 'Completed', variant: 'outline' },
      cancelled: { label: 'Cancelled', variant: 'destructive' },
      refunded: { label: 'Refunded', variant: 'destructive' },
      rejected: { label: 'Rejected', variant: 'destructive' },
    };
    return statusMap[status] || { label: status, variant: 'secondary' };
  };

  return {
    orders,
    isLoading,
    error,
    refetch,
    orderStats,
    getOrderById,
    isActiveOrder,
    canCancelOrder,
    getStatusInfo,
  };
}
