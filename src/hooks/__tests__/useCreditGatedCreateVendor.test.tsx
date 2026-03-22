/**
 * useCreditGatedCreateVendor Hook Tests
 *
 * Tests credit gating for vendor creation:
 * 1. Deducts 5 credits when creating a vendor on free tier
 * 2. Shows OutOfCreditsModal when insufficient credits
 * 3. Skips credit check for paid tier
 * 4. Creates vendor in Supabase on success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockCanPerformAction = vi.fn();
const mockPerformAction = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    canPerformAction: mockCanPerformAction,
    performAction: mockPerformAction,
  })),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((key: string) => {
    if (key === 'vendor_add') return 5;
    return 0;
  }),
  getCreditCostInfo: vi.fn((key: string) => {
    if (key === 'vendor_add') return { actionKey: 'vendor_add', actionName: 'Add Vendor', credits: 5 };
    return null;
  }),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    vendors: {
      all: ['vendors'],
      list: (id?: string) => ['vendors', 'list', id],
      byTenant: (id: string) => ['vendors', 'by-tenant', id],
    },
    credits: {
      all: ['credits'],
      balance: (id?: string) => ['credits', 'balance', id],
    },
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((e: unknown) => String(e)),
}));

// ============================================================================
// Import after mocks
// ============================================================================

import { useCreditGatedCreateVendor } from '@/hooks/useVendors';
import { useCredits } from '@/hooks/useCredits';
import { toast } from 'sonner';

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCreditGatedCreateVendor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: successful credit check and deduction
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 995,
      creditsCost: 5,
    });

    // Default: successful Supabase insert
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'new-vendor-id', name: 'Test Vendor' },
      error: null,
    });
    mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
  });

  it('creates vendor and deducts 5 credits on free tier', async () => {
    const { result } = renderHook(() => useCreditGatedCreateVendor(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFreeTier).toBe(true);

    const onSuccess = vi.fn();
    await act(async () => {
      await result.current.createVendor(
        { name: 'Test Vendor', email: 'test@example.com' },
        { onSuccess }
      );
    });

    // Should check credits
    expect(mockCanPerformAction).toHaveBeenCalledWith('vendor_add');

    // Should deduct credits
    expect(mockPerformAction).toHaveBeenCalledWith('vendor_add', undefined, 'vendor');

    // Should insert into Supabase
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Test Vendor',
        contact_email: 'test@example.com',
        account_id: 'test-tenant-id',
      }),
    ]);

    // Should call onSuccess and show toast
    expect(onSuccess).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Vendor created successfully');
  });

  it('shows OutOfCreditsModal when balance insufficient', async () => {
    mockCanPerformAction.mockResolvedValue(false);

    const { result } = renderHook(() => useCreditGatedCreateVendor(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createVendor({ name: 'Test Vendor' });
    });

    // Should show modal
    expect(result.current.showOutOfCreditsModal).toBe(true);
    expect(result.current.blockedAction).toBe('vendor_add');

    // Should NOT insert into Supabase
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips credit check for paid tier', async () => {
    (useCredits as ReturnType<typeof vi.fn>).mockReturnValue({
      balance: 0,
      isFreeTier: false,
      canPerformAction: mockCanPerformAction,
      performAction: mockPerformAction,
    });

    const { result } = renderHook(() => useCreditGatedCreateVendor(), {
      wrapper: createWrapper(),
    });

    const onSuccess = vi.fn();
    await act(async () => {
      await result.current.createVendor(
        { name: 'Paid Tier Vendor' },
        { onSuccess }
      );
    });

    // Should NOT check credits for paid tier
    expect(mockCanPerformAction).not.toHaveBeenCalled();
    expect(mockPerformAction).not.toHaveBeenCalled();

    // Should still insert into Supabase
    expect(mockInsert).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls onError when Supabase insert fails', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: new Error('DB error'),
    });

    const { result } = renderHook(() => useCreditGatedCreateVendor(), {
      wrapper: createWrapper(),
    });

    const onError = vi.fn();
    await act(async () => {
      await result.current.createVendor(
        { name: 'Failing Vendor' },
        { onError }
      );
    });

    expect(onError).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to create vendor',
      expect.objectContaining({ description: expect.any(String) })
    );
  });

  it('returns null when tenant is missing', async () => {
    const { useTenantAdminAuth } = await import('@/contexts/TenantAdminAuthContext');
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: null,
      tenantSlug: null,
    });

    const { result } = renderHook(() => useCreditGatedCreateVendor(), {
      wrapper: createWrapper(),
    });

    const onError = vi.fn();
    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.createVendor(
        { name: 'No Tenant Vendor' },
        { onError }
      );
    });

    expect(returnValue).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'No tenant ID' }));
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('can close OutOfCreditsModal', async () => {
    // Re-apply mocks (previous tests may have overridden them)
    const { useTenantAdminAuth } = await import('@/contexts/TenantAdminAuthContext');
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
      tenantSlug: 'test-tenant',
    });
    (useCredits as ReturnType<typeof vi.fn>).mockReturnValue({
      balance: 1000,
      isFreeTier: true,
      canPerformAction: mockCanPerformAction,
      performAction: mockPerformAction,
    });
    mockCanPerformAction.mockResolvedValue(false);

    const { result } = renderHook(() => useCreditGatedCreateVendor(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createVendor({ name: 'Test' });
    });

    expect(result.current.showOutOfCreditsModal).toBe(true);

    act(() => {
      result.current.closeOutOfCreditsModal();
    });

    expect(result.current.showOutOfCreditsModal).toBe(false);
  });
});
