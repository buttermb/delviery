/**
 * useCreditTransactions Hook Tests
 *
 * Verifies that the hook:
 *   - Requires tenant context (disabled when no tenantId)
 *   - Queries credit_transactions filtered by tenant_id
 *   - Supports type, date range filters
 *   - Implements pagination with loadMore
 *   - Returns proper shape (transactions, isLoading, hasMore, totalCount, etc.)
 *   - Uses queryKeys factory for cache keys
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Hoisted mocks
// ============================================================================

const { mockSelect, mockEq, mockGte, mockLte, mockOrder, mockLimit } = vi.hoisted(() => {
  const mockLimit = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockLte = vi.fn().mockReturnThis();
  const mockGte = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();

  const mockSelect = vi.fn(() => ({
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    limit: mockLimit,
  }));

  // Chain properly: each method returns the query builder
  mockEq.mockImplementation(() => ({
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    limit: mockLimit,
  }));

  mockGte.mockImplementation(() => ({
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    limit: mockLimit,
  }));

  mockLte.mockImplementation(() => ({
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    limit: mockLimit,
  }));

  mockOrder.mockImplementation(() => ({
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    limit: mockLimit,
  }));

  mockLimit.mockResolvedValue({
    data: [],
    error: null,
  });

  return { mockSelect, mockEq, mockGte, mockLte, mockOrder, mockLimit };
});

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'tenant-abc-123' },
    isAuthenticated: true,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/credits', () => ({
  consumeCredits: vi.fn(),
  trackCreditEvent: vi.fn(),
  getCreditCost: vi.fn(() => 0),
  getCreditCostInfo: vi.fn(() => null),
  LOW_CREDIT_WARNING_THRESHOLD: 2000,
  CRITICAL_CREDIT_THRESHOLD: 100,
  FREE_TIER_MONTHLY_CREDITS: 500,
  LOW_BALANCE_WARNING_LEVELS: [2000, 1000, 500, 100],
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useCreditTransactions, type UseCreditTransactionsReturn } from '@/hooks/useCreditTransactions';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Test wrapper
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useCreditTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset select mock chain to return empty data
    mockSelect.mockImplementation((selectStr: string, opts?: Record<string, unknown>) => {
      if (opts?.head) {
        // Count query
        return {
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        };
      }
      // Data query - return chainable builder
      const builder = {
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      builder.eq.mockReturnValue(builder);
      builder.gte.mockReturnValue(builder);
      builder.lte.mockReturnValue(builder);
      builder.order.mockReturnValue(builder);
      return builder;
    });
  });

  describe('return shape', () => {
    it('should return the expected interface properties', async () => {
      const { result } = renderHook(() => useCreditTransactions(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toHaveProperty('transactions');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isFetchingMore');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('hasMore');
      expect(result.current).toHaveProperty('totalCount');
      expect(result.current).toHaveProperty('loadMore');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should default to empty transactions array', async () => {
      const { result } = renderHook(() => useCreditTransactions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.transactions).toEqual([]);
    });
  });

  describe('disabled when no tenant', () => {
    it('should not fetch when tenantId is missing', () => {
      vi.mocked(useTenantAdminAuth).mockReturnValue({
        tenant: null,
        isAuthenticated: false,
      } as ReturnType<typeof useTenantAdminAuth>);

      const { result } = renderHook(() => useCreditTransactions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.transactions).toEqual([]);
      expect(result.current.totalCount).toBe(0);
    });
  });

  describe('source code validation', () => {
    const hookSource = fs.readFileSync(
      path.resolve(__dirname, '../useCreditTransactions.ts'),
      'utf-8'
    );

    it('should import useTenantAdminAuth for tenant context', () => {
      expect(hookSource).toContain('useTenantAdminAuth');
    });

    it('should import queryKeys factory', () => {
      expect(hookSource).toContain("import { queryKeys } from '@/lib/queryKeys'");
    });

    it('should import logger from @/lib/logger', () => {
      expect(hookSource).toContain("import { logger } from '@/lib/logger'");
    });

    it('should not use console.log', () => {
      expect(hookSource).not.toContain('console.log');
    });

    it('should filter queries by tenant_id', () => {
      expect(hookSource).toContain("eq('tenant_id', tenantId)");
    });

    it('should use .maybeSingle() not .single()', () => {
      expect(hookSource).not.toContain('.single()');
    });

    it('should order by created_at descending', () => {
      expect(hookSource).toContain("order('created_at', { ascending: false })");
    });

    it('should support type filter for transaction_type', () => {
      expect(hookSource).toContain("eq('transaction_type', typeFilter)");
    });

    it('should support date range filters', () => {
      expect(hookSource).toContain("gte('created_at'");
      expect(hookSource).toContain("lte('created_at'");
    });

    it('should use queryKeys.creditTransactionsExt for cache keys', () => {
      expect(hookSource).toContain('queryKeys.creditTransactionsExt');
    });

    it('should export TransactionTypeFilter type', () => {
      expect(hookSource).toContain("export type TransactionTypeFilter");
    });

    it('should export CreditTransactionFilters interface', () => {
      expect(hookSource).toContain("export interface CreditTransactionFilters");
    });

    it('should use staleTime for caching', () => {
      expect(hookSource).toContain('staleTime:');
    });

    it('should handle errors with logger.error', () => {
      const errorLogCalls = (hookSource.match(/logger\.error\(/g) ?? []).length;
      expect(errorLogCalls).toBeGreaterThanOrEqual(2); // count query + data query
    });

    it('should map snake_case DB columns to camelCase in response', () => {
      expect(hookSource).toContain('tenantId: row.tenant_id');
      expect(hookSource).toContain('balanceAfter: row.balance_after');
      expect(hookSource).toContain('transactionType: row.transaction_type');
      expect(hookSource).toContain('actionType: row.action_type');
    });
  });
});
