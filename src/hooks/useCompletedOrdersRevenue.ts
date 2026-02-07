import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, startOfYear } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';

export type DateRangeType = '7d' | '30d' | '90d' | 'ytd' | 'all' | 'today' | 'month';

interface CompletedOrdersStats {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  completedCount: number;
  pendingCount: number;
  cancelledCount: number;
}

interface CompletedOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  order_type?: string;
  source?: string;
}

interface UseCompletedOrdersRevenueResult {
  orders: CompletedOrder[];
  stats: CompletedOrdersStats;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and calculate revenue from completed orders with real-time updates
 * Connects Finance to Revenue reports by providing accurate completed order data
 */
export function useCompletedOrdersRevenue(dateRange: DateRangeType = 'today'): UseCompletedOrdersRevenueResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // Real-time subscription for order status changes
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`completed-orders-revenue-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          logger.debug('Completed orders revenue update received', {
            event: payload.eventType,
            component: 'useCompletedOrdersRevenue',
          });
          // Invalidate the completed orders query to refetch
          queryClient.invalidateQueries({ queryKey: queryKeys.finance.completedOrders(tenantId, dateRange) });
          // Also invalidate related financial queries
          queryClient.invalidateQueries({ queryKey: ['financial-snapshot', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['monthly-performance', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['revenue-reports', tenantId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_orders',
        },
        (payload) => {
          logger.debug('Wholesale orders update for revenue', {
            event: payload.eventType,
            component: 'useCompletedOrdersRevenue',
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.finance.completedOrders(tenantId, dateRange) });
          queryClient.invalidateQueries({ queryKey: ['financial-snapshot', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['monthly-performance', tenantId] });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Completed orders revenue subscription error', { status, component: 'useCompletedOrdersRevenue' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, dateRange, queryClient]);

  // Calculate date range boundaries
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (dateRange) {
      case 'today':
        start = startOfDay(now);
        break;
      case '7d':
        start = subDays(now, 7);
        break;
      case '30d':
        start = subDays(now, 30);
        break;
      case '90d':
        start = subDays(now, 90);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'ytd':
        start = startOfYear(now);
        break;
      case 'all':
      default:
        // Return null to indicate no date filter
        return { start: null, end: null };
    }

    return { start, end };
  }, [dateRange]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.finance.completedOrders(tenantId ?? '', dateRange),
    queryFn: async (): Promise<CompletedOrder[]> => {
      if (!tenantId) return [];

      // Query both orders and wholesale_orders tables for comprehensive data
      const [ordersResult, wholesaleResult] = await Promise.all([
        // Regular orders
        (async () => {
          let query = (supabase as any)
            .from('orders')
            .select('id, order_number, status, total_amount, subtotal, payment_status, payment_method, created_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

          if (dateRangeBounds.start) {
            query = query.gte('created_at', dateRangeBounds.start.toISOString());
          }
          if (dateRangeBounds.end) {
            query = query.lte('created_at', dateRangeBounds.end.toISOString());
          }

          const { data, error } = await query.limit(1000);
          if (error) {
            logger.error('Failed to fetch orders for revenue', error, { component: 'useCompletedOrdersRevenue' });
            return [];
          }
          return ((data || []) as any[]).map(o => ({
            ...o,
            total_amount: Number(o.total_amount || 0),
            subtotal: Number(o.subtotal || 0),
            tax_amount: Number(o.tax_amount || 0),
            discount_amount: Number(o.discount_amount || 0),
            order_type: 'retail',
            source: 'orders',
          }));
        })(),
        // Wholesale orders
        (async () => {
          let query = (supabase as any)
            .from('wholesale_orders')
            .select('id, order_number, status, total_amount, payment_status, created_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

          if (dateRangeBounds.start) {
            query = query.gte('created_at', dateRangeBounds.start.toISOString());
          }
          if (dateRangeBounds.end) {
            query = query.lte('created_at', dateRangeBounds.end.toISOString());
          }

          const { data, error } = await query.limit(1000);
          if (error) {
            logger.error('Failed to fetch wholesale orders for revenue', error, { component: 'useCompletedOrdersRevenue' });
            return [];
          }
          return ((data || []) as any[]).map(o => ({
            ...o,
            total_amount: Number(o.total_amount || 0),
            subtotal: Number(o.total_amount || 0),
            tax_amount: 0,
            discount_amount: 0,
            payment_method: null,
            order_type: 'wholesale',
            source: 'wholesale_orders',
          }));
        })(),
      ]);

      // Combine and sort by created_at
      const allOrders = [...ordersResult, ...wholesaleResult]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return allOrders;
    },
    enabled: !!tenantId,
    staleTime: 30_000, // 30 seconds - shorter for more real-time data
    gcTime: 300_000, // 5 minutes
  });

  // Calculate stats from orders
  const stats = useMemo((): CompletedOrdersStats => {
    if (!data || data.length === 0) {
      return {
        totalRevenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        completedCount: 0,
        pendingCount: 0,
        cancelledCount: 0,
      };
    }

    const completedStatuses = ['completed', 'delivered'];
    const pendingStatuses = ['pending', 'confirmed', 'processing', 'in_transit'];
    const cancelledStatuses = ['cancelled', 'rejected', 'refunded'];

    const completedOrders = data.filter(o => completedStatuses.includes(o.status));
    const pendingOrders = data.filter(o => pendingStatuses.includes(o.status));
    const cancelledOrders = data.filter(o => cancelledStatuses.includes(o.status));

    // Calculate revenue from completed orders only (real revenue, not pending)
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const orderCount = data.length;
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    return {
      totalRevenue,
      orderCount,
      avgOrderValue,
      completedCount: completedOrders.length,
      pendingCount: pendingOrders.length,
      cancelledCount: cancelledOrders.length,
    };
  }, [data]);

  return {
    orders: data || [],
    stats,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook specifically for today's financial snapshot using real completed orders
 */
export function useTodayRevenueSnapshot() {
  return useCompletedOrdersRevenue('today');
}

/**
 * Hook for monthly revenue performance using real completed orders
 */
export function useMonthlyRevenueSnapshot() {
  return useCompletedOrdersRevenue('month');
}
