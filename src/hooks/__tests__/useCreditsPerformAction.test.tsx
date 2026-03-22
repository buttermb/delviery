/**
 * useCredits.performAction — Double-Execution Prevention Tests
 *
 * Tests the actual hook's performAction method to verify:
 * 1. Concurrent calls with same idempotency key are blocked (across renders)
 * 2. Key is cleaned up after completion, allowing reuse
 * 3. Different keys execute concurrently without interference
 * 4. Key cleanup happens even on error (finally block)
 * 5. Client-side rate limiting blocks after 30 ops/minute
 * 6. No-tenant returns early with error
 * 7. Non-free-tier skips credit consumption
 *
 * NOTE: The inFlightActions state updates asynchronously via React setState.
 * The duplicate-blocking guard works across React render cycles (i.e., when the
 * first call triggers a re-render via setInFlightActions before the second call
 * reads the state). Tests use separate act() calls to simulate this.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Hoisted mocks (must be before vi.mock calls due to hoisting)
// ============================================================================

const {
  mockConsumeCredits,
  mockTrackCreditEvent,
  mockShowCreditDeductionToast,
  mockTenantAdminAuth,
} = vi.hoisted(() => ({
  mockConsumeCredits: vi.fn(),
  mockTrackCreditEvent: vi.fn(),
  mockShowCreditDeductionToast: vi.fn(),
  mockTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant', subscription_plan: 'free', is_free_tier: true },
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
    accessToken: 'mock-access-token',
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: {
          balance: 5000,
          lifetimeStats: { earned: 5000, spent: 0, purchased: 0, expired: 0, refunded: 0 },
          subscription: {
            status: 'active',
            isFreeTier: true,
            creditsPerPeriod: 5000,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
          nextFreeGrantAt: null,
          pendingTransactions: 0,
        },
        error: null,
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => mockTenantAdminAuth(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((err: unknown) => String(err)),
}));

vi.mock('@/components/credits/CreditDeductionToast', () => ({
  showCreditDeductionToast: mockShowCreditDeductionToast,
}));

vi.mock('@/lib/credits', () => ({
  consumeCredits: (...args: unknown[]) => mockConsumeCredits(...args),
  trackCreditEvent: mockTrackCreditEvent,
  getCreditCost: vi.fn((actionKey: string) => {
    const costs: Record<string, number> = {
      menu_create: 100,
      order_create: 50,
      send_sms: 25,
      free_action: 0,
    };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn((actionKey: string) => {
    const infos: Record<string, { actionKey: string; actionName: string; credits: number }> = {
      menu_create: { actionKey: 'menu_create', actionName: 'Create Menu', credits: 100 },
      order_create: { actionKey: 'order_create', actionName: 'Create Order', credits: 50 },
      send_sms: { actionKey: 'send_sms', actionName: 'Send SMS', credits: 25 },
    };
    return infos[actionKey] ?? null;
  }),
  LOW_CREDIT_WARNING_THRESHOLD: 2000,
  CRITICAL_CREDIT_THRESHOLD: 100,
  FREE_TIER_MONTHLY_CREDITS: 5000,
  LOW_BALANCE_WARNING_LEVELS: [2000, 1000, 500, 100],
  getWarningMessage: vi.fn(),
}));

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Import after mocks
// ============================================================================

import { useCredits } from '@/hooks/useCredits';
import { logger } from '@/lib/logger';

// ============================================================================
// Tests
// ============================================================================

describe('useCredits.performAction — Double-Execution Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumeCredits.mockResolvedValue({
      success: true,
      newBalance: 4900,
      creditsCost: 100,
    });
    // Reset tenant mock to default
    mockTenantAdminAuth.mockReturnValue({
      tenant: { id: 'test-tenant-id', slug: 'test-tenant', subscription_plan: 'free', is_free_tier: true },
      tenantSlug: 'test-tenant',
      isAuthenticated: true,
      accessToken: 'mock-access-token',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Concurrent calls with same idempotency key are blocked
  // ==========================================================================

  describe('concurrent duplicate blocking', () => {
    it('should block second call after first triggers state update via re-render', async () => {
      // First call will be slow, keeping the idempotency key in the in-flight set
      let resolveFirst!: (value: unknown) => void;
      mockConsumeCredits.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; })
      );

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      // Start first action — it will add key to inFlightActions and await consumeCredits
      let firstPromise: Promise<unknown>;
      act(() => {
        firstPromise = result.current.performAction('menu_create', 'ref-123', 'menu');
      });

      // After act, React has processed the setInFlightActions call
      // Now the second call should see the updated inFlightActions
      let secondResult: unknown;
      await act(async () => {
        secondResult = await result.current.performAction('menu_create', 'ref-123', 'menu');
      });

      // Second call should be blocked
      expect((secondResult as { success: boolean }).success).toBe(false);
      expect((secondResult as { errorMessage: string }).errorMessage).toBe(
        'Action already in progress'
      );

      // Resolve first call
      await act(async () => {
        resolveFirst({ success: true, newBalance: 4900, creditsCost: 100 });
        await firstPromise!;
      });

      // consumeCredits should only be called once (for the first call)
      expect(mockConsumeCredits).toHaveBeenCalledTimes(1);
    });

    it('should log warning when duplicate action is prevented', async () => {
      let resolveFirst!: (value: unknown) => void;
      mockConsumeCredits.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; })
      );

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      // Start first action
      let firstPromise: Promise<unknown>;
      act(() => {
        firstPromise = result.current.performAction('menu_create', 'ref-dup');
      });

      // Attempt duplicate after re-render
      await act(async () => {
        await result.current.performAction('menu_create', 'ref-dup');
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Duplicate action prevented',
        expect.objectContaining({
          actionKey: 'menu_create',
          referenceId: 'ref-dup',
        })
      );

      // Cleanup
      await act(async () => {
        resolveFirst({ success: true, newBalance: 4900, creditsCost: 100 });
        await firstPromise!;
      });
    });

    it('should return current balance and zero cost when blocking duplicate', async () => {
      let resolveFirst!: (value: unknown) => void;
      mockConsumeCredits.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; })
      );

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      let firstPromise: Promise<unknown>;
      act(() => {
        firstPromise = result.current.performAction('menu_create', 'ref-bal');
      });

      let blockedResult: unknown;
      await act(async () => {
        blockedResult = await result.current.performAction('menu_create', 'ref-bal');
      });

      // Blocked result should have zero creditsCost
      expect((blockedResult as { creditsCost: number }).creditsCost).toBe(0);
      // newBalance should be a number (the current balance from state)
      expect(typeof (blockedResult as { newBalance: number }).newBalance).toBe('number');

      // Cleanup
      await act(async () => {
        resolveFirst({ success: true, newBalance: 4900, creditsCost: 100 });
        await firstPromise!;
      });
    });

    it('should block duplicate when both calls have no referenceId (uses default key)', async () => {
      let resolveFirst!: (value: unknown) => void;
      mockConsumeCredits.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; })
      );

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      let firstPromise: Promise<unknown>;
      act(() => {
        firstPromise = result.current.performAction('menu_create');
      });

      let secondResult: unknown;
      await act(async () => {
        secondResult = await result.current.performAction('menu_create');
      });

      expect((secondResult as { success: boolean }).success).toBe(false);
      expect((secondResult as { errorMessage: string }).errorMessage).toBe(
        'Action already in progress'
      );
      expect(mockConsumeCredits).toHaveBeenCalledTimes(1);

      // Cleanup
      await act(async () => {
        resolveFirst({ success: true, newBalance: 4900, creditsCost: 100 });
        await firstPromise!;
      });
    });
  });

  // ==========================================================================
  // 2. Key cleanup after completion allows reuse
  // ==========================================================================

  describe('key cleanup after completion', () => {
    it('should allow same idempotency key after previous call completes', async () => {
      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      // First call
      let firstResult: unknown;
      await act(async () => {
        firstResult = await result.current.performAction('menu_create', 'ref-reuse', 'menu');
      });
      expect((firstResult as { success: boolean }).success).toBe(true);

      // Second call with same key after first completed
      mockConsumeCredits.mockResolvedValueOnce({
        success: true,
        newBalance: 4800,
        creditsCost: 100,
      });

      let secondResult: unknown;
      await act(async () => {
        secondResult = await result.current.performAction('menu_create', 'ref-reuse', 'menu');
      });

      expect((secondResult as { success: boolean }).success).toBe(true);
      expect(mockConsumeCredits).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // 3. Different keys execute concurrently
  // ==========================================================================

  describe('different keys run concurrently', () => {
    it('should allow concurrent calls with different actionKeys', async () => {
      let resolveMenu!: (value: unknown) => void;
      let resolveOrder!: (value: unknown) => void;

      mockConsumeCredits
        .mockImplementationOnce(() => new Promise((resolve) => { resolveMenu = resolve; }))
        .mockImplementationOnce(() => new Promise((resolve) => { resolveOrder = resolve; }));

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      let menuPromise: Promise<unknown>;
      let orderPromise: Promise<unknown>;

      // Start both actions — different keys so both should proceed
      act(() => {
        menuPromise = result.current.performAction('menu_create', 'ref-a', 'menu');
        orderPromise = result.current.performAction('order_create', 'ref-b', 'order');
      });

      // Both should be in-flight (consumeCredits called twice)
      expect(mockConsumeCredits).toHaveBeenCalledTimes(2);

      // Resolve both
      let menuResult: unknown;
      let orderResult: unknown;
      await act(async () => {
        resolveMenu({ success: true, newBalance: 4900, creditsCost: 100 });
        resolveOrder({ success: true, newBalance: 4850, creditsCost: 50 });
        menuResult = await menuPromise!;
        orderResult = await orderPromise!;
      });

      expect((menuResult as { success: boolean }).success).toBe(true);
      expect((orderResult as { success: boolean }).success).toBe(true);
    });

    it('should allow concurrent calls with same actionKey but different referenceIds', async () => {
      let resolveA!: (value: unknown) => void;
      let resolveB!: (value: unknown) => void;

      mockConsumeCredits
        .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
        .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      let promiseA: Promise<unknown>;
      let promiseB: Promise<unknown>;

      act(() => {
        promiseA = result.current.performAction('menu_create', 'menu-111');
        promiseB = result.current.performAction('menu_create', 'menu-222');
      });

      // Both should proceed (different referenceIds = different idempotency keys)
      expect(mockConsumeCredits).toHaveBeenCalledTimes(2);

      let resultA: unknown;
      let resultB: unknown;
      await act(async () => {
        resolveA({ success: true, newBalance: 4900, creditsCost: 100 });
        resolveB({ success: true, newBalance: 4800, creditsCost: 100 });
        resultA = await promiseA!;
        resultB = await promiseB!;
      });

      expect((resultA as { success: boolean }).success).toBe(true);
      expect((resultB as { success: boolean }).success).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Key cleanup on error (finally block)
  // ==========================================================================

  describe('key cleanup on error', () => {
    it('should remove idempotency key from in-flight set even when consumeCredits throws', async () => {
      mockConsumeCredits.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      // First call — will throw
      await act(async () => {
        try {
          await result.current.performAction('menu_create', 'ref-err', 'menu');
        } catch {
          // Expected
        }
      });

      // Second call with same key should NOT be blocked (key cleaned up in finally)
      mockConsumeCredits.mockResolvedValueOnce({
        success: true,
        newBalance: 4900,
        creditsCost: 100,
      });

      let retryResult: unknown;
      await act(async () => {
        retryResult = await result.current.performAction('menu_create', 'ref-err', 'menu');
      });

      expect((retryResult as { success: boolean }).success).toBe(true);
      expect(mockConsumeCredits).toHaveBeenCalledTimes(2);
    });

    it('should remove idempotency key when consumeCredits returns failure (not throw)', async () => {
      mockConsumeCredits.mockResolvedValueOnce({
        success: false,
        newBalance: 5000,
        creditsCost: 0,
        errorMessage: 'Insufficient credits',
      });

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      // First call — will fail
      let failResult: unknown;
      await act(async () => {
        failResult = await result.current.performAction('menu_create', 'ref-fail');
      });
      expect((failResult as { success: boolean }).success).toBe(false);

      // Second call with same key should proceed (key cleaned up)
      mockConsumeCredits.mockResolvedValueOnce({
        success: true,
        newBalance: 4900,
        creditsCost: 100,
      });

      let retryResult: unknown;
      await act(async () => {
        retryResult = await result.current.performAction('menu_create', 'ref-fail');
      });

      expect((retryResult as { success: boolean }).success).toBe(true);
      expect(mockConsumeCredits).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // 5. Client-side rate limiting
  // ==========================================================================

  describe('client-side rate limiting', () => {
    it('should block when more than 30 operations in 60 seconds', async () => {
      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      // Fire 30 operations — each with unique referenceId to avoid idempotency block
      for (let i = 0; i < 30; i++) {
        mockConsumeCredits.mockResolvedValueOnce({
          success: true,
          newBalance: 5000 - (i * 100),
          creditsCost: 100,
        });

        await act(async () => {
          await result.current.performAction('menu_create', `ref-rate-${i}`);
        });
      }

      // 31st operation should be rate limited
      let rateLimitedResult: unknown;
      await act(async () => {
        rateLimitedResult = await result.current.performAction('menu_create', 'ref-rate-30');
      });

      expect((rateLimitedResult as { success: boolean }).success).toBe(false);
      expect((rateLimitedResult as { errorMessage: string }).errorMessage).toBe(
        'Too many requests. Please wait a moment.'
      );

      // consumeCredits should have been called exactly 30 times (not 31)
      expect(mockConsumeCredits).toHaveBeenCalledTimes(30);

      expect(logger.warn).toHaveBeenCalledWith(
        'Client-side rate limit exceeded',
        expect.objectContaining({ actionKey: 'menu_create' })
      );
    });
  });

  // ==========================================================================
  // 6. No tenant returns early
  // ==========================================================================

  describe('no tenant early return', () => {
    it('should return error when no tenant is available', async () => {
      mockTenantAdminAuth.mockReturnValue({
        tenant: null,
        tenantSlug: null,
        isAuthenticated: false,
        accessToken: null,
      });

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      let noTenantResult: unknown;
      await act(async () => {
        noTenantResult = await result.current.performAction('menu_create', 'ref-no-tenant');
      });

      expect((noTenantResult as { success: boolean }).success).toBe(false);
      expect((noTenantResult as { errorMessage: string }).errorMessage).toBe('No tenant found');
      expect(mockConsumeCredits).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 7. Non-free-tier skips credit consumption
  // ==========================================================================

  describe('non-free-tier bypass', () => {
    it('should return success without consuming credits for paid tier', async () => {
      mockTenantAdminAuth.mockReturnValue({
        tenant: {
          id: 'paid-tenant',
          slug: 'paid-tenant',
          subscription_plan: 'professional',
          is_free_tier: false,
        },
        tenantSlug: 'paid-tenant',
        isAuthenticated: true,
        accessToken: 'mock-token',
      });

      // Mock the edge function to return non-free tier
      const { supabase } = await import('@/integrations/supabase/client');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          balance: 0,
          lifetimeStats: { earned: 0, spent: 0, purchased: 0, expired: 0, refunded: 0 },
          subscription: {
            status: 'active',
            isFreeTier: false,
            creditsPerPeriod: 0,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
          nextFreeGrantAt: null,
          pendingTransactions: 0,
        },
        error: null,
      });

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      let paidResult: unknown;
      await act(async () => {
        paidResult = await result.current.performAction('menu_create', 'ref-paid');
      });

      expect((paidResult as { success: boolean }).success).toBe(true);
      expect((paidResult as { creditsCost: number }).creditsCost).toBe(0);
      expect(mockConsumeCredits).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 8. Idempotency key format verification
  // ==========================================================================

  describe('idempotency key format', () => {
    it('should use actionKey:referenceId format for the key', async () => {
      let resolveFirst!: (value: unknown) => void;
      mockConsumeCredits.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; })
      );

      const { result } = renderHook(() => useCredits(), {
        wrapper: createWrapper(),
      });

      // Start action with specific referenceId
      let firstPromise: Promise<unknown>;
      act(() => {
        firstPromise = result.current.performAction('menu_create', 'menu-abc');
      });

      // Different actionKey with same referenceId should NOT be blocked
      mockConsumeCredits.mockResolvedValueOnce({
        success: true,
        newBalance: 4950,
        creditsCost: 50,
      });

      let differentActionResult: unknown;
      await act(async () => {
        differentActionResult = await result.current.performAction('order_create', 'menu-abc');
      });

      // Should succeed — different action key means different idempotency key
      expect((differentActionResult as { success: boolean }).success).toBe(true);

      // Cleanup
      await act(async () => {
        resolveFirst({ success: true, newBalance: 4900, creditsCost: 100 });
        await firstPromise!;
      });
    });
  });
});
