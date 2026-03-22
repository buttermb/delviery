/**
 * Credit Test Utilities Tests
 *
 * Validates the mock factories, render helpers, and assertion helpers
 * in creditMocks.ts behave correctly for testing credit-gated components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import {
  mockUseCredits,
  mockInsufficientCredits,
  mockPaidTierCredits,
  mockUseCreditGatedAction,
  renderWithCredits,
  expectCreditGateShown,
  expectCreditGateHidden,
  expectCreditCostBadge,
  MOCK_TENANT_AUTH,
  MOCK_LOGGER,
  MOCK_TOAST,
} from '@/test-utils/creditMocks';

// ============================================================================
// mockUseCredits
// ============================================================================

describe('mockUseCredits', () => {
  it('should return default values when called with no config', () => {
    const result = mockUseCredits();

    expect(result.balance).toBe(1000);
    expect(result.isFreeTier).toBe(true);
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(result.lifetimeStats).toEqual({
      earned: 1000,
      spent: 0,
      purchased: 0,
      expired: 0,
      refunded: 0,
    });
    expect(result.subscription.isFreeTier).toBe(true);
    expect(result.nextFreeGrantAt).toBeNull();
  });

  it('should override balance', () => {
    const result = mockUseCredits({ balance: 500 });
    expect(result.balance).toBe(500);
  });

  it('should override isFreeTier', () => {
    const result = mockUseCredits({ isFreeTier: false });
    expect(result.isFreeTier).toBe(false);
    expect(result.subscription.isFreeTier).toBe(false);
  });

  it('should derive isLowCredits from balance when not explicitly set', () => {
    const highBalance = mockUseCredits({ balance: 5000 });
    expect(highBalance.isLowCredits).toBe(false);

    const lowBalance = mockUseCredits({ balance: 1500 });
    expect(lowBalance.isLowCredits).toBe(true);

    const zeroBalance = mockUseCredits({ balance: 0 });
    expect(zeroBalance.isLowCredits).toBe(true);
  });

  it('should derive isCriticalCredits from balance when not explicitly set', () => {
    const highBalance = mockUseCredits({ balance: 500 });
    expect(highBalance.isCriticalCredits).toBe(false);

    const criticalBalance = mockUseCredits({ balance: 50 });
    expect(criticalBalance.isCriticalCredits).toBe(true);
  });

  it('should derive isOutOfCredits from balance when not explicitly set', () => {
    const hasBalance = mockUseCredits({ balance: 10 });
    expect(hasBalance.isOutOfCredits).toBe(false);

    const noBalance = mockUseCredits({ balance: 0 });
    expect(noBalance.isOutOfCredits).toBe(true);
  });

  it('should allow explicit override of status flags', () => {
    const result = mockUseCredits({
      balance: 5000,
      isLowCredits: true,
      isCriticalCredits: true,
      isOutOfCredits: true,
    });
    expect(result.isLowCredits).toBe(true);
    expect(result.isCriticalCredits).toBe(true);
    expect(result.isOutOfCredits).toBe(true);
  });

  it('should accept canPerformAction as boolean', () => {
    const blocked = mockUseCredits({ canPerformAction: false });
    expect(blocked.canPerformAction).toBeTypeOf('function');
  });

  it('should accept canPerformAction as mock function', () => {
    const customMock = vi.fn().mockResolvedValue(true);
    const result = mockUseCredits({ canPerformAction: customMock });
    expect(result.canPerformAction).toBe(customMock);
  });

  it('should accept custom performAction mock', () => {
    const customPerform = vi.fn().mockResolvedValue({
      success: true,
      newBalance: 900,
      creditsCost: 100,
    });
    const result = mockUseCredits({ performAction: customPerform });
    expect(result.performAction).toBe(customPerform);
  });

  it('should merge partial lifetimeStats with defaults', () => {
    const result = mockUseCredits({ lifetimeStats: { spent: 250 } });
    expect(result.lifetimeStats.earned).toBe(1000);
    expect(result.lifetimeStats.spent).toBe(250);
    expect(result.lifetimeStats.purchased).toBe(0);
  });

  it('should merge partial subscription with defaults', () => {
    const result = mockUseCredits({
      subscription: { status: 'active', currentPeriodEnd: '2026-12-31' },
    });
    expect(result.subscription.status).toBe('active');
    expect(result.subscription.currentPeriodEnd).toBe('2026-12-31');
    expect(result.subscription.creditsPerPeriod).toBe(500);
  });

  it('should calculate percentUsed from lifetimeStats', () => {
    const result = mockUseCredits({
      lifetimeStats: { earned: 1000, spent: 400 },
    });
    expect(result.percentUsed).toBe(40);
  });

  it('should provide hasCredits function that respects balance', () => {
    const result = mockUseCredits({ balance: 100 });
    expect(result.hasCredits(50)).toBe(true);
    expect(result.hasCredits(100)).toBe(true);
    expect(result.hasCredits(101)).toBe(false);
  });

  it('should provide hasCredits that always returns true for paid tier', () => {
    const result = mockUseCredits({ balance: 0, isFreeTier: false });
    expect(result.hasCredits(1000)).toBe(true);
  });

  it('should provide refetch and invalidate as mock functions', () => {
    const result = mockUseCredits();
    expect(vi.isMockFunction(result.refetch)).toBe(true);
    expect(vi.isMockFunction(result.invalidate)).toBe(true);
  });
});

// ============================================================================
// mockInsufficientCredits
// ============================================================================

describe('mockInsufficientCredits', () => {
  it('should return 0 balance', () => {
    const result = mockInsufficientCredits();
    expect(result.balance).toBe(0);
  });

  it('should be on free tier', () => {
    const result = mockInsufficientCredits();
    expect(result.isFreeTier).toBe(true);
  });

  it('should have all warning flags set', () => {
    const result = mockInsufficientCredits();
    expect(result.isOutOfCredits).toBe(true);
    expect(result.isCriticalCredits).toBe(true);
    expect(result.isLowCredits).toBe(true);
  });

  it('should block canPerformAction', async () => {
    const result = mockInsufficientCredits();
    const canDo = await result.canPerformAction('menu_create');
    expect(canDo).toBe(false);
  });

  it('should return failure from performAction', async () => {
    const result = mockInsufficientCredits();
    const actionResult = await result.performAction('menu_create');
    expect(actionResult.success).toBe(false);
    expect(actionResult.errorMessage).toBe('Insufficient credits');
  });
});

// ============================================================================
// mockPaidTierCredits
// ============================================================================

describe('mockPaidTierCredits', () => {
  it('should not be on free tier', () => {
    const result = mockPaidTierCredits();
    expect(result.isFreeTier).toBe(false);
  });

  it('should not show any warning flags', () => {
    const result = mockPaidTierCredits();
    expect(result.isOutOfCredits).toBe(false);
    expect(result.isCriticalCredits).toBe(false);
    expect(result.isLowCredits).toBe(false);
  });

  it('should allow canPerformAction', async () => {
    const result = mockPaidTierCredits();
    const canDo = await result.canPerformAction('menu_create');
    expect(canDo).toBe(true);
  });

  it('should return success from performAction with 0 cost', async () => {
    const result = mockPaidTierCredits();
    const actionResult = await result.performAction('menu_create');
    expect(actionResult.success).toBe(true);
    expect(actionResult.creditsCost).toBe(0);
  });
});

// ============================================================================
// mockUseCreditGatedAction
// ============================================================================

describe('mockUseCreditGatedAction', () => {
  it('should return default values', () => {
    const result = mockUseCreditGatedAction();
    expect(result.balance).toBe(1000);
    expect(result.isFreeTier).toBe(true);
    expect(result.isExecuting).toBe(false);
    expect(result.showOutOfCreditsModal).toBe(false);
    expect(result.blockedAction).toBeNull();
  });

  it('should override balance', () => {
    const result = mockUseCreditGatedAction({ balance: 0 });
    expect(result.balance).toBe(0);
  });

  it('should override isExecuting', () => {
    const result = mockUseCreditGatedAction({ isExecuting: true });
    expect(result.isExecuting).toBe(true);
  });

  it('should override showOutOfCreditsModal', () => {
    const result = mockUseCreditGatedAction({ showOutOfCreditsModal: true });
    expect(result.showOutOfCreditsModal).toBe(true);
  });

  it('should override blockedAction', () => {
    const result = mockUseCreditGatedAction({ blockedAction: 'menu_create' });
    expect(result.blockedAction).toBe('menu_create');
  });

  it('should provide execute as a mock function', () => {
    const result = mockUseCreditGatedAction();
    expect(vi.isMockFunction(result.execute)).toBe(true);
  });

  it('should provide closeOutOfCreditsModal as a mock function', () => {
    const result = mockUseCreditGatedAction();
    expect(vi.isMockFunction(result.closeOutOfCreditsModal)).toBe(true);
  });

  it('should return blocked result when balance is 0 and free tier', async () => {
    const result = mockUseCreditGatedAction({ balance: 0, isFreeTier: true });
    const executeResult = await result.execute({
      actionKey: 'test',
      action: vi.fn(),
    });
    expect(executeResult.wasBlocked).toBe(true);
    expect(executeResult.success).toBe(false);
  });
});

// ============================================================================
// renderWithCredits
// ============================================================================

describe('renderWithCredits', () => {
  it('should render a simple component', () => {
    renderWithCredits(<div data-testid="test-child">Hello</div>);
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should return queryClient for test assertions', () => {
    const { queryClient } = renderWithCredits(<div>Test</div>);
    expect(queryClient).toBeDefined();
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
  });

  it('should accept additional render options', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderWithCredits(<div data-testid="custom-container">Test</div>, {
      container,
    });
    expect(screen.getByTestId('custom-container')).toBeInTheDocument();

    document.body.removeChild(container);
  });
});

// ============================================================================
// Assertion Helpers
// ============================================================================

describe('expectCreditGateShown', () => {
  it('should pass when OutOfCreditsModal text is present', () => {
    renderWithCredits(
      <div>
        <h2>You&apos;re Out of Credits</h2>
      </div>
    );
    expectCreditGateShown();
  });

  it('should fail when OutOfCreditsModal text is absent', () => {
    renderWithCredits(<div>Other content</div>);
    expect(() => expectCreditGateShown()).toThrow();
  });
});

describe('expectCreditGateHidden', () => {
  it('should pass when OutOfCreditsModal text is absent', () => {
    renderWithCredits(<div>Other content</div>);
    expectCreditGateHidden();
  });

  it('should fail when OutOfCreditsModal text is present', () => {
    renderWithCredits(
      <div>
        <h2>You&apos;re Out of Credits</h2>
      </div>
    );
    expect(() => expectCreditGateHidden()).toThrow();
  });
});

describe('expectCreditCostBadge', () => {
  it('should pass when credit cost badge text is present', () => {
    renderWithCredits(<div>100 cr</div>);
    expectCreditCostBadge(100);
  });

  it('should match case-insensitively', () => {
    renderWithCredits(<div>100 CR</div>);
    expectCreditCostBadge(100);
  });

  it('should match with no space before cr', () => {
    renderWithCredits(<div>25cr</div>);
    expectCreditCostBadge(25);
  });

  it('should fail when badge is absent', () => {
    renderWithCredits(<div>Other content</div>);
    expect(() => expectCreditCostBadge(100)).toThrow();
  });

  it('should fail when wrong cost is shown', () => {
    renderWithCredits(<div>50 cr</div>);
    expect(() => expectCreditCostBadge(100)).toThrow();
  });
});

// ============================================================================
// Constants
// ============================================================================

describe('MOCK_TENANT_AUTH', () => {
  it('should have required fields', () => {
    expect(MOCK_TENANT_AUTH.tenant.id).toBe('test-tenant-id');
    expect(MOCK_TENANT_AUTH.tenant.slug).toBe('test-tenant');
    expect(MOCK_TENANT_AUTH.tenantSlug).toBe('test-tenant');
    expect(MOCK_TENANT_AUTH.isAuthenticated).toBe(true);
  });
});

describe('MOCK_LOGGER', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have all log methods as mocks', () => {
    expect(vi.isMockFunction(MOCK_LOGGER.info)).toBe(true);
    expect(vi.isMockFunction(MOCK_LOGGER.warn)).toBe(true);
    expect(vi.isMockFunction(MOCK_LOGGER.error)).toBe(true);
    expect(vi.isMockFunction(MOCK_LOGGER.debug)).toBe(true);
  });
});

describe('MOCK_TOAST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have all toast methods as mocks', () => {
    expect(vi.isMockFunction(MOCK_TOAST.success)).toBe(true);
    expect(vi.isMockFunction(MOCK_TOAST.error)).toBe(true);
    expect(vi.isMockFunction(MOCK_TOAST.warning)).toBe(true);
    expect(vi.isMockFunction(MOCK_TOAST.info)).toBe(true);
  });
});
