/**
 * useCustomerLoyalty Credit Gate Tests
 *
 * Tests that loyalty reward issuance (redeemPoints) is gated behind
 * the 'loyalty_reward_issue' credit action (15 credits).
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
const mockExecuteCreditAction = vi.fn();

// Mock useCredits and useCreditGatedAction
vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    canPerformAction: mockCanPerformAction,
    performAction: mockPerformAction,
  })),
  useCreditGatedAction: vi.fn(() => ({
    execute: mockExecuteCreditAction,
    isPerforming: false,
    isFreeTier: true,
  })),
}));

// Mock useTenantAdminAuth
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    admin: { userId: 'test-admin-id' },
    tenantSlug: 'test-tenant',
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock humanizeError
vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((e: unknown) =>
    e instanceof Error ? e.message : 'Unknown error'
  ),
}));

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

// ============================================================================
// Import after mocks
// ============================================================================

import { usePointsMutations } from '@/hooks/useCustomerLoyalty';

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
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

describe('usePointsMutations - credit gating on redeemPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose isCreditGating state', () => {
    const { result } = renderHook(() => usePointsMutations(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCreditGating).toBe(false);
  });

  it('should call executeCreditAction with loyalty_reward_issue when redeemPoints is called', async () => {
    const mockTransaction = {
      id: 'tx-1',
      points: -50,
      type: 'redeemed',
      balance_after: 150,
    };

    mockExecuteCreditAction.mockResolvedValue(mockTransaction);

    const { result } = renderHook(() => usePointsMutations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.redeemPoints({
        customerId: 'customer-1',
        points: 50,
        orderId: 'order-123',
        description: 'Redeem reward',
      });
    });

    expect(mockExecuteCreditAction).toHaveBeenCalledWith(
      'loyalty_reward_issue',
      expect.any(Function),
      {
        referenceId: 'order-123',
        referenceType: 'loyalty_redemption',
      }
    );
  });

  it('should return null when credit gate blocks the action', async () => {
    mockExecuteCreditAction.mockResolvedValue(null);

    const { result } = renderHook(() => usePointsMutations(), {
      wrapper: createWrapper(),
    });

    let redeemResult: unknown;
    await act(async () => {
      redeemResult = await result.current.redeemPoints({
        customerId: 'customer-1',
        points: 50,
      });
    });

    expect(redeemResult).toBeNull();
    expect(mockExecuteCreditAction).toHaveBeenCalledWith(
      'loyalty_reward_issue',
      expect.any(Function),
      {
        referenceId: undefined,
        referenceType: 'loyalty_redemption',
      }
    );
  });

  it('should pass orderId as referenceId to credit gate', async () => {
    mockExecuteCreditAction.mockResolvedValue(null);

    const { result } = renderHook(() => usePointsMutations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.redeemPoints({
        customerId: 'customer-1',
        points: 100,
        orderId: 'order-456',
      });
    });

    expect(mockExecuteCreditAction).toHaveBeenCalledWith(
      'loyalty_reward_issue',
      expect.any(Function),
      {
        referenceId: 'order-456',
        referenceType: 'loyalty_redemption',
      }
    );
  });

  it('should return the credit-gated result on success', async () => {
    const mockTransaction = {
      id: 'tx-success',
      points: -75,
      type: 'redeemed',
      balance_after: 25,
    };

    mockExecuteCreditAction.mockResolvedValue(mockTransaction);

    const { result } = renderHook(() => usePointsMutations(), {
      wrapper: createWrapper(),
    });

    let redeemResult: unknown;
    await act(async () => {
      redeemResult = await result.current.redeemPoints({
        customerId: 'customer-1',
        points: 75,
      });
    });

    expect(redeemResult).toEqual(mockTransaction);
  });

  it('should NOT credit-gate awardPoints (only redeemPoints is gated)', async () => {
    const { result } = renderHook(() => usePointsMutations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.awardPoints({
        customerId: 'customer-1',
        points: 100,
        type: 'earned',
      }).catch(() => {
        // Expected - mutation may fail due to mock supabase
      });
    });

    // awardPoints should NOT call the credit action
    expect(mockExecuteCreditAction).not.toHaveBeenCalled();
  });

  it('should NOT credit-gate adjustPoints (only redeemPoints is gated)', async () => {
    const { result } = renderHook(() => usePointsMutations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.adjustPoints({
        customerId: 'customer-1',
        points: -10,
        reason: 'Manual adjustment',
      }).catch(() => {
        // Expected - mutation may fail due to mock supabase
      });
    });

    // adjustPoints should NOT call the credit action
    expect(mockExecuteCreditAction).not.toHaveBeenCalled();
  });
});
