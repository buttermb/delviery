/**
 * Test: useCreditGate hook allows action when sufficient credits
 *
 * Verifies that when a user has enough credits (balance: 1000),
 * executing a credit-gated action (menu_create, 100 credits):
 * 1. Calls canPerformAction to verify balance
 * 2. Executes the action callback
 * 3. Consumes credits via performAction
 * 4. Shows deduction toast with correct amount
 * 5. Returns success result with correct cost
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
const mockShowCreditDeductionToast = vi.fn();

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    isLoading: false,
    error: null,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    lifetimeEarned: 2000,
    lifetimeSpent: 1000,
    nextFreeGrantAt: null,
    percentUsed: 50,
    canPerformAction: mockCanPerformAction,
    performAction: mockPerformAction,
    refetch: vi.fn(),
    lifetimeStats: { earned: 2000, spent: 1000, purchased: 0, expired: 0, refunded: 0 },
    subscription: { status: 'active', isFreeTier: true, creditsPerPeriod: 1000, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    hasCredits: vi.fn().mockReturnValue(true),
    invalidate: vi.fn(),
  })),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  })),
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

vi.mock('@/components/credits/CreditDeductionToast', () => ({
  showCreditDeductionToast: mockShowCreditDeductionToast,
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((actionKey: string) => {
    const costs: Record<string, number> = {
      menu_create: 100,
      order_create_manual: 50,
      send_sms: 25,
      pos_process_sale: 25,
    };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn((actionKey: string) => {
    const infos: Record<string, { actionKey: string; actionName: string; credits: number; category: string }> = {
      menu_create: { actionKey: 'menu_create', actionName: 'Create Menu', credits: 100, category: 'menus' },
      order_create_manual: { actionKey: 'order_create_manual', actionName: 'Create Order', credits: 50, category: 'orders' },
      send_sms: { actionKey: 'send_sms', actionName: 'Send SMS', credits: 25, category: 'messaging' },
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

import { useCreditGatedAction } from '../useCreditGatedAction';
import { logger } from '@/lib/logger';

// ============================================================================
// Tests: useCreditGate allows action when sufficient credits
// ============================================================================

describe('useCreditGate allows action when sufficient credits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 900,
      creditsCost: 100,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should execute action callback when balance (1000) exceeds cost (100)', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const menuAction = vi.fn().mockResolvedValue({ menuId: 'menu-001' });

    let executeResult: Awaited<ReturnType<typeof result.current.execute>>;

    await act(async () => {
      executeResult = await result.current.execute({
        actionKey: 'menu_create',
        action: menuAction,
        referenceId: 'menu-001',
        referenceType: 'menu',
      });
    });

    // Action callback was invoked
    expect(menuAction).toHaveBeenCalledTimes(1);

    // Result indicates success
    expect(executeResult!.success).toBe(true);
    expect(executeResult!.result).toEqual({ menuId: 'menu-001' });
    expect(executeResult!.wasBlocked).toBe(false);
    expect(executeResult!.creditsCost).toBe(100);
  });

  it('should verify balance via canPerformAction before executing', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const menuAction = vi.fn().mockResolvedValue({ menuId: 'menu-002' });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: menuAction,
      });
    });

    // canPerformAction called with correct action key
    expect(mockCanPerformAction).toHaveBeenCalledWith('menu_create');
    expect(mockCanPerformAction).toHaveBeenCalledTimes(1);
    // action executed after check passed
    expect(menuAction).toHaveBeenCalled();
  });

  it('should consume credits via performAction with correct parameters', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
        referenceId: 'ref-123',
        referenceType: 'menu',
      });
    });

    expect(mockPerformAction).toHaveBeenCalledWith(
      'menu_create',
      'ref-123',
      'menu'
    );
  });

  it('should show deduction toast after successful credit consumption', async () => {
    // Configure performAction to simulate calling showCreditDeductionToast
    // as the real useCredits.performAction does
    mockPerformAction.mockImplementation(async () => {
      mockShowCreditDeductionToast(100, 'Create Menu', 900);
      return {
        success: true,
        newBalance: 900,
        creditsCost: 100,
      };
    });

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ menuId: 'menu-toast-test' }),
        referenceId: 'menu-toast-test',
        referenceType: 'menu',
      });
    });

    // Deduction toast was shown with correct values
    expect(mockShowCreditDeductionToast).toHaveBeenCalledWith(
      100,           // amount deducted
      'Create Menu', // action name
      900            // new balance
    );
  });

  it('should call onSuccess callback with action result', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const onSuccess = vi.fn();
    const menuAction = vi.fn().mockResolvedValue({ menuId: 'menu-003', url: '/menu/003' });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: menuAction,
        onSuccess,
      });
    });

    expect(onSuccess).toHaveBeenCalledWith({ menuId: 'menu-003', url: '/menu/003' });
  });

  it('should optimistically deduct credits in the UI before action completes', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    // setQueryData called for optimistic deduction
    expect(mockSetQueryData).toHaveBeenCalledWith(
      ['credits', 'balance', 'test-tenant-id'],
      expect.any(Function)
    );
  });

  it('should sync balance with server after successful execution', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['credits', 'balance', 'test-tenant-id'],
    });
  });

  it('should not show OutOfCreditsModal when credits are sufficient', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    expect(result.current.showOutOfCreditsModal).toBe(false);
    expect(result.current.blockedAction).toBe(null);
  });

  it('should reset isExecuting to false after action completes', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isExecuting).toBe(false);

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it('should log successful completion via logger', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Credit-gated action completed successfully',
      expect.objectContaining({
        actionKey: 'menu_create',
        creditsCost: 100,
        newBalance: 900,
      })
    );
  });

  it('should allow multiple sequential actions when credits are sufficient', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    // First action: menu_create (100 credits)
    mockPerformAction.mockResolvedValueOnce({
      success: true, newBalance: 900, creditsCost: 100,
    });
    const menuAction = vi.fn().mockResolvedValue({ menuId: 'm-1' });

    await act(async () => {
      const r1 = await result.current.execute({
        actionKey: 'menu_create',
        action: menuAction,
        referenceId: 'menu-seq-1',
        referenceType: 'menu',
      });
      expect(r1.success).toBe(true);
    });

    // Second action: send_sms (25 credits)
    mockPerformAction.mockResolvedValueOnce({
      success: true, newBalance: 875, creditsCost: 25,
    });
    const smsAction = vi.fn().mockResolvedValue({ smsId: 's-1' });

    await act(async () => {
      const r2 = await result.current.execute({
        actionKey: 'send_sms',
        action: smsAction,
        referenceId: 'sms-seq-1',
        referenceType: 'sms',
      });
      expect(r2.success).toBe(true);
    });

    expect(menuAction).toHaveBeenCalledTimes(1);
    expect(smsAction).toHaveBeenCalledTimes(1);
    expect(mockPerformAction).toHaveBeenCalledTimes(2);
  });
});
