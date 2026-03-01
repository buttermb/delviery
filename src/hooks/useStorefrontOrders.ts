/**
 * Storefront Orders Hook
 * Manages customer order history, detail fetching, cancellation, and filtering
 * for the storefront (shop) side.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

export interface StorefrontOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
  total: number | null;
  total_amount?: number;
  subtotal: number | null;
  delivery_fee: number | null;
  tax_amount?: number | null;
  items: StorefrontOrderItem[];
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  tracking_token: string | null;
  created_at: string;
  updated_at: string | null;
  paid_at: string | null;
}

export interface StorefrontOrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string | null;
  variant?: string;
}

export type OrderStatusFilter = 'all' | 'active' | 'completed' | 'cancelled';

export interface OrderFilters {
  status: OrderStatusFilter;
  search: string;
  dateRange: 'all' | '7days' | '30days' | '90days';
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];
const COMPLETED_STATUSES = ['delivered'];
const CANCELLED_STATUSES = ['cancelled', 'refunded'];

export function useStorefrontOrders({
  storeId,
  customerId,
  filters,
}: {
  storeId: string | undefined;
  customerId: string | null;
  filters?: OrderFilters;
}) {
  const queryClient = useQueryClient();

  const queryKey = ['storefront-orders', storeId, customerId, filters];

  const {
    data: orders = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<StorefrontOrder[]> => {
      if (!storeId || !customerId) return [];

      let query = supabase
        .from('marketplace_orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Apply date range filter
      if (filters?.dateRange && filters.dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;
        switch (filters.dateRange) {
          case '7days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        }
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logger.error('Failed to fetch storefront orders', fetchError);
        throw fetchError;
      }

      let result = ((data as unknown) as StorefrontOrder[]) ?? [];

      // Apply status filter
      if (filters?.status && filters.status !== 'all') {
        result = result.filter((order) => {
          switch (filters.status) {
            case 'active':
              return ACTIVE_STATUSES.includes(order.status);
            case 'completed':
              return COMPLETED_STATUSES.includes(order.status);
            case 'cancelled':
              return CANCELLED_STATUSES.includes(order.status);
            default:
              return true;
          }
        });
      }

      // Apply search filter (order number or item names)
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter((order) => {
          if (order.order_number?.toLowerCase().includes(searchLower)) return true;
          if (order.items?.some((item) => item.name?.toLowerCase().includes(searchLower))) return true;
          return false;
        });
      }

      return result;
    },
    enabled: !!storeId && !!customerId,
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      if (!storeId || !customerId) throw new Error('Not authenticated');

      // Only allow cancellation of pending/confirmed orders
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Order not found');
      if (!['pending', 'confirmed'].includes(order.status)) {
        throw new Error('Only pending or confirmed orders can be cancelled');
      }

      const { error: cancelError } = await supabase
        .from('marketplace_orders')
        .update({
          status: 'cancelled',
          cancellation_reason: reason || 'Customer requested cancellation',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('store_id', storeId)
        .eq('customer_id', customerId);

      if (cancelError) {
        logger.error('Failed to cancel order', cancelError);
        throw cancelError;
      }

      return { orderId };
    },
    onSuccess: () => {
      toast.success('Order cancelled successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontOrders.byStoreCustomer(storeId, customerId) });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to cancel order'));
    },
  });

  // Get single order by ID
  const getOrderById = (orderId: string): StorefrontOrder | undefined => {
    return orders.find((o) => o.id === orderId);
  };

  // Check if order can be cancelled
  const canCancelOrder = (order: StorefrontOrder): boolean => {
    return ['pending', 'confirmed'].includes(order.status);
  };

  // Memoize order statistics to avoid recomputing on every render
  const orderStats = useMemo(() => ({
    total: orders.length,
    active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    completed: orders.filter((o) => COMPLETED_STATUSES.includes(o.status)).length,
    cancelled: orders.filter((o) => CANCELLED_STATUSES.includes(o.status)).length,
    totalSpent: orders
      .filter((o) => !CANCELLED_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + (o.total || o.total_amount || 0), 0),
  }), [orders]);

  return {
    orders,
    isLoading,
    error,
    refetch,
    cancelOrder: cancelOrderMutation.mutateAsync,
    isCancelling: cancelOrderMutation.isPending,
    cancelError: cancelOrderMutation.error,
    getOrderById,
    canCancelOrder,
    orderStats,
  };
}

/**
 * Hook to fetch a single order by tracking token (public, no auth required)
 */
export function useStorefrontOrderByToken(trackingToken: string | undefined) {
  return useQuery({
    queryKey: queryKeys.storefrontOrders.byToken(trackingToken),
    queryFn: async (): Promise<StorefrontOrder | null> => {
      if (!trackingToken) return null;

      const { data, error } = await supabase
        .rpc('get_marketplace_order_by_token', {
          p_tracking_token: trackingToken,
        });

      if (error) {
        logger.error('Failed to fetch order by token', error);
        throw error;
      }

      const result = data as unknown as StorefrontOrder[] | null;
      return result?.[0] || null;
    },
    enabled: !!trackingToken,
    refetchInterval: (query) => {
      const data = query.state.data as StorefrontOrder | null | undefined;
      if (!data) return false;
      return ACTIVE_STATUSES.includes(data.status) ? 30000 : false;
    },
  });
}
