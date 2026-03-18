/**
 * Revenue Goal Progress Hook
 *
 * Tracks monthly revenue target vs actual to visualize progress toward goals.
 * Uses completed orders from both retail and wholesale channels.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import {
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  differenceInDays,
  subMonths,
  format
} from 'date-fns';

export interface RevenueGoalData {
  /** Current month's actual revenue from completed orders */
  actualRevenue: number;
  /** Monthly target revenue */
  targetRevenue: number;
  /** Progress percentage (0-100+, can exceed 100% if goal exceeded) */
  progressPercent: number;
  /** Amount remaining to hit goal */
  remainingAmount: number;
  /** Days remaining in the month */
  daysRemaining: number;
  /** Daily target to hit remaining goal */
  dailyTargetNeeded: number;
  /** Current daily average this month */
  currentDailyAverage: number;
  /** Whether on track to hit the goal */
  isOnTrack: boolean;
  /** Whether goal has been exceeded */
  isExceeded: boolean;
  /** Last month's revenue for comparison */
  lastMonthRevenue: number;
  /** Month-over-month change percentage */
  monthOverMonthChange: number;
  /** Current month label (e.g., "January 2026") */
  currentMonthLabel: string;
  /** Number of completed orders this month */
  orderCount: number;
}

interface UseRevenueGoalProgressOptions {
  /** Monthly revenue target. If not provided, uses last month's revenue as baseline */
  targetRevenue?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Hook to fetch and calculate revenue goal progress for the current month
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useRevenueGoalProgress({ targetRevenue: 50000 });
 * ```
 */
export function useRevenueGoalProgress(options: UseRevenueGoalProgressOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { targetRevenue: customTarget, enabled = true } = options;

  // Real-time subscription for order completions
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`revenue-goal-progress-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string })?.status;
          const oldStatus = (payload.old as { status?: string })?.status;

          // Invalidate when order status changes to/from completed/delivered
          if (
            newStatus === 'completed' ||
            newStatus === 'delivered' ||
            oldStatus === 'completed' ||
            oldStatus === 'delivered'
          ) {
            logger.debug('Revenue goal progress update - order status changed', {
              component: 'useRevenueGoalProgress',
              newStatus,
              oldStatus,
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.finance.revenueGoal(tenantId) });
          }
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
          const newStatus = (payload.new as { status?: string })?.status;
          const oldStatus = (payload.old as { status?: string })?.status;

          if (
            newStatus === 'completed' ||
            newStatus === 'delivered' ||
            oldStatus === 'completed' ||
            oldStatus === 'delivered'
          ) {
            logger.debug('Revenue goal progress update - wholesale order status changed', {
              component: 'useRevenueGoalProgress',
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.finance.revenueGoal(tenantId) });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Revenue goal progress subscription error', {
            status,
            component: 'useRevenueGoalProgress'
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const query = useQuery({
    queryKey: queryKeys.finance.revenueGoal(tenantId),
    queryFn: async (): Promise<RevenueGoalData> => {
      if (!tenantId) throw new Error('No tenant');

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      const daysInMonth = getDaysInMonth(now);
      const daysPassed = differenceInDays(now, monthStart) + 1; // +1 to include today
      const daysRemaining = Math.max(0, daysInMonth - daysPassed);

      // Fetch current month and last month revenue in parallel
      const [ordersResult, wholesaleResult, lastMonthOrdersResult, lastMonthWholesaleResult] =
        await Promise.all([
          // Current month retail orders (completed/delivered only)
          supabase
            .from('orders')
            .select('total_amount')
            .eq('tenant_id', tenantId)
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString())
            .in('status', ['completed', 'delivered']),

          // Current month wholesale orders (completed/delivered only)
          supabase
            .from('wholesale_orders')
            .select('total_amount')
            .eq('tenant_id', tenantId)
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString())
            .in('status', ['completed', 'delivered']),

          // Last month retail orders
          supabase
            .from('orders')
            .select('total_amount')
            .eq('tenant_id', tenantId)
            .gte('created_at', lastMonthStart.toISOString())
            .lte('created_at', lastMonthEnd.toISOString())
            .in('status', ['completed', 'delivered']),

          // Last month wholesale orders
          supabase
            .from('wholesale_orders')
            .select('total_amount')
            .eq('tenant_id', tenantId)
            .gte('created_at', lastMonthStart.toISOString())
            .lte('created_at', lastMonthEnd.toISOString())
            .in('status', ['completed', 'delivered']),
        ]);

      // Calculate current month revenue
      const retailRevenue = ordersResult.data?.reduce(
        (sum, o) => sum + Number(o.total_amount || 0),
        0
      ) || 0;
      const wholesaleRevenue = wholesaleResult.data?.reduce(
        (sum, o) => sum + Number(o.total_amount || 0),
        0
      ) || 0;
      const actualRevenue = retailRevenue + wholesaleRevenue;
      const orderCount = (ordersResult.data?.length ?? 0) + (wholesaleResult.data?.length ?? 0);

      // Calculate last month revenue
      const lastMonthRetail = lastMonthOrdersResult.data?.reduce(
        (sum, o) => sum + Number(o.total_amount || 0),
        0
      ) || 0;
      const lastMonthWholesale = lastMonthWholesaleResult.data?.reduce(
        (sum, o) => sum + Number(o.total_amount || 0),
        0
      ) || 0;
      const lastMonthRevenue = lastMonthRetail + lastMonthWholesale;

      // Use custom target, or last month's revenue, or a reasonable default
      const targetRevenue = customTarget ??
        (lastMonthRevenue > 0 ? lastMonthRevenue : 10000);

      // Calculate metrics
      const progressPercent = targetRevenue > 0
        ? (actualRevenue / targetRevenue) * 100
        : 0;
      const remainingAmount = Math.max(0, targetRevenue - actualRevenue);
      const currentDailyAverage = daysPassed > 0
        ? actualRevenue / daysPassed
        : 0;
      const dailyTargetNeeded = daysRemaining > 0
        ? remainingAmount / daysRemaining
        : 0;

      // On track if current pace would hit target
      const projectedMonthly = currentDailyAverage * daysInMonth;
      const isOnTrack = projectedMonthly >= targetRevenue || actualRevenue >= targetRevenue;
      const isExceeded = actualRevenue >= targetRevenue;

      // Month over month change
      const monthOverMonthChange = lastMonthRevenue > 0
        ? ((actualRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      return {
        actualRevenue,
        targetRevenue,
        progressPercent: Math.round(progressPercent * 10) / 10,
        remainingAmount,
        daysRemaining,
        dailyTargetNeeded: Math.round(dailyTargetNeeded),
        currentDailyAverage: Math.round(currentDailyAverage),
        isOnTrack,
        isExceeded,
        lastMonthRevenue,
        monthOverMonthChange: Math.round(monthOverMonthChange * 10) / 10,
        currentMonthLabel: format(now, 'MMMM yyyy'),
        orderCount,
      };
    },
    enabled: !!tenantId && enabled,
    staleTime: 30_000, // 30 seconds for near real-time updates
    gcTime: 300_000, // 5 minutes cache
  });

  return query;
}
