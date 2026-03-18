import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * Date range for filtering inventory history
 */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Raw inventory history entry from the database
 */
export interface InventoryHistoryEntry {
  id: string;
  tenant_id: string;
  product_id: string;
  change_type: 'stock_in' | 'stock_out' | 'transfer' | 'adjustment' | 'sale' | 'return' | 'receiving' | 'disposal';
  previous_quantity: number;
  new_quantity: number;
  change_amount: number;
  reference_type: string | null;
  reference_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  reason: string | null;
  notes: string | null;
  performed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string | null;
  };
}

/**
 * Enhanced inventory history entry with formatted fields and running total
 */
export interface FormattedInventoryHistoryEntry extends InventoryHistoryEntry {
  /** Formatted change string (e.g., "+50", "-25", "0") */
  formattedChange: string;
  /** Running total quantity at this point in time */
  runningTotal: number;
  /** Human-readable change type label */
  changeTypeLabel: string;
  /** Whether the change is positive, negative, or neutral */
  changeDirection: 'increase' | 'decrease' | 'neutral';
}

/**
 * Filters for inventory history queries
 */
export interface InventoryHistoryFilters {
  /** Filter by specific product ID */
  productId?: string;
  /** Filter by change type */
  changeType?: string;
  /** Start date for filtering (ISO string) - deprecated, use dateRange */
  startDate?: string;
  /** End date for filtering (ISO string) - deprecated, use dateRange */
  endDate?: string;
  /** Date range for filtering */
  dateRange?: DateRange;
  /** Maximum number of entries to return */
  limit?: number;
}

/**
 * Map change types to human-readable labels
 */
const CHANGE_TYPE_LABELS: Record<string, string> = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
  sale: 'Sale',
  return: 'Return',
  receiving: 'Receiving',
  disposal: 'Disposal',
};

/**
 * Format a quantity change as a string with sign
 */
function formatChange(amount: number): string {
  if (amount > 0) {
    return `+${amount}`;
  }
  if (amount < 0) {
    return String(amount);
  }
  return '0';
}

/**
 * Determine the direction of a change
 */
function getChangeDirection(amount: number): 'increase' | 'decrease' | 'neutral' {
  if (amount > 0) return 'increase';
  if (amount < 0) return 'decrease';
  return 'neutral';
}

/**
 * Calculate running totals for inventory history entries
 * Entries are expected in descending order (newest first)
 * Running total represents the quantity at each point in time
 */
function calculateRunningTotals(
  entries: InventoryHistoryEntry[]
): FormattedInventoryHistoryEntry[] {
  if (entries.length === 0) return [];

  // For running totals, we work from oldest to newest
  // Since entries are in descending order, we reverse, calculate, then reverse back
  const reversedEntries = [...entries].reverse();

  const result: FormattedInventoryHistoryEntry[] = [];

  for (let i = 0; i < reversedEntries.length; i++) {
    const entry = reversedEntries[i];
    // The running total at each entry is the new_quantity after that change
    const runningTotal = entry.new_quantity;

    result.push({
      ...entry,
      formattedChange: formatChange(entry.change_amount),
      runningTotal,
      changeTypeLabel: CHANGE_TYPE_LABELS[entry.change_type] || entry.change_type,
      changeDirection: getChangeDirection(entry.change_amount),
    });
  }

  // Reverse back to descending order (newest first)
  return result.reverse();
}

/**
 * Hook to fetch and process inventory change history
 *
 * @param filters - Optional filters for productId, dateRange, changeType, and limit
 * @returns Query result with formatted history entries including running totals
 *
 * @example
 * ```tsx
 * // Fetch all history for a specific product
 * const { data, isLoading } = useInventoryHistory({ productId: 'abc-123' });
 *
 * // Fetch history within a date range
 * const { data } = useInventoryHistory({
 *   dateRange: {
 *     startDate: '2024-01-01',
 *     endDate: '2024-01-31',
 *   },
 * });
 *
 * // Access formatted entries
 * data?.formattedEntries.forEach(entry => {
 *   logger.debug(`${entry.changeTypeLabel}: ${entry.formattedChange} (Total: ${entry.runningTotal})`);
 * });
 * ```
 */
export function useInventoryHistory(filters: InventoryHistoryFilters = {}) {
  const { tenant } = useTenantAdminAuth();

  // Resolve date range from either dateRange object or individual dates
  const startDate = filters.dateRange?.startDate ?? filters.startDate;
  const endDate = filters.dateRange?.endDate ?? filters.endDate;

  const query = useQuery({
    queryKey: queryKeys.inventory.history({
      tenantId: tenant?.id,
      productId: filters.productId,
      changeType: filters.changeType,
      startDate,
      endDate,
      limit: filters.limit,
    }),
    queryFn: async (): Promise<InventoryHistoryEntry[]> => {
      if (!tenant?.id) return [];

      const dbQuery = supabase.from('inventory_history');

      let selectQuery = dbQuery
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (filters.productId) {
        selectQuery = selectQuery.eq('product_id', filters.productId);
      }

      if (filters.changeType) {
        selectQuery = selectQuery.eq('change_type', filters.changeType);
      }

      if (startDate) {
        selectQuery = selectQuery.gte('created_at', startDate);
      }

      if (endDate) {
        selectQuery = selectQuery.lte('created_at', endDate);
      }

      const limitValue = filters.limit ?? 100;
      selectQuery = selectQuery.limit(limitValue);

      const { data, error } = await selectQuery;

      if (error) {
        logger.error('Failed to fetch inventory history', {
          error,
          tenantId: tenant.id,
          filters: { productId: filters.productId, startDate, endDate },
        });
        throw error;
      }

      return (data ?? []) as unknown as InventoryHistoryEntry[];
    },
    enabled: !!tenant?.id,
  });

  // Memoize formatted entries with running totals
  const formattedEntries = useMemo(() => {
    if (!query.data) return [];
    return calculateRunningTotals(query.data);
  }, [query.data]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!formattedEntries.length) {
      return {
        totalChanges: 0,
        netChange: 0,
        totalIncrease: 0,
        totalDecrease: 0,
        currentQuantity: 0,
      };
    }

    let totalIncrease = 0;
    let totalDecrease = 0;

    for (const entry of formattedEntries) {
      if (entry.change_amount > 0) {
        totalIncrease += entry.change_amount;
      } else {
        totalDecrease += Math.abs(entry.change_amount);
      }
    }

    // Current quantity is the running total of the most recent entry
    const currentQuantity = formattedEntries[0]?.runningTotal ?? 0;

    return {
      totalChanges: formattedEntries.length,
      netChange: totalIncrease - totalDecrease,
      totalIncrease,
      totalDecrease,
      currentQuantity,
    };
  }, [formattedEntries]);

  return {
    // Raw entries from the database
    data: query.data,
    // Formatted entries with running totals and change formatting
    formattedEntries,
    // Summary statistics
    summary,
    // Query state
    isLoading: query.isLoading,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
