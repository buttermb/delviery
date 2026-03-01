/**
 * Hook for fetching and managing product pricing history
 * Task 094: Create product pricing history
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { logActivityAuto } from '@/lib/activityLogger';
import { eventBus } from '@/lib/eventBus';

/**
 * Price history entry from the database
 */
export interface PriceHistoryEntry {
  id: string;
  product_id: string;
  tenant_id: string;
  changed_by: string | null;
  wholesale_price_old: number | null;
  wholesale_price_new: number | null;
  retail_price_old: number | null;
  retail_price_new: number | null;
  cost_per_unit_old: number | null;
  cost_per_unit_new: number | null;
  change_reason: string | null;
  change_source: 'manual' | 'bulk_update' | 'import' | 'promotion';
  created_at: string;
}

/**
 * Data point for price history chart
 */
export interface PriceChartDataPoint {
  date: string;
  wholesalePrice: number | null;
  retailPrice: number | null;
  costPerUnit: number | null;
}

/**
 * Recent price change for strikethrough display
 */
export interface RecentPriceChange {
  id: string;
  wholesale_price_old: number | null;
  wholesale_price_new: number | null;
  retail_price_old: number | null;
  retail_price_new: number | null;
  changed_at: string;
  change_reason: string | null;
}

/**
 * Parameters for logging a price change
 */
export interface LogPriceChangeParams {
  productId: string;
  wholesalePriceOld?: number | null;
  wholesalePriceNew?: number | null;
  retailPriceOld?: number | null;
  retailPriceNew?: number | null;
  costPerUnitOld?: number | null;
  costPerUnitNew?: number | null;
  changeReason?: string;
  changeSource?: 'manual' | 'bulk_update' | 'import' | 'promotion';
}

/**
 * Hook for fetching product price history
 */
export function usePriceHistory(productId: string | undefined, timeRange: '30d' | '90d' | '1y' | 'all' = '90d') {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.products.details(), 'priceHistory', productId, timeRange],
    queryFn: async (): Promise<PriceHistoryEntry[]> => {
      if (!productId || !tenant?.id) {
        return [];
      }

      // Calculate date range
      let startDate: Date | null = null;
      const now = new Date();

      switch (timeRange) {
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = null;
          break;
      }

      let query = supabase
        .from('pricing_history')
        .select('id, product_id, tenant_id, changed_by, wholesale_price_old, wholesale_price_new, retail_price_old, retail_price_new, cost_per_unit_old, cost_per_unit_new, change_reason, change_source, created_at')
        .eq('product_id', productId)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: true });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch price history', error, { component: 'usePriceHistory' });
        throw error;
      }

      return (data ?? []) as PriceHistoryEntry[];
    },
    enabled: !!productId && !!tenant?.id,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook for fetching price history formatted for chart display
 */
export function usePriceHistoryChart(productId: string | undefined, timeRange: '30d' | '90d' | '1y' = '90d') {
  const { data: history, ...queryResult } = usePriceHistory(productId, timeRange);

  // Transform history into chart-friendly format
  const chartData: PriceChartDataPoint[] = [];

  if (history && history.length > 0) {
    // Start with the first old values
    const firstEntry = history[0];
    chartData.push({
      date: firstEntry.created_at,
      wholesalePrice: firstEntry.wholesale_price_old,
      retailPrice: firstEntry.retail_price_old,
      costPerUnit: firstEntry.cost_per_unit_old,
    });

    // Add each new value as a data point
    for (const entry of history) {
      chartData.push({
        date: entry.created_at,
        wholesalePrice: entry.wholesale_price_new,
        retailPrice: entry.retail_price_new,
        costPerUnit: entry.cost_per_unit_new,
      });
    }
  }

  return {
    ...queryResult,
    data: chartData,
    rawHistory: history,
  };
}

/**
 * Hook for fetching recent price change (for strikethrough display)
 */
export function useRecentPriceChange(productId: string | undefined, withinDays: number = 7) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.products.details(), 'recentPriceChange', productId, withinDays],
    queryFn: async (): Promise<RecentPriceChange | null> => {
      if (!productId || !tenant?.id) {
        return null;
      }

      const { data, error } = await supabase.rpc('get_recent_price_change', {
        p_product_id: productId,
        p_tenant_id: tenant.id,
        p_within_days: withinDays,
      });

      if (error) {
        logger.error('Failed to fetch recent price change', error as Error, { component: 'usePriceHistory' });
        return null;
      }

      // RPC returns an array, get first element
      const result = Array.isArray(data) && data.length > 0 ? data[0] : null;
      return result;
    },
    enabled: !!productId && !!tenant?.id,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Hook for logging a price change
 */
export function useLogPriceChange() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LogPriceChangeParams): Promise<string | null> => {
      if (!tenant?.id) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase.rpc('log_price_change', {
        p_product_id: params.productId,
        p_tenant_id: tenant.id,
        p_changed_by: admin?.id ?? null,
        p_wholesale_old: params.wholesalePriceOld ?? null,
        p_wholesale_new: params.wholesalePriceNew ?? null,
        p_retail_old: params.retailPriceOld ?? null,
        p_retail_new: params.retailPriceNew ?? null,
        p_cost_old: params.costPerUnitOld ?? null,
        p_cost_new: params.costPerUnitNew ?? null,
        p_reason: params.changeReason ?? null,
        p_source: params.changeSource ?? 'manual',
      });

      if (error) {
        logger.error('Failed to log price change', error as Error, { component: 'usePriceHistory' });
        throw error;
      }

      // Log to activity log
      await logActivityAuto(
        tenant.id,
        'update_product_price',
        'product',
        params.productId,
        {
          wholesale_old: params.wholesalePriceOld,
          wholesale_new: params.wholesalePriceNew,
          retail_old: params.retailPriceOld,
          retail_new: params.retailPriceNew,
          reason: params.changeReason,
        }
      );

      // Publish eventBus event for cross-module sync
      eventBus.publish('product_updated', {
        productId: params.productId,
        tenantId: tenant.id,
        changes: {
          price_changed: true,
          wholesale_price: params.wholesalePriceNew,
          retail_price: params.retailPriceNew,
        },
      });

      logger.debug('Price change logged', { productId: params.productId }, { component: 'usePriceHistory' });

      return data;
    },
    onSuccess: (_data, params) => {
      // Invalidate price history queries
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.details(), 'priceHistory', params.productId],
      });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.details(), 'recentPriceChange', params.productId],
      });
    },
    onError: (error) => {
      logger.error('Price change mutation failed', error, { component: 'usePriceHistory' });
    },
  });
}

/**
 * Utility to calculate price change percentage
 */
export function calculatePriceChangePercent(oldPrice: number | null, newPrice: number | null): number | null {
  if (oldPrice === null || newPrice === null || oldPrice === 0) {
    return null;
  }
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

/**
 * Determine if price increased or decreased
 */
export function getPriceChangeDirection(oldPrice: number | null, newPrice: number | null): 'increase' | 'decrease' | 'unchanged' | null {
  if (oldPrice === null || newPrice === null) {
    return null;
  }
  if (newPrice > oldPrice) {
    return 'increase';
  }
  if (newPrice < oldPrice) {
    return 'decrease';
  }
  return 'unchanged';
}
