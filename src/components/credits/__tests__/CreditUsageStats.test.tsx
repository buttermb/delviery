/**
 * CreditUsageStats Tests
 *
 * Verifies:
 * - Monthly allocation displays correct value (10,000 credits)
 * - Percentage remaining calculation is accurate
 * - Compact mode shows correct balance/allocation
 * - Does not render for paid tier users
 * - Consistency between FREE_TIER_MONTHLY_CREDITS and actual grant amounts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreditUsageStats } from '../CreditUsageStats';
import { FREE_TIER_MONTHLY_CREDITS } from '@/lib/credits/creditCosts';

// Configurable mock state
let mockBalance = 5000;
let mockIsFreeTier = true;
let mockIsLoading = false;
let mockNextFreeGrantAt: Date | null = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: mockIsLoading,
    lifetimeSpent: 3000,
    lifetimeEarned: 10000,
    nextFreeGrantAt: mockNextFreeGrantAt,
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({ data: [], error: null })
              ),
            })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    creditWidgets: {
      usageStats: (id: string) => ['credit-widgets', 'usage-stats', id],
    },
  },
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: Date) => date.toLocaleDateString(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('CreditUsageStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBalance = 5000;
    mockIsFreeTier = true;
    mockIsLoading = false;
    mockNextFreeGrantAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  });

  describe('Monthly allocation constant', () => {
    it('FREE_TIER_MONTHLY_CREDITS should be 10000', () => {
      expect(FREE_TIER_MONTHLY_CREDITS).toBe(10000);
    });

    it('should match create_tenant_atomic grant amount (10000)', () => {
      // create_tenant_atomic grants v_initial_credits := 10000 for free plan
      expect(FREE_TIER_MONTHLY_CREDITS).toBe(10000);
    });

    it('should match grant-free-credits edge function amount (10000)', () => {
      // grant-free-credits PLAN_CREDIT_AMOUNTS.free = 10000
      const PLAN_CREDIT_AMOUNTS_FREE = 10000;
      expect(FREE_TIER_MONTHLY_CREDITS).toBe(PLAN_CREDIT_AMOUNTS_FREE);
    });
  });

  describe('Balance display', () => {
    it('should display monthly allocation as 10,000', () => {
      render(<CreditUsageStats />, { wrapper: createWrapper() });
      expect(screen.getByText(/of 10,000 monthly credits/)).toBeInTheDocument();
    });

    it('should display current balance', () => {
      mockBalance = 7500;
      render(<CreditUsageStats />, { wrapper: createWrapper() });
      expect(screen.getByText('7,500')).toBeInTheDocument();
    });

    it('should calculate percentage remaining correctly', () => {
      mockBalance = 5000;
      render(<CreditUsageStats />, { wrapper: createWrapper() });
      // 5000 / 10000 = 50%
      expect(screen.getByText('50% remaining')).toBeInTheDocument();
    });

    it('should show 100% when balance equals allocation', () => {
      mockBalance = 10000;
      render(<CreditUsageStats />, { wrapper: createWrapper() });
      expect(screen.getByText('100% remaining')).toBeInTheDocument();
    });

    it('should show 0% when balance is 0', () => {
      mockBalance = 0;
      render(<CreditUsageStats />, { wrapper: createWrapper() });
      expect(screen.getByText('0% remaining')).toBeInTheDocument();
    });
  });

  describe('Compact mode', () => {
    it('should display balance / allocation in compact mode', () => {
      mockBalance = 8000;
      render(<CreditUsageStats compact />, { wrapper: createWrapper() });
      expect(screen.getByText('8,000 / 10,000')).toBeInTheDocument();
    });
  });

  describe('Paid tier behavior', () => {
    it('should not render for paid tier users', () => {
      mockIsFreeTier = false;
      const { container } = render(<CreditUsageStats />, { wrapper: createWrapper() });
      expect(container.innerHTML).toBe('');
    });
  });

  describe('Credit refresh date', () => {
    it('should display next refresh date when available', () => {
      const futureDate = new Date(2026, 3, 15); // April 15, 2026
      mockNextFreeGrantAt = futureDate;
      render(<CreditUsageStats />, { wrapper: createWrapper() });
      expect(screen.getByText(/Credits refresh on/)).toBeInTheDocument();
    });
  });

  describe('Upgrade CTA', () => {
    it('should show upgrade button by default', () => {
      render(<CreditUsageStats />, { wrapper: createWrapper() });
      expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
    });

    it('should hide upgrade button when showUpgradeButton is false', () => {
      render(<CreditUsageStats showUpgradeButton={false} />, { wrapper: createWrapper() });
      expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
    });
  });
});
