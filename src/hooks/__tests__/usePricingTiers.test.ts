/**
 * usePricingTiers Hook Tests
 *
 * Tests the hook that fetches pricing tiers from account_settings.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

// Mock tenant admin auth
const mockTenantId = 'tenant-123';
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: mockTenantId },
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock queryKeys
vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    accountSettings: {
      all: ['account-settings'],
      byTenant: (tenantId?: string) => ['account-settings', tenantId],
    },
  },
}));

import { usePricingTiers } from '../usePricingTiers';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePricingTiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  it('should return default tiers when no settings exist', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => usePricingTiers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tiers).toHaveLength(3);
    expect(result.current.tiers[0].name).toBe('Bronze');
    expect(result.current.tiers[1].name).toBe('Silver');
    expect(result.current.tiers[2].name).toBe('Gold');
  });

  it('should return custom tiers from account_settings', async () => {
    const customTiers = [
      {
        id: 'platinum',
        name: 'Platinum',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        discount_percentage: 15,
        min_order_amount: 10000,
        description: '15% discount for premium partners',
        active: true,
      },
    ];

    mockMaybeSingle.mockResolvedValue({
      data: {
        integration_settings: { pricing_tiers: customTiers },
      },
      error: null,
    });

    const { result } = renderHook(() => usePricingTiers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tiers).toHaveLength(1);
    expect(result.current.tiers[0].name).toBe('Platinum');
    expect(result.current.tiers[0].discount_percentage).toBe(15);
  });

  it('should filter active tiers', async () => {
    const mixedTiers = [
      {
        id: 'active-tier',
        name: 'Active',
        color: '',
        discount_percentage: 5,
        min_order_amount: 0,
        description: '',
        active: true,
      },
      {
        id: 'inactive-tier',
        name: 'Inactive',
        color: '',
        discount_percentage: 10,
        min_order_amount: 0,
        description: '',
        active: false,
      },
    ];

    mockMaybeSingle.mockResolvedValue({
      data: {
        integration_settings: { pricing_tiers: mixedTiers },
      },
      error: null,
    });

    const { result } = renderHook(() => usePricingTiers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tiers).toHaveLength(2);
    expect(result.current.activeTiers).toHaveLength(1);
    expect(result.current.activeTiers[0].name).toBe('Active');
  });

  it('should return default tiers when query errors out', async () => {
    // When the query errors, data is undefined so defaults apply
    mockMaybeSingle.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePricingTiers(), {
      wrapper: createWrapper(),
    });

    // While retries happen, tiers should still be the defaults
    // (data is undefined → fallback to DEFAULT_TIERS)
    await waitFor(() => {
      expect(result.current.tiers).toHaveLength(3);
    });

    expect(result.current.tiers[0].name).toBe('Bronze');
  });
});
