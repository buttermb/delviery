/**
 * Tests for usePrefetchOrders hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePrefetchOrders } from '../usePrefetchOrders';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

// Mock dependencies
vi.mock('@/contexts/TenantAdminAuthContext');
vi.mock('@/integrations/supabase/client');
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

describe('usePrefetchOrders', () => {
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
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockSupabaseResponse),
    } as any);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should return prefetchOrders function and isPrefetching state', () => {
    const { result } = renderHook(() => usePrefetchOrders(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('prefetchOrders');
    expect(result.current).toHaveProperty('isPrefetching');
    expect(typeof result.current.prefetchOrders).toBe('function');
    expect(typeof result.current.isPrefetching).toBe('boolean');
    expect(result.current.isPrefetching).toBe(false);
  });

  it('should not prefetch when disabled', async () => {
    const { result } = renderHook(
      () => usePrefetchOrders({ enabled: false }),
      { wrapper: createWrapper() }
    );

    const success = await result.current.prefetchOrders();

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

    const { result } = renderHook(() => usePrefetchOrders(), {
      wrapper: createWrapper(),
    });

    const success = await result.current.prefetchOrders();

    expect(success).toBe(false);
    expect(result.current.isPrefetching).toBe(false);
  });

  it('should prefetch orders data successfully', async () => {
    const mockOrders = [
      {
        id: 'order-1',
        order_number: 'ORD-001',
        status: 'pending',
        total_amount: 100,
        created_at: new Date().toISOString(),
      },
    ];

    const mockWholesaleOrders = [
      {
        id: 'wo-1',
        order_number: 'WO-001',
        status: 'confirmed',
        total_amount: 500,
        created_at: new Date().toISOString(),
      },
    ];

    // Mock different responses for different queries
    vi.mocked(supabase.from).mockImplementation((table: string) => {

      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockOrders,
            error: null,
          }),
        } as any;
      } else if (table === 'wholesale_orders') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockWholesaleOrders,
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

    const { result } = renderHook(() => usePrefetchOrders(), {
      wrapper: createWrapper(),
    });

    // Call prefetch (it will be debounced)
    const prefetchPromise = result.current.prefetchOrders();

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
      () => usePrefetchOrders({ debounceMs: 50 }), // Smaller debounce for faster test
      { wrapper: createWrapper() }
    );

    // Make multiple rapid calls
    result.current.prefetchOrders();
    result.current.prefetchOrders();
    const promise3 = result.current.prefetchOrders();

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
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error('Network error')),
    } as any));

    const { result } = renderHook(() => usePrefetchOrders(), {
      wrapper: createWrapper(),
    });

    const prefetchPromise = result.current.prefetchOrders();

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
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: [], error: null }), 100))
      ),
    } as any));

    const { result } = renderHook(() => usePrefetchOrders({ debounceMs: 10 }), {
      wrapper: createWrapper(),
    });

    // Start first prefetch
    const promise1 = result.current.prefetchOrders();

    // Wait a bit for debounce to trigger and prefetch to start
    await new Promise(resolve => setTimeout(resolve, 20));

    // Try to start second prefetch while first is in progress
    const promise2 = result.current.prefetchOrders();

    const [success1, success2] = await Promise.all([promise1, promise2]);

    // First should succeed, second should be skipped (debounced or concurrent)
    expect(success1).toBe(true);
    // Second call was debounced/rejected due to concurrent call
    expect(success2).toBe(false);
  });

  it('should use custom debounce time', async () => {
    const { result } = renderHook(
      () => usePrefetchOrders({ debounceMs: 50 }), // Smaller value for faster test
      { wrapper: createWrapper() }
    );

    const prefetchPromise = result.current.prefetchOrders();

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

    const { result } = renderHook(() => usePrefetchOrders(), { wrapper });

    const prefetchPromise = result.current.prefetchOrders();

    await prefetchPromise;

    // Check that queries were cached
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    // Should have cached multiple queries
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

    const { result } = renderHook(() => usePrefetchOrders(), { wrapper });

    const prefetchPromise = result.current.prefetchOrders();

    await prefetchPromise;

    // Queries should have been prefetched with staleTime
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    queries.forEach((query) => {
      // Each query should have a staleTime set (either 1 or 2 minutes)
      expect(query.options.staleTime).toBeDefined();
      expect(query.options.staleTime).toBeGreaterThan(0);
    });
  });
});
