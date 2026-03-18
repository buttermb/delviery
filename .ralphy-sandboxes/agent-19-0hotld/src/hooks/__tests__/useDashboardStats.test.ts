/**
 * useDashboardStats Hook Tests
 * Tests for dashboard statistics fetching and refetch configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardStats } from '../useDashboardStats';
import { createElement, type ReactNode } from 'react';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id' },
  })),
}));

vi.mock('@/contexts/DashboardDateRangeContext', () => ({
  useDashboardDateRangeOptional: vi.fn(() => ({
    dateRange: {
      from: new Date('2024-01-01'),
      to: new Date('2024-01-31'),
    },
    dateRangeKey: 'test-range',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('useDashboardStats', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    createElement(QueryClientProvider, { client: queryClient }, children)
  );

  it('should use 60 second refetch interval', async () => {
    renderHook(() => useDashboardStats(), { wrapper });

    // Access the query from the cache to check its options
    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const dashboardQuery = queries.find(q =>
        Array.isArray(q.queryKey) && q.queryKey[0] === 'dashboard'
      );

      expect(dashboardQuery).toBeDefined();
      expect((dashboardQuery as unknown as { options?: { refetchInterval?: number } })?.options?.refetchInterval).toBe(60_000);
    });
  });

  it('should use 60 second stale time', async () => {
    renderHook(() => useDashboardStats(), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const dashboardQuery = queries.find(q =>
        Array.isArray(q.queryKey) && q.queryKey[0] === 'dashboard'
      );

      expect(dashboardQuery).toBeDefined();
      expect((dashboardQuery as unknown as { options?: { staleTime?: number } })?.options?.staleTime).toBe(60_000);
    });
  });

  it('should return default stats when tenant is not available', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTenantAdminAuth } = require('@/contexts/TenantAdminAuthContext');
    useTenantAdminAuth.mockReturnValueOnce({ tenant: null });

    const { result } = renderHook(() => useDashboardStats(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        pendingOrders: 0,
        totalOrdersToday: 0,
        totalOrdersMTD: 0,
        completedOrdersToday: 0,
        avgOrderValue: 0,
        totalProducts: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        totalInventoryValue: 0,
        revenueToday: 0,
        revenueMTD: 0,
        revenueGrowthPercent: 0,
        newCustomers: 0,
        totalCustomers: 0,
        activeSessions: 0,
      });
    });
  });

  it('should be enabled only when tenant ID is present', async () => {
    const { result: resultWithTenant } = renderHook(() => useDashboardStats(), { wrapper });
    expect(resultWithTenant.current.isLoading || resultWithTenant.current.isSuccess).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTenantAdminAuth } = require('@/contexts/TenantAdminAuthContext');
    useTenantAdminAuth.mockReturnValueOnce({ tenant: null });

    const queryClient2 = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const wrapper2 = ({ children }: { children: ReactNode }) => (
      createElement(QueryClientProvider, { client: queryClient2 }, children)
    );

    const { result: resultWithoutTenant } = renderHook(() => useDashboardStats(), { wrapper: wrapper2 });

    await waitFor(() => {
      expect(resultWithoutTenant.current.isLoading).toBe(false);
    });
  });
});
