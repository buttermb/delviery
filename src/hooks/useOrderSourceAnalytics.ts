/**
 * Order Source Analytics Hook
 *
 * Provides analytics data for order sources:
 * - Breakdown of orders by source (admin, storefront, menu, pos, api)
 * - Revenue by source
 * - Trend analysis over time
 * - Conversion rates by source
 */

import { useQuery } from '@tanstack/react-query';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/** Valid order source types */
export type OrderSource = 'admin' | 'storefront' | 'menu' | 'pos' | 'api';

/** Analytics data for a single source */
export interface SourceAnalytics {
  source: OrderSource;
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
  percentageOfTotal: number;
}

/** Time series data point */
export interface SourceTrendDataPoint {
  date: string;
  admin: number;
  storefront: number;
  menu: number;
  pos: number;
  api: number;
}

/** Complete analytics response */
export interface OrderSourceAnalyticsData {
  /** Breakdown by source */
  bySource: SourceAnalytics[];
  /** Total orders across all sources */
  totalOrders: number;
  /** Total revenue across all sources */
  totalRevenue: number;
  /** Daily trend data for the period */
  trends: SourceTrendDataPoint[];
  /** Top performing source */
  topSource: OrderSource | null;
  /** Fastest growing source (comparing to previous period) */
  fastestGrowingSource: OrderSource | null;
}

interface UseOrderSourceAnalyticsOptions {
  /** Start date for the analysis period */
  startDate?: Date;
  /** End date for the analysis period */
  endDate?: Date;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Hook to fetch order source analytics
 */
export function useOrderSourceAnalytics(options: UseOrderSourceAnalyticsOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: 30 days ago
    endDate = new Date(),
    enabled = true,
  } = options;

  return useQuery({
    queryKey: [
      ...queryKeys.analytics.orders(tenantId || ''),
      'source-breakdown',
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async (): Promise<OrderSourceAnalyticsData> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Fetch orders within the date range
      const { data: orders, error } = await (supabase as any)
        .from('orders')
        .select('id, order_source, total_amount, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('status', 'cancelled');

      if (error) {
        logger.error('Failed to fetch order source analytics', error, {
          component: 'useOrderSourceAnalytics',
          tenantId,
        });
        throw error;
      }

      // Also try unified_orders for additional data
      const { data: unifiedOrders } = await (supabase as any)
        .from('unified_orders')
        .select('id, source, total_amount, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('status', 'cancelled');

      // Combine and deduplicate by id
      const allOrders = [...(orders || [])];
      const seenIds = new Set(allOrders.map((o) => o.id));

      (unifiedOrders || []).forEach((uo) => {
        if (!seenIds.has(uo.id)) {
          allOrders.push({
            id: uo.id,
            order_source: uo.source || 'admin',
            total_amount: uo.total_amount || 0,
            created_at: uo.created_at,
          });
        }
      });

      // Calculate breakdown by source
      const sourceMap = new Map<OrderSource, { count: number; revenue: number }>();
      const validSources: OrderSource[] = ['admin', 'storefront', 'menu', 'pos', 'api'];

      validSources.forEach((source) => {
        sourceMap.set(source, { count: 0, revenue: 0 });
      });

      let totalOrders = 0;
      let totalRevenue = 0;

      allOrders.forEach((order) => {
        const source = (order.order_source?.toLowerCase() || 'admin') as OrderSource;
        const normalizedSource = validSources.includes(source) ? source : 'admin';
        const existing = sourceMap.get(normalizedSource) || { count: 0, revenue: 0 };

        existing.count += 1;
        existing.revenue += order.total_amount || 0;
        sourceMap.set(normalizedSource, existing);

        totalOrders += 1;
        totalRevenue += order.total_amount || 0;
      });

      // Build bySource array
      const bySource: SourceAnalytics[] = validSources.map((source) => {
        const data = sourceMap.get(source) || { count: 0, revenue: 0 };
        return {
          source,
          orderCount: data.count,
          revenue: data.revenue,
          averageOrderValue: data.count > 0 ? data.revenue / data.count : 0,
          percentageOfTotal: totalOrders > 0 ? (data.count / totalOrders) * 100 : 0,
        };
      });

      // Sort by order count descending
      bySource.sort((a, b) => b.orderCount - a.orderCount);

      // Calculate daily trends
      const trendMap = new Map<string, Record<OrderSource, number>>();

      allOrders.forEach((order) => {
        const date = order.created_at.split('T')[0];
        const source = (order.order_source?.toLowerCase() || 'admin') as OrderSource;
        const normalizedSource = validSources.includes(source) ? source : 'admin';

        if (!trendMap.has(date)) {
          trendMap.set(date, { admin: 0, storefront: 0, menu: 0, pos: 0, api: 0 });
        }

        const dayData = trendMap.get(date)!;
        dayData[normalizedSource] += 1;
      });

      const trends: SourceTrendDataPoint[] = Array.from(trendMap.entries())
        .map(([date, counts]) => ({
          date,
          ...counts,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Find top source
      const topSource = bySource.length > 0 && bySource[0].orderCount > 0 ? bySource[0].source : null;

      // Find fastest growing source (simple: compare first half vs second half of period)
      let fastestGrowingSource: OrderSource | null = null;
      if (trends.length >= 2) {
        const midpoint = Math.floor(trends.length / 2);
        const firstHalf = trends.slice(0, midpoint);
        const secondHalf = trends.slice(midpoint);

        const firstHalfTotals: Record<OrderSource, number> = { admin: 0, storefront: 0, menu: 0, pos: 0, api: 0 };
        const secondHalfTotals: Record<OrderSource, number> = { admin: 0, storefront: 0, menu: 0, pos: 0, api: 0 };

        firstHalf.forEach((day) => {
          validSources.forEach((src) => {
            firstHalfTotals[src] += day[src];
          });
        });

        secondHalf.forEach((day) => {
          validSources.forEach((src) => {
            secondHalfTotals[src] += day[src];
          });
        });

        let maxGrowth = -Infinity;
        validSources.forEach((src) => {
          const growth = firstHalfTotals[src] > 0
            ? ((secondHalfTotals[src] - firstHalfTotals[src]) / firstHalfTotals[src]) * 100
            : secondHalfTotals[src] > 0 ? 100 : 0;

          if (growth > maxGrowth && secondHalfTotals[src] > 0) {
            maxGrowth = growth;
            fastestGrowingSource = src;
          }
        });
      }

      return {
        bySource,
        totalOrders,
        totalRevenue,
        trends,
        topSource,
        fastestGrowingSource,
      };
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get display label for an order source
 */
export function getOrderSourceLabel(source: OrderSource): string {
  const labels: Record<OrderSource, string> = {
    admin: 'Admin Panel',
    storefront: 'Storefront',
    menu: 'Disposable Menu',
    pos: 'Point of Sale',
    api: 'API',
  };
  return labels[source] || 'Unknown';
}

/**
 * Get color for an order source (for charts)
 */
export function getOrderSourceColor(source: OrderSource): string {
  const colors: Record<OrderSource, string> = {
    admin: '#6366f1', // indigo
    storefront: '#8b5cf6', // purple
    menu: '#f97316', // orange
    pos: '#22c55e', // green
    api: '#06b6d4', // cyan
  };
  return colors[source] || '#94a3b8'; // slate
}

export default useOrderSourceAnalytics;
