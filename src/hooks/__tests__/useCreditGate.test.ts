/**
 * useCreditGate Hook Tests
 *
 * Tests for the lightweight mutation credit gating hook:
 * 1. Free actions pass through without credit check
 * 2. Non-free-tier users bypass credit gate
 * 3. Insufficient credits throws CreditGateError
 * 4. Successful flow: consume credits then execute mutation
 * 5. Credit consumption failure throws CreditGateError
 * 6. canAfford reflects balance vs cost
 * 7. onInsufficientCredits callback fires on block
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ============================================================================
// Mocks
// ============================================================================

const mockHasCredits = vi.fn();
const mockPerformAction = vi.fn();

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    hasCredits: mockHasCredits,
    performAction: mockPerformAction,
  })),
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((actionKey: string) => {
    const costs: Record<string, number> = {
      order_create_manual: 50,
      menu_create: 100,
      dashboard_view: 0,
      menu_ocr: 250,
    };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn((actionKey: string) => {
    const infos: Record<string, { actionName: string; credits: number }> = {
      order_create_manual: { actionName: 'Create Manual Order', credits: 50 },
      menu_create: { actionName: 'Create Menu', credits: 100 },
      menu_ocr: { actionName: 'Menu OCR Scan', credits: 250 },
    };
    return infos[actionKey] ?? null;
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// Import after mocks
// ============================================================================

import { useCreditGate, CreditGateError } from '../useCreditGate';
import { useCredits } from '@/hooks/useCredits';

describe('useCreditGate', () => {
  beforeEach(() => {
    // Reset only call counts, not implementations set by vi.mock factories
    mockHasCredits.mockClear();
    mockPerformAction.mockClear();
    // Re-apply default mock behaviors
    mockHasCredits.mockReturnValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 950,
      creditsCost: 50,
    });
    // Restore the useCredits default mock
    vi.mocked(useCredits).mockImplementation(() => ({
      balance: 1000,
      isFreeTier: true,
      hasCredits: mockHasCredits,
      performAction: mockPerformAction,
    } as unknown as ReturnType<typeof useCredits>));
  });

  // ==========================================================================
  // Basic return values
  // ==========================================================================

  describe('Return values', () => {
    it('should return cost for the action', () => {
      const { result } = renderHook(() => useCreditGate('order_create_manual'));
      expect(result.current.cost).toBe(50);
    });

    it('should return actionName for known actions', () => {
      const { result } = renderHook(() => useCreditGate('order_create_manual'));
      expect(result.current.actionName).toBe('Create Manual Order');
    });

    it('should return null actionName for unknown actions', () => {
      const { result } = renderHook(() => useCreditGate('unknown_action'));
      expect(result.current.actionName).toBeNull();
    });

    it('should return canAfford as true when balance is sufficient', () => {
      mockHasCredits.mockReturnValue(true);
      const { result } = renderHook(() => useCreditGate('order_create_manual'));
      expect(result.current.canAfford).toBe(true);
    });

    it('should return canAfford as false when balance is insufficient', () => {
      mockHasCredits.mockReturnValue(false);
      const { result } = renderHook(() => useCreditGate('menu_ocr'));
      expect(result.current.canAfford).toBe(false);
    });

    it('should return isFreeTier from useCredits', () => {
      const { result } = renderHook(() => useCreditGate('order_create_manual'));
      expect(result.current.isFreeTier).toBe(true);
    });

    it('should return balance from useCredits', () => {
      const { result } = renderHook(() => useCreditGate('order_create_manual'));
      expect(result.current.balance).toBe(1000);
    });
  });

  // ==========================================================================
  // Free actions pass through
  // ==========================================================================

  describe('Free actions', () => {
    it('should pass through free actions without credit check', async () => {
      const { result } = renderHook(() => useCreditGate('dashboard_view'));

      const mockFn = vi.fn().mockResolvedValue({ data: 'ok' });
      const gatedFn = result.current.gate(mockFn);

      const res = await gatedFn();

      expect(res).toEqual({ data: 'ok' });
      expect(mockFn).toHaveBeenCalledOnce();
      expect(mockPerformAction).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Non-free-tier bypass
  // ==========================================================================

  describe('Non-free-tier bypass', () => {
    it('should bypass credit gate for paid users', async () => {
      vi.mocked(useCredits).mockReturnValue({
        balance: 0,
        isFreeTier: false,
        hasCredits: vi.fn().mockReturnValue(false),
        performAction: mockPerformAction,
      } as unknown as ReturnType<typeof useCredits>);

      const { result } = renderHook(() => useCreditGate('order_create_manual'));

      expect(result.current.canAfford).toBe(true);

      const mockFn = vi.fn().mockResolvedValue({ id: 'order-1' });
      const gatedFn = result.current.gate(mockFn);

      const res = await gatedFn();

      expect(res).toEqual({ id: 'order-1' });
      expect(mockFn).toHaveBeenCalledOnce();
      expect(mockPerformAction).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Insufficient credits
  // ==========================================================================

  describe('Insufficient credits', () => {
    it('should throw CreditGateError when balance is insufficient', async () => {
      mockHasCredits.mockReturnValue(false);

      const { result } = renderHook(() => useCreditGate('menu_ocr'));

      const mockFn = vi.fn().mockResolvedValue({});
      const gatedFn = result.current.gate(mockFn);

      await expect(gatedFn()).rejects.toThrow(CreditGateError);
      expect(mockFn).not.toHaveBeenCalled();
      expect(mockPerformAction).not.toHaveBeenCalled();
    });

    it('should include correct details in CreditGateError', async () => {
      mockHasCredits.mockReturnValue(false);

      const { result } = renderHook(() => useCreditGate('menu_ocr'));
      const gatedFn = result.current.gate(vi.fn().mockResolvedValue({}));

      try {
        await gatedFn();
        expect.fail('Should have thrown');
      } catch (err) {
        const creditErr = err as CreditGateError;
        expect(creditErr.actionKey).toBe('menu_ocr');
        expect(creditErr.creditCost).toBe(250);
        expect(creditErr.currentBalance).toBe(1000);
      }
    });

    it('should call onInsufficientCredits callback', async () => {
      mockHasCredits.mockReturnValue(false);
      const onInsufficientCredits = vi.fn();

      const { result } = renderHook(() =>
        useCreditGate('menu_ocr', { onInsufficientCredits })
      );

      const gatedFn = result.current.gate(vi.fn().mockResolvedValue({}));

      await expect(gatedFn()).rejects.toThrow(CreditGateError);
      expect(onInsufficientCredits).toHaveBeenCalledWith('menu_ocr', 250, 1000);
    });
  });

  // ==========================================================================
  // Successful credit flow
  // ==========================================================================

  describe('Successful flow', () => {
    it('should consume credits then execute the mutation', async () => {
      const { result } = renderHook(() =>
        useCreditGate('order_create_manual', { referenceType: 'order' })
      );

      const mockFn = vi.fn().mockResolvedValue({ id: 'order-1' });
      const gatedFn = result.current.gate(mockFn);

      const res = await gatedFn({ name: 'Test Order' });

      // Credits consumed first
      expect(mockPerformAction).toHaveBeenCalledWith(
        'order_create_manual',
        undefined,
        'order'
      );

      // Then mutation executed
      expect(mockFn).toHaveBeenCalledWith({ name: 'Test Order' });
      expect(res).toEqual({ id: 'order-1' });
    });

    it('should pass through arguments to the wrapped function', async () => {
      const { result } = renderHook(() => useCreditGate('order_create_manual'));

      const mockFn = vi.fn().mockResolvedValue('done');
      const gatedFn = result.current.gate(mockFn);

      await gatedFn('arg1', 42, { key: 'value' });

      expect(mockFn).toHaveBeenCalledWith('arg1', 42, { key: 'value' });
    });
  });

  // ==========================================================================
  // Credit consumption failure
  // ==========================================================================

  describe('Credit consumption failure', () => {
    it('should throw CreditGateError when performAction fails', async () => {
      mockPerformAction.mockResolvedValue({
        success: false,
        newBalance: 1000,
        creditsCost: 0,
        errorMessage: 'Insufficient credits',
      });

      const onInsufficientCredits = vi.fn();
      const { result } = renderHook(() =>
        useCreditGate('order_create_manual', { onInsufficientCredits })
      );

      const mockFn = vi.fn().mockResolvedValue({});
      const gatedFn = result.current.gate(mockFn);

      await expect(gatedFn()).rejects.toThrow(CreditGateError);
      expect(mockFn).not.toHaveBeenCalled();
      expect(onInsufficientCredits).toHaveBeenCalledWith('order_create_manual', 50, 1000);
    });

    it('should not execute mutation when credit consumption fails', async () => {
      mockPerformAction.mockResolvedValue({
        success: false,
        errorMessage: 'Rate limit exceeded',
      });

      const { result } = renderHook(() => useCreditGate('order_create_manual'));

      const mockFn = vi.fn().mockResolvedValue({});
      const gatedFn = result.current.gate(mockFn);

      await expect(gatedFn()).rejects.toThrow(CreditGateError);
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Mutation errors propagate
  // ==========================================================================

  describe('Mutation error propagation', () => {
    it('should propagate mutation errors after credits are consumed', async () => {
      const { result } = renderHook(() => useCreditGate('order_create_manual'));

      const mutationError = new Error('Database constraint violation');
      const mockFn = vi.fn().mockRejectedValue(mutationError);
      const gatedFn = result.current.gate(mockFn);

      await expect(gatedFn()).rejects.toBe(mutationError);

      // Credits were consumed
      expect(mockPerformAction).toHaveBeenCalled();
      // Mutation was attempted
      expect(mockFn).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// CreditGateError tests
// ============================================================================

describe('CreditGateError', () => {
  it('should have correct properties', () => {
    const err = new CreditGateError('menu_create', 100, 50);
    expect(err.name).toBe('CreditGateError');
    expect(err.actionKey).toBe('menu_create');
    expect(err.creditCost).toBe(100);
    expect(err.currentBalance).toBe(50);
    expect(err.message).toBe(
      'Insufficient credits for menu_create: need 100, have 50'
    );
  });

  it('should use custom message when provided', () => {
    const err = new CreditGateError('menu_create', 100, 50, 'Custom error');
    expect(err.message).toBe('Custom error');
  });

  it('should be an instance of Error', () => {
    const err = new CreditGateError('menu_create', 100, 50);
    expect(err).toBeInstanceOf(Error);
  });
});
