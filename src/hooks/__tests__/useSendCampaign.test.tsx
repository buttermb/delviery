/**
 * useSendCampaign Hook Tests
 *
 * Tests for credit-gated campaign sending:
 * 1. Calculates total cost based on recipient count and campaign type
 * 2. Blocks send when balance < total cost for free tier users
 * 3. Allows send for non-free-tier users regardless of balance
 * 4. Delegates to useCreditGatedAction.execute for actual credit consumption
 * 5. Returns correct isSending, balance, isFreeTier state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockCanPerformAction = vi.fn();
const mockPerformAction = vi.fn();
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn();

// Mock useCredits
vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    canPerformAction: mockCanPerformAction,
    performAction: mockPerformAction,
  })),
}));

// Mock useTenantAdminAuth
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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

// Mock credit cost functions
vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((actionKey: string) => {
    const costs: Record<string, number> = {
      send_bulk_email: 8,
      send_bulk_sms: 20,
      menu_create: 100,
    };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn((actionKey: string) => {
    const infos: Record<string, { actionName: string; credits: number }> = {
      send_bulk_email: { actionName: 'Send Bulk Email', credits: 8 },
      send_bulk_sms: { actionName: 'Send Bulk SMS', credits: 20 },
    };
    return infos[actionKey] ?? null;
  }),
}));

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

  queryClient.setQueryData = mockSetQueryData;
  queryClient.invalidateQueries = mockInvalidateQueries;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Import after mocks
// ============================================================================

import { useSendCampaign } from '../useCreditGatedAction';
import { useCredits } from '@/hooks/useCredits';

describe('useSendCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 920,
      creditsCost: 8,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // 1. Email campaign cost calculation and execution
  // ==========================================================================

  describe('Email Campaign Sending', () => {
    it('should block send when total email cost exceeds balance', async () => {
      // Balance is 1000, 200 recipients * 8 credits = 1600 total (exceeds balance)
      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ success: true });
      const mockOnInsufficient = vi.fn();

      let sendResult: Awaited<ReturnType<typeof result.current.sendCampaign>>;
      await act(async () => {
        sendResult = await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-1',
          campaignType: 'email',
          recipientCount: 200,
          onInsufficientCredits: mockOnInsufficient,
        });
      });

      expect(mockAction).not.toHaveBeenCalled();
      expect(sendResult!.wasBlocked).toBe(true);
      expect(sendResult!.creditsCost).toBe(1600);
      expect(mockOnInsufficient).toHaveBeenCalled();
    });

    it('should allow send when total email cost is within balance', async () => {
      // Balance is 1000, 50 recipients * 8 credits = 400 total (within balance)
      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ success: true, sentCount: 50 });

      await act(async () => {
        await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-1',
          campaignType: 'email',
          recipientCount: 50,
        });
      });

      // Should have called canPerformAction via execute
      expect(mockCanPerformAction).toHaveBeenCalledWith('send_bulk_email');
    });
  });

  // ==========================================================================
  // 2. SMS campaign cost calculation and execution
  // ==========================================================================

  describe('SMS Campaign Sending', () => {
    it('should block send when total SMS cost exceeds balance', async () => {
      // Balance is 1000, 60 recipients * 20 credits = 1200 total (exceeds balance)
      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ success: true });
      const mockOnInsufficient = vi.fn();

      let sendResult: Awaited<ReturnType<typeof result.current.sendCampaign>>;
      await act(async () => {
        sendResult = await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-2',
          campaignType: 'sms',
          recipientCount: 60,
          onInsufficientCredits: mockOnInsufficient,
        });
      });

      expect(mockAction).not.toHaveBeenCalled();
      expect(sendResult!.wasBlocked).toBe(true);
      expect(sendResult!.creditsCost).toBe(1200);
      expect(mockOnInsufficient).toHaveBeenCalled();
    });

    it('should use send_bulk_sms action key for SMS campaigns', async () => {
      // Balance is 1000, 10 recipients * 20 = 200 (within balance)
      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ success: true });

      await act(async () => {
        await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-2',
          campaignType: 'sms',
          recipientCount: 10,
        });
      });

      expect(mockCanPerformAction).toHaveBeenCalledWith('send_bulk_sms');
    });
  });

  // ==========================================================================
  // 3. Non-free-tier users bypass credit checks
  // ==========================================================================

  describe('Non-Free-Tier Users', () => {
    it('should allow send for paid users regardless of balance', async () => {
      vi.mocked(useCredits).mockReturnValue({
        balance: 0,
        isFreeTier: false,
        isLoading: false,
        error: null,
        isLowCredits: false,
        isCriticalCredits: false,
        isOutOfCredits: false,
        lifetimeStats: { earned: 0, spent: 0, purchased: 0, expired: 0, refunded: 0 },
        subscription: {
          status: 'active',
          isFreeTier: false,
          creditsPerPeriod: 0,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        nextFreeGrantAt: null,
        percentUsed: 0,
        hasCredits: vi.fn().mockReturnValue(true),
        canPerformAction: mockCanPerformAction,
        performAction: mockPerformAction,
        refetch: vi.fn(),
        invalidate: vi.fn(),
      });

      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ success: true });

      await act(async () => {
        await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-3',
          campaignType: 'email',
          recipientCount: 10000, // Very large count
        });
      });

      // Should NOT be blocked even with 0 balance for paid users
      expect(result.current.isFreeTier).toBe(false);
      // The action should proceed to execute
      expect(mockAction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. Callbacks are invoked correctly
  // ==========================================================================

  describe('Callbacks', () => {
    it('should call onSuccess callback after successful send', async () => {
      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ sentCount: 25 });
      const mockOnSuccess = vi.fn();

      await act(async () => {
        await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-4',
          campaignType: 'email',
          recipientCount: 25,
          onSuccess: mockOnSuccess,
        });
      });

      expect(mockOnSuccess).toHaveBeenCalledWith({ sentCount: 25 });
    });

    it('should call onError callback when action fails', async () => {
      mockPerformAction.mockResolvedValue({
        success: true,
        newBalance: 800,
        creditsCost: 8,
      });

      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockRejectedValue(new Error('Network error'));
      const mockOnError = vi.fn();

      await act(async () => {
        await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-5',
          campaignType: 'email',
          recipientCount: 10,
          onError: mockOnError,
        });
      });

      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ==========================================================================
  // 5. Edge cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero recipients gracefully', async () => {
      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ success: true });

      await act(async () => {
        await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-6',
          campaignType: 'email',
          recipientCount: 0,
        });
      });

      // 0 * 8 = 0, which is within any balance, so it should proceed
      expect(mockCanPerformAction).toHaveBeenCalledWith('send_bulk_email');
    });

    it('should pass campaignId as referenceId for idempotency', async () => {
      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ success: true });

      await act(async () => {
        await result.current.sendCampaign(mockAction, {
          campaignId: 'campaign-unique-id',
          campaignType: 'email',
          recipientCount: 10,
        });
      });

      // The execute function should be called with the campaignId as referenceId
      // We verify this indirectly through performAction being called
      expect(mockPerformAction).toHaveBeenCalledWith(
        'send_bulk_email',
        'campaign-unique-id',
        'marketing_campaign'
      );
    });

    it('should expose balance and isFreeTier from underlying hook', () => {
      const { result } = renderHook(() => useSendCampaign(), {
        wrapper: createWrapper(),
      });

      expect(result.current.balance).toBe(1000);
      expect(result.current.isFreeTier).toBe(true);
      expect(result.current.isSending).toBe(false);
    });
  });
});
