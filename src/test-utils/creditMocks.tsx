/**
 * Credit Test Utilities
 *
 * Helpers for testing credit-gated components and hooks.
 * Provides mock factories for useCredits, useCreditGatedAction,
 * and assertion helpers for credit-related UI behavior.
 */

import { type ReactElement } from 'react';
import { render, screen, type RenderOptions } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { UseCreditsReturn, LifetimeStats, SubscriptionInfo } from '@/hooks/useCredits';
import type { UseCreditGatedActionReturn } from '@/hooks/useCreditGatedAction';

// ============================================================================
// Types
// ============================================================================

export interface MockCreditsConfig {
  balance?: number;
  isFreeTier?: boolean;
  isLoading?: boolean;
  error?: Error | null;
  isLowCredits?: boolean;
  isCriticalCredits?: boolean;
  isOutOfCredits?: boolean;
  lifetimeStats?: Partial<LifetimeStats>;
  subscription?: Partial<SubscriptionInfo>;
  canPerformAction?: Mock | boolean;
  performAction?: Mock;
}

export interface RenderWithCreditsOptions extends Omit<RenderOptions, 'wrapper'> {
  balance?: number;
  isFreeTier?: boolean;
  creditsConfig?: MockCreditsConfig;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_LIFETIME_STATS: LifetimeStats = {
  earned: 1000,
  spent: 0,
  purchased: 0,
  expired: 0,
  refunded: 0,
};

const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  status: 'none',
  isFreeTier: true,
  creditsPerPeriod: 500,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates a mock return value for the useCredits hook.
 *
 * Usage:
 * ```ts
 * vi.mocked(useCredits).mockReturnValue(mockUseCredits({ balance: 500 }));
 * ```
 */
export function mockUseCredits(config: MockCreditsConfig = {}): UseCreditsReturn {
  const {
    balance = 1000,
    isFreeTier = true,
    isLoading = false,
    error = null,
    isLowCredits,
    isCriticalCredits,
    isOutOfCredits,
    lifetimeStats = {},
    subscription = {},
    canPerformAction,
    performAction,
  } = config;

  const mergedLifetime: LifetimeStats = { ...DEFAULT_LIFETIME_STATS, ...lifetimeStats };
  const mergedSubscription: SubscriptionInfo = {
    ...DEFAULT_SUBSCRIPTION,
    isFreeTier,
    ...subscription,
  };

  // Derive status flags from balance if not explicitly provided
  const derivedIsLowCredits = isLowCredits ?? (isFreeTier && balance <= 2000);
  const derivedIsCriticalCredits = isCriticalCredits ?? (isFreeTier && balance <= 100);
  const derivedIsOutOfCredits = isOutOfCredits ?? (isFreeTier && balance <= 0);

  // Build canPerformAction mock
  let canPerformActionMock: Mock;
  if (typeof canPerformAction === 'function') {
    canPerformActionMock = canPerformAction;
  } else if (typeof canPerformAction === 'boolean') {
    canPerformActionMock = vi.fn().mockResolvedValue(canPerformAction);
  } else {
    // Default: can perform if paid tier OR has positive balance
    canPerformActionMock = vi.fn().mockResolvedValue(!isFreeTier || balance > 0);
  }

  // Build performAction mock
  const performActionMock = performAction ?? vi.fn().mockResolvedValue({
    success: balance > 0,
    newBalance: Math.max(0, balance - 50),
    creditsCost: 50,
    ...(balance <= 0 ? { errorMessage: 'Insufficient credits' } : {}),
  });

  return {
    balance,
    isFreeTier,
    isLoading,
    error,
    isLowCredits: derivedIsLowCredits,
    isCriticalCredits: derivedIsCriticalCredits,
    isOutOfCredits: derivedIsOutOfCredits,
    lifetimeStats: mergedLifetime,
    subscription: mergedSubscription,
    lifetimeEarned: mergedLifetime.earned,
    lifetimeSpent: mergedLifetime.spent,
    nextFreeGrantAt: null,
    percentUsed: mergedLifetime.earned > 0
      ? Math.round((mergedLifetime.spent / mergedLifetime.earned) * 100)
      : 0,
    hasCredits: vi.fn((amount: number) => !isFreeTier || balance >= amount),
    canPerformAction: canPerformActionMock,
    performAction: performActionMock,
    refetch: vi.fn(),
    invalidate: vi.fn(),
  };
}

/**
 * Convenience preset: mocks useCredits with 0 balance (out of credits).
 *
 * Usage:
 * ```ts
 * vi.mocked(useCredits).mockReturnValue(mockInsufficientCredits());
 * ```
 */
export function mockInsufficientCredits(): UseCreditsReturn {
  return mockUseCredits({
    balance: 0,
    isFreeTier: true,
    isOutOfCredits: true,
    isCriticalCredits: true,
    isLowCredits: true,
    canPerformAction: false,
    performAction: vi.fn().mockResolvedValue({
      success: false,
      newBalance: 0,
      creditsCost: 0,
      errorMessage: 'Insufficient credits',
    }),
  });
}

/**
 * Convenience preset: mocks useCredits for a paid tier user
 * (credits are not gated).
 *
 * Usage:
 * ```ts
 * vi.mocked(useCredits).mockReturnValue(mockPaidTierCredits());
 * ```
 */
export function mockPaidTierCredits(): UseCreditsReturn {
  return mockUseCredits({
    balance: 0,
    isFreeTier: false,
    isOutOfCredits: false,
    isCriticalCredits: false,
    isLowCredits: false,
    canPerformAction: true,
    performAction: vi.fn().mockResolvedValue({
      success: true,
      newBalance: -1,
      creditsCost: 0,
    }),
  });
}

/**
 * Creates a mock return value for useCreditGatedAction hook.
 *
 * Usage:
 * ```ts
 * vi.mocked(useCreditGatedAction).mockReturnValue(
 *   mockUseCreditGatedAction({ balance: 0 })
 * );
 * ```
 */
export function mockUseCreditGatedAction(
  config: MockCreditsConfig & {
    isExecuting?: boolean;
    showOutOfCreditsModal?: boolean;
    blockedAction?: string | null;
  } = {}
): UseCreditGatedActionReturn {
  const {
    balance = 1000,
    isFreeTier = true,
    isExecuting = false,
    showOutOfCreditsModal = false,
    blockedAction = null,
  } = config;

  return {
    execute: vi.fn().mockResolvedValue({
      success: balance > 0,
      result: undefined,
      creditsCost: 0,
      wasBlocked: balance <= 0 && isFreeTier,
    }),
    isExecuting,
    showOutOfCreditsModal,
    closeOutOfCreditsModal: vi.fn(),
    blockedAction,
    balance,
    isFreeTier,
  };
}

// ============================================================================
// Render Helpers
// ============================================================================

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface CreditProvidersProps {
  children: React.ReactNode;
}

/**
 * Renders a component wrapped in the providers needed for credit-gated
 * component testing (QueryClient, BrowserRouter).
 *
 * Note: You must still mock the credit hooks at the module level with vi.mock().
 * This wrapper provides the React context providers (QueryClient, Router)
 * so the component tree renders without errors.
 *
 * Usage:
 * ```ts
 * vi.mock('@/hooks/useCredits', () => ({
 *   useCredits: vi.fn(),
 * }));
 *
 * vi.mocked(useCredits).mockReturnValue(mockUseCredits({ balance: 500 }));
 * const { getByText } = renderWithCredits(<CreditGatedButton actionKey="menu_create" />);
 * ```
 */
export function renderWithCredits(
  ui: ReactElement,
  options: RenderWithCreditsOptions = {}
) {
  const { balance: _balance, isFreeTier: _isFreeTier, creditsConfig: _config, ...renderOptions } = options;

  const queryClient = createTestQueryClient();

  function CreditProviders({ children }: CreditProvidersProps) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: CreditProviders, ...renderOptions }),
    queryClient,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that the OutOfCreditsModal is visible in the DOM.
 * Looks for the modal's distinctive heading text.
 */
export function expectCreditGateShown(): void {
  expect(screen.getByText("You're Out of Credits")).toBeInTheDocument();
}

/**
 * Asserts that the OutOfCreditsModal is NOT visible in the DOM.
 */
export function expectCreditGateHidden(): void {
  expect(screen.queryByText("You're Out of Credits")).not.toBeInTheDocument();
}

/**
 * Asserts that a credit cost badge is showing the expected cost.
 */
export function expectCreditCostBadge(expectedCost: number): void {
  expect(screen.getByText(new RegExp(`${expectedCost}\\s*cr`, 'i'))).toBeInTheDocument();
}

// ============================================================================
// Common Mock Setups
// ============================================================================

/**
 * Returns vi.mock call arguments for the most commonly mocked modules
 * in credit-gated component tests. Spread these into your test file's
 * top-level vi.mock() calls.
 *
 * Usage (in test file, top level):
 * ```ts
 * vi.mock('@/hooks/useCredits', () => ({ useCredits: vi.fn() }));
 * vi.mock('@/contexts/TenantAdminAuthContext', () => ({
 *   useTenantAdminAuth: vi.fn(() => MOCK_TENANT_AUTH),
 * }));
 * ```
 */
export const MOCK_TENANT_AUTH = {
  tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
  tenantSlug: 'test-tenant',
  isAuthenticated: true,
  accessToken: 'test-token',
  userRole: 'admin' as const,
} as const;

export const MOCK_LOGGER = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as const;

export const MOCK_TOAST = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
} as const;
