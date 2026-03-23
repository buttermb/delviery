/**
 * useCredits Realtime Subscription Tests
 *
 * Verifies that the useCredits hook correctly:
 * 1. Creates a Supabase Realtime channel scoped to tenant_id
 * 2. Subscribes to tenant_credits changes (all events)
 * 3. Subscribes to credit_transactions inserts
 * 4. Invalidates credit queries on change events
 * 5. Cleans up the channel on unmount
 * 6. Does not subscribe when tenantId is missing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Hoisted mocks — vi.mock factories are hoisted, so any variables they
// reference must also be hoisted via vi.hoisted().
// ============================================================================

interface OnCall {
  event: string;
  schema: string;
  table: string;
  filter: string;
  callback: () => void;
}

const {
  mockSubscribe,
  mockRemoveChannel,
  mockInvalidateQueries,
  mockChannel,
  mockOn,
  onCallsRef,
} = vi.hoisted(() => {
  const onCallsRef = { current: [] as OnCall[] };

  const mockSubscribe = vi.fn().mockReturnThis();
  const mockRemoveChannel = vi.fn();
  const mockInvalidateQueries = vi.fn();

  const mockOn = vi.fn(
    (
      _type: string,
      config: { event: string; schema: string; table: string; filter: string },
      callback: () => void,
    ) => {
      onCallsRef.current.push({
        event: config.event,
        schema: config.schema,
        table: config.table,
        filter: config.filter,
        callback,
      });
      // Return chainable object
      return { on: mockOn, subscribe: mockSubscribe };
    },
  );

  const mockChannel = vi.fn(() => ({
    on: mockOn,
    subscribe: mockSubscribe,
  }));

  return {
    mockSubscribe,
    mockRemoveChannel,
    mockInvalidateQueries,
    mockChannel,
    mockOn,
    onCallsRef,
  };
});

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: {
          balance: 250,
          lifetimeStats: {
            earned: 500,
            spent: 250,
            purchased: 0,
            expired: 0,
            refunded: 0,
          },
          subscription: {
            status: 'active',
            isFreeTier: true,
            creditsPerPeriod: 500,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
          nextFreeGrantAt: null,
          pendingTransactions: 0,
        },
        error: null,
      }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'tenant-abc-123' },
    isAuthenticated: true,
    accessToken: 'mock-token',
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

vi.mock('@/components/credits/CreditDeductionToast', () => ({
  showCreditDeductionToast: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((e: unknown) => String(e)),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useCredits } from '@/hooks/useCredits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';

// ============================================================================
// Test wrapper
// ============================================================================

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.invalidateQueries = mockInvalidateQueries;

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useCredits Realtime Subscription', () => {
  beforeEach(() => {
    onCallsRef.current = [];
    mockChannel.mockClear();
    mockOn.mockClear();
    mockSubscribe.mockClear();
    mockRemoveChannel.mockClear();
    mockInvalidateQueries.mockClear();

    // Restore default tenant mock
    vi.mocked(useTenantAdminAuth).mockReturnValue({
      tenant: { id: 'tenant-abc-123' },
      isAuthenticated: true,
      accessToken: 'mock-token',
    } as ReturnType<typeof useTenantAdminAuth>);
  });

  it('should create a channel scoped to the tenant id', () => {
    renderHook(() => useCredits(), { wrapper: createWrapper() });
    expect(mockChannel).toHaveBeenCalledWith('credits:tenant-abc-123');
  });

  it('should subscribe to tenant_credits table for all change events', () => {
    renderHook(() => useCredits(), { wrapper: createWrapper() });

    const sub = onCallsRef.current.find((c) => c.table === 'tenant_credits');
    expect(sub).toBeDefined();
    expect(sub!.event).toBe('*');
    expect(sub!.schema).toBe('public');
    expect(sub!.filter).toBe('tenant_id=eq.tenant-abc-123');
  });

  it('should subscribe to credit_transactions table for INSERT events', () => {
    renderHook(() => useCredits(), { wrapper: createWrapper() });

    const sub = onCallsRef.current.find(
      (c) => c.table === 'credit_transactions',
    );
    expect(sub).toBeDefined();
    expect(sub!.event).toBe('INSERT');
    expect(sub!.schema).toBe('public');
    expect(sub!.filter).toBe('tenant_id=eq.tenant-abc-123');
  });

  it('should call subscribe on the channel', () => {
    renderHook(() => useCredits(), { wrapper: createWrapper() });
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('should invalidate all credit queries when tenant_credits changes', () => {
    renderHook(() => useCredits(), { wrapper: createWrapper() });

    const sub = onCallsRef.current.find((c) => c.table === 'tenant_credits');
    expect(sub).toBeDefined();

    act(() => {
      sub!.callback();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.credits.all,
    });
  });

  it('should invalidate all credit queries when credit_transactions insert arrives', () => {
    renderHook(() => useCredits(), { wrapper: createWrapper() });

    const sub = onCallsRef.current.find(
      (c) => c.table === 'credit_transactions',
    );
    expect(sub).toBeDefined();

    act(() => {
      sub!.callback();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.credits.all,
    });
  });

  it('should remove the channel on unmount', () => {
    const { unmount } = renderHook(() => useCredits(), {
      wrapper: createWrapper(),
    });

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it('should not create a channel when tenantId is missing', () => {
    vi.mocked(useTenantAdminAuth).mockReturnValue({
      tenant: null,
      isAuthenticated: false,
      accessToken: null,
    } as ReturnType<typeof useTenantAdminAuth>);

    renderHook(() => useCredits(), { wrapper: createWrapper() });

    expect(mockChannel).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('should recreate channel when tenantId changes', () => {
    const { rerender } = renderHook(() => useCredits(), {
      wrapper: createWrapper(),
    });

    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel).toHaveBeenCalledWith('credits:tenant-abc-123');

    vi.mocked(useTenantAdminAuth).mockReturnValue({
      tenant: { id: 'tenant-xyz-789' },
      isAuthenticated: true,
      accessToken: 'mock-token-2',
    } as ReturnType<typeof useTenantAdminAuth>);

    rerender();

    expect(mockRemoveChannel).toHaveBeenCalled();
    expect(mockChannel).toHaveBeenCalledWith('credits:tenant-xyz-789');
  });

  it('should filter both subscriptions by tenant_id', () => {
    renderHook(() => useCredits(), { wrapper: createWrapper() });

    expect(onCallsRef.current.length).toBeGreaterThanOrEqual(2);
    for (const call of onCallsRef.current) {
      expect(call.filter).toMatch(/^tenant_id=eq\./);
    }
  });
});
