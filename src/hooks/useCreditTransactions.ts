/**
 * useCreditTransactions Hook
 *
 * Provides paginated, filterable credit transaction history for the current tenant.
 * Wraps getCreditTransactions with TanStack Query for caching and pagination.
 */

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { type CreditTransaction } from '@/lib/credits';

// ============================================================================
// Types
// ============================================================================

export type TransactionTypeFilter = 'all' | 'purchase' | 'usage' | 'refund';

export interface CreditTransactionFilters {
  type: TransactionTypeFilter;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface UseCreditTransactionsOptions {
  pageSize?: number;
  filters?: CreditTransactionFilters;
}

export interface UseCreditTransactionsReturn {
  transactions: CreditTransaction[];
  isLoading: boolean;
  isFetchingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => void;
  refetch: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCreditTransactions(
  options: UseCreditTransactionsOptions = {}
): UseCreditTransactionsReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { pageSize = 20, filters } = options;
  const [loadedPages, setLoadedPages] = useState(1);

  const typeFilter = filters?.type ?? 'all';
  const dateFrom = filters?.dateFrom;
  const dateTo = filters?.dateTo;

  // Fetch total count for pagination
  const { data: totalCount = 0 } = useQuery({
    queryKey: queryKeys.creditTransactionsExt.count(tenantId, typeFilter, dateFrom?.toISOString(), dateTo?.toISOString()),
    queryFn: async () => {
      if (!tenantId) return 0;

      try {
        let query = supabase
          .from('credit_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        if (typeFilter !== 'all') {
          query = query.eq('transaction_type', typeFilter);
        }

        if (dateFrom) {
          query = query.gte('created_at', dateFrom.toISOString());
        }

        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte('created_at', endOfDay.toISOString());
        }

        const { count, error } = await query;

        if (error) {
          logger.error('Failed to get transaction count', error, { tenantId });
          return 0;
        }

        return count ?? 0;
      } catch (err) {
        logger.error('Error getting transaction count', err as Error, { tenantId });
        return 0;
      }
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  // Fetch transactions with pagination
  const {
    data: transactions = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.creditTransactionsExt.list(tenantId, typeFilter, dateFrom?.toISOString(), dateTo?.toISOString(), loadedPages),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const limit = pageSize * loadedPages;

        let query = supabase
          .from('credit_transactions')
          .select('id, tenant_id, amount, balance_after, transaction_type, action_type, reference_id, reference_type, description, metadata, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (typeFilter !== 'all') {
          query = query.eq('transaction_type', typeFilter);
        }

        if (dateFrom) {
          query = query.gte('created_at', dateFrom.toISOString());
        }

        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte('created_at', endOfDay.toISOString());
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          logger.error('Failed to get credit transactions', queryError, { tenantId });
          return [];
        }

        return (data ?? []).map(row => ({
          id: row.id,
          tenantId: row.tenant_id,
          amount: row.amount,
          balanceAfter: row.balance_after,
          transactionType: row.transaction_type as CreditTransaction['transactionType'],
          actionType: row.action_type ?? undefined,
          referenceId: row.reference_id ?? undefined,
          referenceType: row.reference_type ?? undefined,
          description: row.description ?? undefined,
          metadata: (row.metadata as Record<string, unknown>) ?? undefined,
          createdAt: row.created_at,
        }));
      } catch (err) {
        logger.error('Error fetching credit transactions', err as Error, { tenantId });
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  const hasMore = transactions.length < totalCount;
  const isFetchingMore = isFetching && transactions.length > 0;

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setLoadedPages(prev => prev + 1);
    }
  }, [hasMore, isFetching]);

  // Reset pages when filters change
  const resetAndRefetch = useCallback(() => {
    setLoadedPages(1);
    refetch();
  }, [refetch]);

  return {
    transactions,
    isLoading,
    isFetchingMore,
    error: error as Error | null,
    hasMore,
    totalCount,
    loadMore,
    refetch: resetAndRefetch,
  };
}
