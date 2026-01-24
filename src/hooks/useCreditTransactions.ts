/**
 * useCreditTransactions Hook
 *
 * Provides paginated credit transaction history using useInfiniteQuery.
 * Supports filtering by transaction type and date range.
 * Returns formatted transactions with relative date strings.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type CreditTransactionType =
  | 'free_grant'
  | 'purchase'
  | 'usage'
  | 'refund'
  | 'bonus'
  | 'promo';

export interface CreditTransaction {
  id: string;
  tenant_id: string;
  amount: number;
  balance_after: number;
  transaction_type: CreditTransactionType;
  action_type: string | null;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export interface FormattedCreditTransaction extends CreditTransaction {
  relativeDate: string;
  isCredit: boolean;
  absoluteAmount: number;
}

export interface CreditTransactionsFilters {
  type?: CreditTransactionType;
  startDate?: string;
  endDate?: string;
}

export interface UseCreditTransactionsReturn {
  transactions: FormattedCreditTransaction[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: Error | null;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 20;

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTransaction(tx: CreditTransaction): FormattedCreditTransaction {
  return {
    ...tx,
    relativeDate: formatRelativeDate(tx.created_at),
    isCredit: tx.amount > 0,
    absoluteAmount: Math.abs(tx.amount),
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useCreditTransactions(
  filters: CreditTransactionsFilters = {}
): UseCreditTransactionsReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    error,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.creditTransactions.list({
      tenantId,
      type: filters.type,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    queryFn: async ({ pageParam = 0 }) => {
      if (!tenantId) return { data: [], nextOffset: null };

      let query = supabase
        .from('credit_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (filters.type) {
        query = query.eq('transaction_type', filters.type);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data: rows, error: queryError } = await query;

      if (queryError) {
        logger.error('Failed to fetch credit transactions', {
          error: queryError,
          tenantId,
          filters,
        });
        throw queryError;
      }

      const results = (rows || []) as CreditTransaction[];
      const nextOffset = results.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return { data: results, nextOffset };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  const transactions: FormattedCreditTransaction[] =
    data?.pages.flatMap((page) => page.data.map(formatTransaction)) ?? [];

  return {
    transactions,
    isLoading,
    isFetchingNextPage,
    error: error as Error | null,
    hasNextPage: !!hasNextPage,
    fetchNextPage: () => { fetchNextPage(); },
    refetch: () => { refetch(); },
  };
}
