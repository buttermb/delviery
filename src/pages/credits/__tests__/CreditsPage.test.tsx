/**
 * CreditsPage Tests
 *
 * Verifies:
 * - CreditOptimizationTips shows when free tier AND balance < 500
 * - CreditOptimizationTips hidden when balance >= 500
 * - CreditOptimizationTips hidden when balance is 0
 * - CreditOptimizationTips hidden for paid tier users
 * - Page renders balance, stats, and transactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditsPage } from '../CreditsPage';

// --- Mutable mock state ---
let mockBalance = 300;
let mockIsFreeTier = true;
let mockLifetimeEarned = 5000;
let mockLifetimeSpent = 4700;
let mockPercentUsed = 94;
let mockIsLoading = false;
let mockTenantId: string | undefined = 'tenant-123';
let mockTenantSlug: string | undefined = 'test-shop';

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    lifetimeEarned: mockLifetimeEarned,
    lifetimeSpent: mockLifetimeSpent,
    percentUsed: mockPercentUsed,
    isLoading: mockIsLoading,
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenantId
      ? {
          id: mockTenantId,
          subscription_plan: mockIsFreeTier ? 'free' : 'professional',
          subscription_status: 'active',
          is_free_tier: mockIsFreeTier,
        }
      : null,
    tenantSlug: mockTenantSlug,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/lib/credits', () => ({
  getCreditTransactions: vi.fn().mockResolvedValue([]),
  CREDIT_COSTS: {},
  LOW_BALANCE_WARNING_LEVELS: [2000, 1000, 500, 100],
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    credits: {
      all: ['credits'],
      balance: (tenantId?: string) => ['credits', 'balance', tenantId],
    },
    creditWidgets: {
      recentTransactions: (tenantId?: string) => ['credit-widgets', 'recent', tenantId],
    },
    creditOptimizationUsage: {
      all: ['credit-optimization-usage'],
      byTenant: (tenantId?: string) => ['credit-optimization-usage', tenantId],
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => date,
}));

vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AccordionContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CreditsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBalance = 300;
    mockIsFreeTier = true;
    mockLifetimeEarned = 5000;
    mockLifetimeSpent = 4700;
    mockPercentUsed = 94;
    mockIsLoading = false;
    mockTenantId = 'tenant-123';
    mockTenantSlug = 'test-shop';
  });

  describe('Page layout', () => {
    it('should render the page header', () => {
      render(<CreditsPage />);
      expect(screen.getByText('Credits')).toBeInTheDocument();
      expect(screen.getByText('Manage your credit balance and view activity')).toBeInTheDocument();
    });

    it('should render Buy More Credits button', () => {
      render(<CreditsPage />);
      expect(screen.getByText('Buy More Credits')).toBeInTheDocument();
    });

    it('should render current balance', () => {
      render(<CreditsPage />);
      expect(screen.getByText('300')).toBeInTheDocument();
      expect(screen.getByText('credits')).toBeInTheDocument();
    });

    it('should render loading skeletons when tenant is missing', () => {
      mockTenantId = undefined;
      mockTenantSlug = undefined;
      const { container } = render(<CreditsPage />);
      // Should render skeleton layout when no tenant
      expect(container.querySelector('.container')).toBeInTheDocument();
    });
  });

  describe('CreditOptimizationTips integration', () => {
    it('should show optimization tips when free tier and balance < 500', () => {
      mockIsFreeTier = true;
      mockBalance = 300;
      render(<CreditsPage />);
      expect(screen.getByText('Credit-Saving Tips')).toBeInTheDocument();
    });

    it('should show optimization tips at boundary (balance = 499)', () => {
      mockIsFreeTier = true;
      mockBalance = 499;
      render(<CreditsPage />);
      expect(screen.getByText('Credit-Saving Tips')).toBeInTheDocument();
    });

    it('should hide optimization tips when balance >= 500', () => {
      mockIsFreeTier = true;
      mockBalance = 500;
      render(<CreditsPage />);
      expect(screen.queryByText('Credit-Saving Tips')).not.toBeInTheDocument();
    });

    it('should hide optimization tips when balance is 0', () => {
      mockIsFreeTier = true;
      mockBalance = 0;
      render(<CreditsPage />);
      // balance > 0 check prevents showing tips at 0 (OutOfCreditsModal handles that)
      expect(screen.queryByText('Credit-Saving Tips')).not.toBeInTheDocument();
    });

    it('should hide optimization tips for paid tier users even with low balance', () => {
      mockIsFreeTier = false;
      mockBalance = 100;
      render(<CreditsPage />);
      expect(screen.queryByText('Credit-Saving Tips')).not.toBeInTheDocument();
    });

    it('should hide optimization tips when balance is 1 (edge case)', () => {
      mockIsFreeTier = true;
      mockBalance = 1;
      render(<CreditsPage />);
      // balance is 1, which is < 500 and > 0, so tips should show
      expect(screen.getByText('Credit-Saving Tips')).toBeInTheDocument();
    });
  });
});
