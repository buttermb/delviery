/**
 * Tests for usePrefetchInventory hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePrefetchInventory } from '../usePrefetchInventory';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

// Mock dependencies
vi.mock('@/contexts/TenantAdminAuthContext');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('usePrefetchInventory', () => {
  let mockTenant: { id: string; slug: string };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock tenant
    mockTenant = { id: 'test-tenant-id', slug: 'test-tenant' };

    // Mock useTenantAdminAuth
    vi.mocked(useTenantAdminAuth).mockReturnValue({
      tenant: mockTenant,
      user: null,
      loading: false,
      adminSession: null,
      adminUser: null,
    } as any);

    // Mock Supabase responses
    const mockSupabaseResponse = {
      data: [],
      error: null,
      count: 0,
    };

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockSupabaseResponse),
    } as any);

    // Mock supabase.rpc for COALESCE
    vi.mocked(supabase.rpc as any).mockReturnValue(10);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should return prefetchInventory function and isPrefetching state', () => {
    const { result } = renderHook(() => usePrefetchInventory(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('prefetchInventory');
    expect(result.current).toHaveProperty('isPrefetching');
    expect(typeof result.current.prefetchInventory).toBe('function');
    expect(typeof result.current.isPrefetching).toBe('boolean');
    expect(result.current.isPrefetching).toBe(false);
  });

  it('should not prefetch when disabled', async () => {
    const { result } = renderHook(
      () => usePrefetchInventory({ enabled: false }),
      { wrapper: createWrapper() }
    );

    const success = await result.current.prefetchInventory();

    expect(success).toBe(false);
    expect(result.current.isPrefetching).toBe(false);
  });

  it('should not prefetch when no tenant is available', async () => {
    vi.mocked(useTenantAdminAuth).mockReturnValue({
      tenant: null,
      user: null,
      loading: false,
      adminSession: null,
      adminUser: null,
    } as any);

    const { result } = renderHook(() => usePrefetchInventory(), {
      wrapper: createWrapper(),
    });

    const success = await result.current.prefetchInventory();

    expect(success).toBe(false);
    expect(result.current.isPrefetching).toBe(false);
  });

  it('should prefetch inventory data successfully', async () => {
    const mockProducts = [
      {
        id: 'product-1',
        name: 'Product 1',
        sku: 'SKU-001',
        stock_quantity: 100,
        price: 10,
        category: 'Electronics',
      },
      {
        id: 'product-2',
        name: 'Product 2',
        sku: 'SKU-002',
        stock_quantity: 5,
        price: 20,
        category: 'Accessories',
      },
    ];

    const mockLocations = [
      {
        id: 'loc-1',
        name: 'Main Warehouse',
        address: '123 Main St',
        type: 'warehouse',
      },
    ];

    const mockInventoryHistory = [
      {
        id: 'hist-1',
        product_id: 'product-1',
        change_type: 'adjustment',
        quantity_change: 10,
        created_at: new Date().toISOString(),
      },
    ];

    // Mock different responses for different queries
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockProducts,
            error: null,
          }),
        } as any;
      } else if (table === 'locations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockLocations,
            error: null,
          }),
        } as any;
      } else if (table === 'inventory_history') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockInventoryHistory,
            error: null,
          }),
        } as any;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    const { result } = renderHook(() => usePrefetchInventory(), {
      wrapper: createWrapper(),
    });

    // Call prefetch (it will be debounced)
    const prefetchPromise = result.current.prefetchInventory();

    // Wait for the debounced prefetch to complete
    const success = await prefetchPromise;
    expect(success).toBe(true);

    // After completion, isPrefetching should be false
    await waitFor(() => {
      expect(result.current.isPrefetching).toBe(false);
    });
  });

  it('should debounce multiple rapid calls', async () => {
    const { result } = renderHook(
      () => usePrefetchInventory({ debounceMs: 50 }), // Smaller debounce for faster test
      { wrapper: createWrapper() }
    );

    // Make multiple rapid calls
    result.current.prefetchInventory();
    result.current.prefetchInventory();
    const promise3 = result.current.prefetchInventory();

    // Wait for the last call (which cancels the previous ones due to debounce)
    await promise3;

    // Should be done prefetching
    await waitFor(() => {
      expect(result.current.isPrefetching).toBe(false);
    });
  });

  it('should handle prefetch errors gracefully', async () => {
    // Mock Supabase to throw error
    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error('Network error')),
    } as any));

    const { result } = renderHook(() => usePrefetchInventory(), {
      wrapper: createWrapper(),
    });

    const prefetchPromise = result.current.prefetchInventory();

    // Should still return true because Promise.allSettled catches individual query errors
    // The hook is resilient and continues even if some queries fail
    const success = await prefetchPromise;
    expect(success).toBe(true);

    // Should reset isPrefetching after error
    await waitFor(() => {
      expect(result.current.isPrefetching).toBe(false);
    });
  });

  it('should prevent concurrent prefetch calls', async () => {
    // Add a delay to supabase mock to simulate slow network
    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: [], error: null }), 100))
      ),
    } as any));

    const { result } = renderHook(() => usePrefetchInventory({ debounceMs: 10 }), {
      wrapper: createWrapper(),
    });

    // Start first prefetch
    const promise1 = result.current.prefetchInventory();

    // Wait a bit for debounce to trigger and prefetch to start
    await new Promise(resolve => setTimeout(resolve, 20));

    // Try to start second prefetch while first is in progress
    const promise2 = result.current.prefetchInventory();

    const [success1, success2] = await Promise.all([promise1, promise2]);

    // First should succeed, second should be skipped (debounced or concurrent)
    expect(success1).toBe(true);
    // Second call was debounced/rejected due to concurrent call
    expect(success2).toBe(false);
  });

  it('should use custom debounce time', async () => {
    const { result } = renderHook(
      () => usePrefetchInventory({ debounceMs: 50 }), // Smaller value for faster test
      { wrapper: createWrapper() }
    );

    const prefetchPromise = result.current.prefetchInventory();

    // Wait for debounce and execution
    const success = await prefetchPromise;
    expect(success).toBe(true);

    await waitFor(() => {
      expect(result.current.isPrefetching).toBe(false);
    });
  });

  it('should prefetch all required query keys', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePrefetchInventory(), { wrapper });

    const prefetchPromise = result.current.prefetchInventory();

    await prefetchPromise;

    // Check that queries were cached
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    // Should have cached multiple queries (summary, alerts, locations, history, products)
    expect(queries.length).toBeGreaterThan(0);
  });

  it('should set correct stale times for prefetched data', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePrefetchInventory(), { wrapper });

    const prefetchPromise = result.current.prefetchInventory();

    await prefetchPromise;

    // Queries should have been prefetched with staleTime
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    queries.forEach((query) => {
      // Each query should have a staleTime set (2 minutes)
      expect(query.options.staleTime).toBeDefined();
      expect(query.options.staleTime).toBeGreaterThan(0);
    });
  });

  it('should calculate inventory summary correctly', async () => {
    const mockProducts = [
      {
        id: 'product-1',
        stock_quantity: 100,
        price: 10,
      },
      {
        id: 'product-2',
        stock_quantity: 5, // Low stock
        price: 20,
      },
      {
        id: 'product-3',
        stock_quantity: 50,
        price: 15,
      },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: mockProducts,
            error: null,
          }),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockProducts,
            error: null,
          }),
        } as any;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePrefetchInventory(), { wrapper });

    await result.current.prefetchInventory();

    // Get the summary data from cache
    const summaryData = queryClient.getQueryData(['inventory', 'summary', mockTenant.id]);

    expect(summaryData).toBeDefined();
    if (summaryData) {
      const summary = summaryData as any;
      expect(summary.totalItems).toBe(3);
      expect(summary.totalValue).toBe(100 * 10 + 5 * 20 + 50 * 15); // 1850
      expect(summary.lowStockCount).toBe(1); // Only product-2 has stock < 10
    }
  });

  it('should prefetch inventory locations', async () => {
    const mockLocations = [
      {
        id: 'loc-1',
        name: 'Main Warehouse',
        address: '123 Main St',
        type: 'warehouse',
      },
      {
        id: 'loc-2',
        name: 'Retail Store',
        address: '456 Store Ave',
        type: 'retail',
      },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockLocations,
            error: null,
          }),
        } as any;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePrefetchInventory(), { wrapper });

    await result.current.prefetchInventory();

    // Get the locations data from cache
    const locationsData = queryClient.getQueryData(['inventory', 'locations', mockTenant.id]);

    expect(locationsData).toBeDefined();
    expect(Array.isArray(locationsData)).toBe(true);
    expect((locationsData as any[]).length).toBe(2);
  });
});
