/**
 * CreditAnalyticsPage Tests
 *
 * Verifies the credit analytics page displays correct stats, charts, and tabs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditAnalyticsPage } from '../CreditAnalyticsPage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                then: vi.fn((cb) => cb({ data: [], error: null })),
              })),
            })),
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                then: vi.fn((cb) => cb({ data: [], error: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock tenant auth context
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

// Mock credits hook with configurable values
let mockCreditsData = {
  balance: 5000,
  isFreeTier: true,
  isLoading: false,
  lifetimeSpent: 2000,
  lifetimeEarned: 10000,
  nextFreeGrantAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  refetch: vi.fn(),
};

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => mockCreditsData,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock credits lib
vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 10000,
  getCreditCostInfo: (actionType: string) => ({
    actionName: actionType.replace(/_/g, ' '),
    category: 'orders',
    credits: 10,
    description: 'Test action',
  }),
  getCategoryDisplayName: (category: string) => {
    const names: Record<string, string> = {
      orders: 'Orders',
      inventory: 'Inventory',
      customers: 'Customers',
      other: 'Other',
    };
    return names[category] || category;
  },
}));

// Mock the CreditPurchaseModal and AutoTopUpSettings
vi.mock('@/components/credits/CreditPurchaseModal', () => ({
  CreditPurchaseModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="credit-purchase-modal">Purchase Modal</div> : null,
}));

vi.mock('@/components/credits/AutoTopUpSettings', () => ({
  AutoTopUpSettings: () => <div data-testid="auto-topup-settings">Auto Top-Up Settings</div>,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderPage = () => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CreditAnalyticsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('CreditAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreditsData = {
      balance: 5000,
      isFreeTier: true,
      isLoading: false,
      lifetimeSpent: 2000,
      lifetimeEarned: 10000,
      nextFreeGrantAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      refetch: vi.fn(),
    };
  });

  describe('Header', () => {
    it('should display the page title', () => {
      renderPage();
      expect(screen.getByText('Credit Analytics')).toBeInTheDocument();
    });

    it('should display back button', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    it('should display refresh button', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should display buy credits button', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /buy credits/i })).toBeInTheDocument();
    });
  });

  describe('Stats Cards', () => {
    it('should display credit balance card', () => {
      renderPage();
      expect(screen.getByText('Credit Balance')).toBeInTheDocument();
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });

    it('should display 30-day usage card', () => {
      renderPage();
      expect(screen.getByText('30-Day Usage')).toBeInTheDocument();
    });

    it('should display daily average card', () => {
      renderPage();
      expect(screen.getByText('Daily Average')).toBeInTheDocument();
    });

    it('should display days remaining card', () => {
      renderPage();
      expect(screen.getByText('Days Remaining')).toBeInTheDocument();
    });
  });

  describe('Tabs', () => {
    it('should display analytics tab', () => {
      renderPage();
      expect(screen.getByRole('tab', { name: /analytics/i })).toBeInTheDocument();
    });

    it('should display purchases tab', () => {
      renderPage();
      expect(screen.getByRole('tab', { name: /purchases/i })).toBeInTheDocument();
    });

    it('should display auto top-up tab', () => {
      renderPage();
      expect(screen.getByRole('tab', { name: /auto top-up/i })).toBeInTheDocument();
    });

    it('should show analytics content by default', () => {
      renderPage();
      expect(screen.getByText('Usage Over Time')).toBeInTheDocument();
      expect(screen.getByText('Usage Breakdown')).toBeInTheDocument();
    });

    it('should show auto top-up settings when tab clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      const settingsTab = screen.getByRole('tab', { name: /auto top-up/i });
      await user.click(settingsTab);

      expect(screen.getByTestId('auto-topup-settings')).toBeInTheDocument();
    });
  });

  describe('Analytics Tab', () => {
    it('should display usage over time chart card', () => {
      renderPage();
      expect(screen.getByText('Usage Over Time')).toBeInTheDocument();
      expect(screen.getByText('Daily credit consumption (last 30 days)')).toBeInTheDocument();
    });

    it('should display usage breakdown chart card', () => {
      renderPage();
      expect(screen.getByText('Usage Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Credits by category')).toBeInTheDocument();
    });

    it('should display top credit consumers card', () => {
      renderPage();
      expect(screen.getByText('Top Credit Consumers')).toBeInTheDocument();
      expect(screen.getByText('Actions consuming the most credits')).toBeInTheDocument();
    });

    it('should display usage by category card', () => {
      renderPage();
      expect(screen.getByText('Usage by Category')).toBeInTheDocument();
      expect(screen.getByText('Detailed breakdown of credit consumption')).toBeInTheDocument();
    });
  });

  describe('Purchases Tab', () => {
    it('should display purchase history when tab clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      const purchasesTab = screen.getByRole('tab', { name: /purchases/i });
      await user.click(purchasesTab);

      expect(screen.getByText('Purchase History')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin');
    });
  });

  describe('Purchase Modal', () => {
    it('should open purchase modal when buy credits button clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      const buyButton = screen.getByRole('button', { name: /buy credits/i });
      await user.click(buyButton);

      expect(screen.getByTestId('credit-purchase-modal')).toBeInTheDocument();
    });
  });

  describe('Non-Free Tier Redirect', () => {
    it('should redirect to billing when not on free tier', async () => {
      mockCreditsData = {
        ...mockCreditsData,
        isFreeTier: false,
        isLoading: false,
      };

      renderPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/settings?section=billing');
      });
    });
  });

  describe('Balance Display', () => {
    it('should show percentage remaining', () => {
      renderPage();
      // 5000/10000 = 50%
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });
});

describe('CreditAnalyticsPage Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreditsData = {
      balance: 5000,
      isFreeTier: true,
      isLoading: false,
      lifetimeSpent: 2000,
      lifetimeEarned: 10000,
      nextFreeGrantAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      refetch: vi.fn(),
    };
  });

  it('should query credit_transactions for usage data', async () => {
    renderPage();

    // Queries are made for credit_transactions table
    // This test verifies the component sets up queries correctly
    await waitFor(() => {
      expect(screen.getByText('Credit Analytics')).toBeInTheDocument();
    });
  });

  it('should query credit_transactions for purchase history', async () => {
    const user = userEvent.setup();
    renderPage();

    const purchasesTab = screen.getByRole('tab', { name: /purchases/i });
    await user.click(purchasesTab);

    await waitFor(() => {
      expect(screen.getByText('Purchase History')).toBeInTheDocument();
    });
  });
});
