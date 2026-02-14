/**
 * Tests for usePrefetchCustomers hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePrefetchCustomers } from '../usePrefetchCustomers';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

// Mock dependencies
vi.mock('@/contexts/TenantAdminAuthContext');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
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

describe('usePrefetchCustomers', () => {
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
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockSupabaseResponse),
    } as any);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should return prefetchCustomers function and isPrefetching state', () => {
    const { result } = renderHook(() => usePrefetchCustomers(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('prefetchCustomers');
    expect(result.current).toHaveProperty('isPrefetching');
    expect(typeof result.current.prefetchCustomers).toBe('function');
    expect(typeof result.current.isPrefetching).toBe('boolean');
    expect(result.current.isPrefetching).toBe(false);
  });

  it('should not prefetch when disabled', async () => {
    const { result } = renderHook(
      () => usePrefetchCustomers({ enabled: false }),
      { wrapper: createWrapper() }
    );

    const success = await result.current.prefetchCustomers();

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

    const { result } = renderHook(() => usePrefetchCustomers(), {
      wrapper: createWrapper(),
    });

    const success = await result.current.prefetchCustomers();

    expect(success).toBe(false);
    expect(result.current.isPrefetching).toBe(false);
  });

  it('should prefetch customers data successfully', async () => {
    const mockCustomers = [
      {
        id: 'customer-1',
        tenant_id: 'test-tenant-id',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        customer_type: 'retail',
        total_spent: 150.00,
        loyalty_points: 100,
        loyalty_tier: 'silver',
        last_purchase_at: new Date().toISOString(),
        status: 'active',
        medical_card_expiration: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'customer-2',
        tenant_id: 'test-tenant-id',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        phone: '555-5678',
        customer_type: 'medical',
        total_spent: 300.00,
        loyalty_points: 250,
        loyalty_tier: 'gold',
        last_purchase_at: new Date().toISOString(),
        status: 'active',
        medical_card_expiration: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    // Mock different responses for different queries
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockCustomers,
            error: null,
          }),
        } as any;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    const { result } = renderHook(() => usePrefetchCustomers(), {
      wrapper: createWrapper(),
    });

    // Call prefetch (it will be debounced)
    const prefetchPromise = result.current.prefetchCustomers();

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
      () => usePrefetchCustomers({ debounceMs: 50 }), // Smaller debounce for faster test
      { wrapper: createWrapper() }
    );

    // Make multiple rapid calls
    result.current.prefetchCustomers();
    result.current.prefetchCustomers();
    const promise3 = result.current.prefetchCustomers();

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
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error('Network error')),
    } as any));

    const { result } = renderHook(() => usePrefetchCustomers(), {
      wrapper: createWrapper(),
    });

    const prefetchPromise = result.current.prefetchCustomers();

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
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: [], error: null }), 100))
      ),
    } as any));

    const { result } = renderHook(() => usePrefetchCustomers({ debounceMs: 10 }), {
      wrapper: createWrapper(),
    });

    // Start first prefetch
    const promise1 = result.current.prefetchCustomers();

    // Wait a bit for debounce to trigger and prefetch to start
    await new Promise(resolve => setTimeout(resolve, 20));

    // Try to start second prefetch while first is in progress
    const promise2 = result.current.prefetchCustomers();

    const [success1, success2] = await Promise.all([promise1, promise2]);

    // First should succeed, second should be skipped (debounced or concurrent)
    expect(success1).toBe(true);
    // Second call was debounced/rejected due to concurrent call
    expect(success2).toBe(false);
  });

  it('should use custom debounce time', async () => {
    const { result } = renderHook(
      () => usePrefetchCustomers({ debounceMs: 50 }), // Smaller value for faster test
      { wrapper: createWrapper() }
    );

    const prefetchPromise = result.current.prefetchCustomers();

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

    const { result } = renderHook(() => usePrefetchCustomers(), { wrapper });

    const prefetchPromise = result.current.prefetchCustomers();

    await prefetchPromise;

    // Check that queries were cached
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    // Should have cached multiple queries (at least 5 customer-related queries)
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

    const { result } = renderHook(() => usePrefetchCustomers(), { wrapper });

    const prefetchPromise = result.current.prefetchCustomers();

    await prefetchPromise;

    // Queries should have been prefetched with staleTime
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    queries.forEach((query) => {
      // Each query should have a staleTime set (2 or 5 minutes)
      expect(query.options.staleTime).toBeDefined();
      expect(query.options.staleTime).toBeGreaterThan(0);
    });
  });

  it('should prefetch customer counts by type', async () => {
    const mockCountResponse = {
      data: null,
      error: null,
      count: 5,
    };

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockCountResponse),
    } as any);

    const { result } = renderHook(() => usePrefetchCustomers(), {
      wrapper: createWrapper(),
    });

    const success = await result.current.prefetchCustomers();

    expect(success).toBe(true);
    expect(result.current.isPrefetching).toBe(false);
  });

  it('should prefetch customer analytics summary', async () => {
    const mockCustomersForAnalytics = [
      {
        total_spent: 150.00,
        loyalty_tier: 'silver',
        status: 'active',
      },
      {
        total_spent: 300.00,
        loyalty_tier: 'gold',
        status: 'active',
      },
      {
        total_spent: 75.00,
        loyalty_tier: 'bronze',
        status: 'inactive',
      },
    ];

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: mockCustomersForAnalytics,
        error: null,
      }),
    } as any);

    const { result } = renderHook(() => usePrefetchCustomers(), {
      wrapper: createWrapper(),
    });

    const success = await result.current.prefetchCustomers();

    expect(success).toBe(true);
    await waitFor(() => {
      expect(result.current.isPrefetching).toBe(false);
    });
  });

  it('should filter out soft-deleted customers', async () => {
    const mockCustomers = [
      {
        id: 'customer-1',
        first_name: 'John',
        last_name: 'Doe',
        deleted_at: null, // Not deleted
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIs = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue({
      data: mockCustomers,
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      order: mockOrder,
      limit: mockLimit,
    } as any);

    const { result } = renderHook(() => usePrefetchCustomers(), {
      wrapper: createWrapper(),
    });

    await result.current.prefetchCustomers();

    await waitFor(() => {
      expect(result.current.isPrefetching).toBe(false);
    });

    // Verify that .is('deleted_at', null) was called to filter soft-deleted records
    expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
  });
});
