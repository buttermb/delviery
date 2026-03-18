/**
 * useLocationInventory Hook Tests
 *
 * Tests for location inventory fetching, filtering by location,
 * and all-locations mode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocationInventory } from '../useLocationInventory';
import { createElement, type ReactNode } from 'react';

// Build a chainable query mock that resolves when awaited
function createQueryChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (val: unknown) => void) => resolve(resolvedValue)),
  };
  return chain;
}

let mockQueryChain: ReturnType<typeof createQueryChain>;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockQueryChain),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id' },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('useLocationInventory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it('should fetch inventory for a specific location', async () => {
    const mockData = [
      {
        id: 'inv-1',
        product_id: 'prod-1',
        location_id: 'loc-1',
        quantity: 100,
        reserved_quantity: 10,
        product: { id: 'prod-1', name: 'Test Product', sku: 'SKU-001' },
        location: { id: 'loc-1', name: 'Location A' },
      },
    ];

    mockQueryChain = createQueryChain({ data: mockData, error: null });

    const { result } = renderHook(() => useLocationInventory('loc-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    // Verify tenant_id filter is applied
    expect(mockQueryChain.eq).toHaveBeenCalledWith('tenant_id', 'test-tenant-id');
    // Verify location_id filter is applied
    expect(mockQueryChain.eq).toHaveBeenCalledWith('location_id', 'loc-1');
  });

  it('should fetch all inventory when no locationId is provided', async () => {
    const mockData = [
      {
        id: 'inv-1',
        product_id: 'prod-1',
        location_id: 'loc-1',
        quantity: 100,
        reserved_quantity: 10,
        product: { id: 'prod-1', name: 'Product A', sku: 'SKU-001' },
        location: { id: 'loc-1', name: 'Location A' },
      },
      {
        id: 'inv-2',
        product_id: 'prod-2',
        location_id: 'loc-2',
        quantity: 50,
        reserved_quantity: 5,
        product: { id: 'prod-2', name: 'Product B', sku: 'SKU-002' },
        location: { id: 'loc-2', name: 'Location B' },
      },
    ];

    mockQueryChain = createQueryChain({ data: mockData, error: null });

    const { result } = renderHook(() => useLocationInventory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    // Should only filter by tenant_id, not location_id
    expect(mockQueryChain.eq).toHaveBeenCalledWith('tenant_id', 'test-tenant-id');
    expect(mockQueryChain.eq).not.toHaveBeenCalledWith('location_id', expect.anything());
  });

  it('should include reserved_quantity and location join in select', async () => {
    mockQueryChain = createQueryChain({ data: [], error: null });

    renderHook(() => useLocationInventory('loc-1'), { wrapper });

    await waitFor(() => {
      expect(mockQueryChain.select).toHaveBeenCalled();
    });

    const selectArg = mockQueryChain.select.mock.calls[0][0] as string;
    expect(selectArg).toContain('reserved_quantity');
    expect(selectArg).toContain('location:locations(id, name)');
    expect(selectArg).toContain('product:products(id, name, sku, category, image_url)');
  });

  it('should return empty array on error', async () => {
    mockQueryChain = createQueryChain({
      data: null,
      error: { message: 'Database error' },
    });

    const { result } = renderHook(() => useLocationInventory('loc-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Hook returns [] on error (graceful degradation)
    expect(result.current.data).toEqual([]);
  });

  it('should use location-inventory query key', async () => {
    mockQueryChain = createQueryChain({ data: [], error: null });

    renderHook(() => useLocationInventory('loc-1'), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const inventoryQuery = queries.find(
        (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'location-inventory'
      );
      expect(inventoryQuery).toBeDefined();
    });
  });

  it('should include tenant and location in query key', async () => {
    mockQueryChain = createQueryChain({ data: [], error: null });

    renderHook(() => useLocationInventory('loc-1'), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const inventoryQuery = queries.find(
        (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'location-inventory'
      );
      expect(inventoryQuery).toBeDefined();
      expect(inventoryQuery!.queryKey).toContain('test-tenant-id');
      expect(inventoryQuery!.queryKey).toContain('loc-1');
    });
  });
});
