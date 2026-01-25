/**
 * useCreditGatedAction Hook Tests
 *
 * Tests for credit-gated action flow:
 * 1. Checks balance before executing action
 * 2. Shows OutOfCreditsModal when insufficient
 * 3. Optimistic UI update deducts immediately
 * 4. Reverts on error
 * 5. Pre-configured hooks: useGenerateMenu, useCreateStorefront
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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
      menu_create: 100,
      marketplace_list_product: 25,
      test_action: 50,
      free_action: 0,
    };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn((actionKey: string) => {
    const infos: Record<string, { actionName: string; credits: number }> = {
      menu_create: { actionName: 'Create Menu', credits: 100 },
      marketplace_list_product: { actionName: 'List Product', credits: 25 },
      test_action: { actionName: 'Test Action', credits: 50 },
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

  // Mock setQueryData and invalidateQueries
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

import {
  useCreditGatedAction,
  useGenerateMenu,
  useCreateStorefront,
} from '../useCreditGatedAction';
import { useCredits } from '@/hooks/useCredits';

describe('useCreditGatedAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 950,
      creditsCost: 50,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // 1. Checks balance before executing action
  // ==========================================================================

  describe('Balance Checking', () => {
    it('should check balance before executing action', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ id: 'test-123' });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });
      });

      expect(mockCanPerformAction).toHaveBeenCalledWith('test_action');
      expect(mockAction).toHaveBeenCalled();
    });

    it('should not execute action when balance check fails', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ id: 'test-123' });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });
      });

      expect(mockCanPerformAction).toHaveBeenCalledWith('test_action');
      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should skip balance check for non-free-tier users', async () => {
      vi.mocked(useCredits).mockReturnValue({
        balance: 0,
        isFreeTier: false,
        isLoading: false,
        error: null,
        isLowCredits: false,
        isCriticalCredits: false,
        isOutOfCredits: false,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        nextFreeGrantAt: null,
        percentUsed: 0,
        canPerformAction: mockCanPerformAction,
        performAction: mockPerformAction,
        refetch: vi.fn(),
        lifetimeStats: { earned: 0, spent: 0, purchased: 0, expired: 0, refunded: 0 },
        subscription: { status: 'active', isFreeTier: false, creditsPerPeriod: 0, currentPeriodEnd: null, cancelAtPeriodEnd: false },
        hasCredits: vi.fn(() => false),
        invalidate: vi.fn(),
      });

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ id: 'test-123' });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });
      });

      // Should not call canPerformAction for non-free tier
      expect(mockCanPerformAction).not.toHaveBeenCalled();
      expect(mockAction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. Shows OutOfCreditsModal when insufficient
  // ==========================================================================

  describe('OutOfCreditsModal Integration', () => {
    it('should show modal when insufficient credits', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      expect(result.current.showOutOfCreditsModal).toBe(false);

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: vi.fn(),
        });
      });

      expect(result.current.showOutOfCreditsModal).toBe(true);
      expect(result.current.blockedAction).toBe('test_action');
    });

    it('should call onInsufficientCredits callback when blocked', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const onInsufficientCredits = vi.fn();

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: vi.fn(),
          onInsufficientCredits,
        });
      });

      expect(onInsufficientCredits).toHaveBeenCalledWith('test_action');
    });

    it('should not show modal when skipModal is true', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: vi.fn(),
          skipModal: true,
        });
      });

      expect(result.current.showOutOfCreditsModal).toBe(false);
    });

    it('should close modal when closeOutOfCreditsModal is called', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: vi.fn(),
        });
      });

      expect(result.current.showOutOfCreditsModal).toBe(true);

      act(() => {
        result.current.closeOutOfCreditsModal();
      });

      expect(result.current.showOutOfCreditsModal).toBe(false);
      expect(result.current.blockedAction).toBe(null);
    });

    it('should return wasBlocked: true when blocked due to insufficient credits', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      let executeResult: Awaited<ReturnType<typeof result.current.execute>>;

      await act(async () => {
        executeResult = await result.current.execute({
          actionKey: 'test_action',
          action: vi.fn(),
        });
      });

      expect(executeResult!.wasBlocked).toBe(true);
      expect(executeResult!.success).toBe(false);
    });
  });

  // ==========================================================================
  // 3. Optimistic UI update deducts immediately
  // ==========================================================================

  describe('Optimistic Updates', () => {
    it('should optimistically deduct credits before action completes', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 'test' }), 100))
      );

      await act(async () => {
        result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });

        // Give time for optimistic update
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Check that setQueryData was called for optimistic update
        expect(mockSetQueryData).toHaveBeenCalled();
      });

      // Finish the action
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    });

    it('should call setQueryData with deducted balance', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ id: 'test' });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });
      });

      // Verify setQueryData was called
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['credits', 'test-tenant-id'],
        expect.any(Function)
      );
    });
  });

  // ==========================================================================
  // 4. Reverts on error
  // ==========================================================================

  describe('Error Rollback', () => {
    it('should rollback credits when action fails', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockRejectedValue(new Error('Action failed'));

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });
      });

      // Verify setQueryData was called multiple times (optimistic + rollback)
      expect(mockSetQueryData).toHaveBeenCalledTimes(2);

      // Verify invalidateQueries was called to sync with server
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['credits', 'test-tenant-id'],
      });
    });

    it('should call onError callback when action fails', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const onError = vi.fn();
      const mockAction = vi.fn().mockRejectedValue(new Error('Test error'));

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
          onError,
        });
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should rollback when credit consumption fails', async () => {
      mockPerformAction.mockResolvedValue({
        success: false,
        errorMessage: 'Database error',
      });

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ id: 'test' });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });
      });

      // Verify rollback happened
      expect(mockSetQueryData).toHaveBeenCalledTimes(2);
      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should show modal when performAction returns insufficient credits error', async () => {
      mockPerformAction.mockResolvedValue({
        success: false,
        errorMessage: 'Insufficient credits',
      });

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: vi.fn(),
        });
      });

      expect(result.current.showOutOfCreditsModal).toBe(true);
      expect(result.current.blockedAction).toBe('test_action');
    });
  });

  // ==========================================================================
  // Successful Execution
  // ==========================================================================

  describe('Successful Execution', () => {
    it('should return success and result when action completes', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ id: 'result-123' });

      let executeResult: Awaited<ReturnType<typeof result.current.execute>>;

      await act(async () => {
        executeResult = await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });
      });

      expect(executeResult!.success).toBe(true);
      expect(executeResult!.result).toEqual({ id: 'result-123' });
      expect(executeResult!.wasBlocked).toBe(false);
    });

    it('should call onSuccess callback on successful completion', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const onSuccess = vi.fn();
      const mockAction = vi.fn().mockResolvedValue({ id: 'test' });

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
          onSuccess,
        });
      });

      expect(onSuccess).toHaveBeenCalledWith({ id: 'test' });
    });

    it('should set isExecuting to false after execution completes', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ id: 'test' });

      // Before execution
      expect(result.current.isExecuting).toBe(false);

      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
        });
      });

      // After execution completes
      expect(result.current.isExecuting).toBe(false);
      expect(mockAction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Duplicate Action Prevention
  // ==========================================================================

  describe('Duplicate Action Prevention', () => {
    it('should allow sequential actions with same key', async () => {
      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn().mockResolvedValue({ id: 'test' });

      // First action
      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
          referenceId: 'same-id',
        });
      });

      // Second action after first completes
      await act(async () => {
        await result.current.execute({
          actionKey: 'test_action',
          action: mockAction,
          referenceId: 'same-id',
        });
      });

      // Both should succeed since they're sequential
      expect(mockAction).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// 5. Pre-configured Hooks Tests
// ============================================================================

describe('useGenerateMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 900,
      creditsCost: 100,
    });

    vi.mocked(useCredits).mockReturnValue({
      balance: 1000,
      isFreeTier: true,
      isLoading: false,
      error: null,
      isLowCredits: false,
      isCriticalCredits: false,
      isOutOfCredits: false,
      lifetimeEarned: 1000,
      lifetimeSpent: 0,
      nextFreeGrantAt: null,
      percentUsed: 0,
      canPerformAction: mockCanPerformAction,
      performAction: mockPerformAction,
      refetch: vi.fn(),
      lifetimeStats: { earned: 1000, spent: 0, purchased: 0, expired: 0, refunded: 0 },
      subscription: { status: 'active', isFreeTier: true, creditsPerPeriod: 1000, currentPeriodEnd: null, cancelAtPeriodEnd: false },
      hasCredits: vi.fn(() => true),
      invalidate: vi.fn(),
    });
  });

  it('should use menu_create action key', async () => {
    const { result } = renderHook(() => useGenerateMenu(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn().mockResolvedValue({ menuId: 'menu-123' });

    await act(async () => {
      await result.current.generateMenu(mockAction);
    });

    expect(mockCanPerformAction).toHaveBeenCalledWith('menu_create');
    // When no menuId is provided, referenceId is undefined
    expect(mockPerformAction).toHaveBeenCalledWith(
      'menu_create',
      undefined,
      'menu'
    );
  });

  it('should pass menuId as referenceId', async () => {
    const { result } = renderHook(() => useGenerateMenu(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn().mockResolvedValue({ menuId: 'menu-123' });

    await act(async () => {
      await result.current.generateMenu(mockAction, { menuId: 'specific-menu-id' });
    });

    expect(mockPerformAction).toHaveBeenCalledWith(
      'menu_create',
      'specific-menu-id',
      'menu'
    );
  });

  it('should expose isGenerating state', async () => {
    const { result } = renderHook(() => useGenerateMenu(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isGenerating).toBe(false);
  });

  it('should show modal when insufficient credits for menu generation', async () => {
    mockCanPerformAction.mockResolvedValue(false);

    const { result } = renderHook(() => useGenerateMenu(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.generateMenu(vi.fn());
    });

    expect(result.current.showOutOfCreditsModal).toBe(true);
    expect(result.current.blockedAction).toBe('menu_create');
  });
});

describe('useCreateStorefront', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 975,
      creditsCost: 25,
    });

    vi.mocked(useCredits).mockReturnValue({
      balance: 1000,
      isFreeTier: true,
      isLoading: false,
      error: null,
      isLowCredits: false,
      isCriticalCredits: false,
      isOutOfCredits: false,
      lifetimeEarned: 1000,
      lifetimeSpent: 0,
      nextFreeGrantAt: null,
      percentUsed: 0,
      canPerformAction: mockCanPerformAction,
      performAction: mockPerformAction,
      refetch: vi.fn(),
      lifetimeStats: { earned: 1000, spent: 0, purchased: 0, expired: 0, refunded: 0 },
      subscription: { status: 'active', isFreeTier: true, creditsPerPeriod: 1000, currentPeriodEnd: null, cancelAtPeriodEnd: false },
      hasCredits: vi.fn(() => true),
      invalidate: vi.fn(),
    });
  });

  it('should use marketplace_list_product action key', async () => {
    const { result } = renderHook(() => useCreateStorefront(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn().mockResolvedValue({ storefrontId: 'store-123' });

    await act(async () => {
      await result.current.createStorefront(mockAction);
    });

    expect(mockCanPerformAction).toHaveBeenCalledWith('marketplace_list_product');
    // When no storefrontId is provided, referenceId is undefined
    expect(mockPerformAction).toHaveBeenCalledWith(
      'marketplace_list_product',
      undefined,
      'storefront'
    );
  });

  it('should pass storefrontId as referenceId', async () => {
    const { result } = renderHook(() => useCreateStorefront(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn().mockResolvedValue({ storefrontId: 'store-123' });

    await act(async () => {
      await result.current.createStorefront(mockAction, {
        storefrontId: 'specific-store-id',
      });
    });

    expect(mockPerformAction).toHaveBeenCalledWith(
      'marketplace_list_product',
      'specific-store-id',
      'storefront'
    );
  });

  it('should expose isCreating state', async () => {
    const { result } = renderHook(() => useCreateStorefront(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCreating).toBe(false);
  });

  it('should show modal when insufficient credits for storefront creation', async () => {
    mockCanPerformAction.mockResolvedValue(false);

    const { result } = renderHook(() => useCreateStorefront(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createStorefront(vi.fn());
    });

    expect(result.current.showOutOfCreditsModal).toBe(true);
    expect(result.current.blockedAction).toBe('marketplace_list_product');
  });
});

// ============================================================================
// Test Flow: Complete User Journey
// ============================================================================

describe('Complete User Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCredits).mockReturnValue({
      balance: 1000,
      isFreeTier: true,
      isLoading: false,
      error: null,
      isLowCredits: false,
      isCriticalCredits: false,
      isOutOfCredits: false,
      lifetimeEarned: 1000,
      lifetimeSpent: 0,
      nextFreeGrantAt: null,
      percentUsed: 0,
      canPerformAction: mockCanPerformAction,
      performAction: mockPerformAction,
      refetch: vi.fn(),
      lifetimeStats: { earned: 1000, spent: 0, purchased: 0, expired: 0, refunded: 0 },
      subscription: { status: 'active', isFreeTier: true, creditsPerPeriod: 1000, currentPeriodEnd: null, cancelAtPeriodEnd: false },
      hasCredits: vi.fn(() => true),
      invalidate: vi.fn(),
    });
  });

  it('should complete full flow: check -> deduct -> execute -> confirm', async () => {
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 950,
      creditsCost: 50,
    });

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const onSuccess = vi.fn();
    const mockAction = vi.fn().mockResolvedValue({ created: true });

    await act(async () => {
      await result.current.execute({
        actionKey: 'test_action',
        action: mockAction,
        onSuccess,
      });
    });

    // 1. Balance was checked
    expect(mockCanPerformAction).toHaveBeenCalledWith('test_action');

    // 2. Optimistic update happened
    expect(mockSetQueryData).toHaveBeenCalled();

    // 3. Credits were consumed (referenceId is undefined when not provided)
    expect(mockPerformAction).toHaveBeenCalledWith(
      'test_action',
      undefined,
      undefined
    );

    // 4. Action was executed
    expect(mockAction).toHaveBeenCalled();

    // 5. Success callback was called
    expect(onSuccess).toHaveBeenCalledWith({ created: true });

    // 6. Balance was synced with server
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['credits', 'test-tenant-id'],
    });
  });

  it('should complete flow when insufficient: check -> block -> show modal', async () => {
    mockCanPerformAction.mockResolvedValue(false);

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const onInsufficientCredits = vi.fn();
    const mockAction = vi.fn();

    await act(async () => {
      await result.current.execute({
        actionKey: 'test_action',
        action: mockAction,
        onInsufficientCredits,
      });
    });

    // 1. Balance was checked
    expect(mockCanPerformAction).toHaveBeenCalledWith('test_action');

    // 2. Action was NOT executed
    expect(mockAction).not.toHaveBeenCalled();

    // 3. Modal is shown
    expect(result.current.showOutOfCreditsModal).toBe(true);

    // 4. Blocked action is set
    expect(result.current.blockedAction).toBe('test_action');

    // 5. Callback was called
    expect(onInsufficientCredits).toHaveBeenCalledWith('test_action');
  });
});
