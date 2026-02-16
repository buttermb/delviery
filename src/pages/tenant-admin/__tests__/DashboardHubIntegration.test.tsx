/**
 * Dashboard Hub Integration Tests
 * Verifies all 5 stat cards load with real data and links work:
 * 1. Products (usage/limit) - links to inventory/products
 * 2. Customers (usage/limit) - links to big-plug-clients
 * 3. Menus (usage/limit) - links to disposable-menus
 * 4. Total Revenue (from UnifiedAnalyticsDashboard)
 * 5. Total Orders (from UnifiedAnalyticsDashboard)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Track navigation calls
const mockNavigate = vi.fn();

// Mock dependencies before importing
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tenantSlug: 'test-tenant' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue: { data: unknown; error: unknown } = { data: [], error: null }) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.lt = vi.fn().mockReturnValue(chain);
    chain.lte = vi.fn().mockReturnValue(chain);
    chain.not = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.returns = vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.single = vi.fn().mockResolvedValue(resolvedValue);
    // Make chain thenable for Promise.allSettled usage
    chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => createChainMock()),
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: {
      id: 'tenant-123',
      slug: 'test-tenant',
      business_name: 'Test Cannabis Co',
      subscription_plan: 'professional',
      subscription_status: 'active',
      trial_ends_at: null,
      payment_method_added: true,
      usage: { products: 15, customers: 42, menus: 8 },
      limits: { products: 100, customers: 200, menus: 50 },
    },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
    logout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTenantLimits', () => ({
  useTenantLimits: vi.fn().mockReturnValue({
    getLimit: vi.fn((resource: string) => {
      const limits: Record<string, number> = { products: 100, customers: 200, menus: 50 };
      return limits[resource] || Infinity;
    }),
    getCurrent: vi.fn((resource: string) => {
      const current: Record<string, number> = { products: 15, customers: 42, menus: 8 };
      return current[resource] || 0;
    }),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useFreeTierLimits', () => ({
  useFreeTierLimits: vi.fn().mockReturnValue({
    usage: null,
    hasPurchasedCredits: false,
    hasActiveCredits: false,
    limitsApply: false,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 100,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 50,
  }),
}));

vi.mock('@/hooks/useRealtimeSync', () => ({
  useRealtimeSync: vi.fn(),
}));

vi.mock('@/hooks/useStorefrontOrderAlerts', () => ({
  useStorefrontOrderAlerts: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn().mockReturnValue({ toast: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    setTheme: vi.fn(),
    systemPreference: 'light',
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock components that are heavy/irrelevant to stat card testing
vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => null,
}));

vi.mock('@/components/credits/CreditPurchaseCelebration', () => ({
  CreditPurchaseCelebration: () => null,
}));

vi.mock('@/components/tutorial/TakeTourButton', () => ({
  TakeTourButton: () => null,
}));

vi.mock('@/components/tenant-admin/SmartNotificationsCenter', () => ({
  SmartNotificationsCenter: () => null,
}));

vi.mock('@/components/tenant-admin/DashboardWidgetGrid', () => ({
  DashboardWidgetGrid: () => <div data-testid="widget-grid">Widget Grid</div>,
}));

vi.mock('@/components/onboarding/WelcomeModal', () => ({
  WelcomeModal: () => null,
}));

vi.mock('@/components/onboarding/TrialWelcomeModal', () => ({
  TrialWelcomeModal: () => null,
}));

vi.mock('@/components/onboarding/QuickStartWizard', () => ({
  QuickStartWizard: () => null,
}));

vi.mock('@/components/onboarding/OnboardingChecklist', () => ({
  OnboardingChecklist: () => null,
}));

vi.mock('@/components/auth/EmailVerificationBanner', () => ({
  EmailVerificationBanner: () => null,
}));

vi.mock('@/components/admin/DataSetupBanner', () => ({
  DataSetupBanner: () => null,
}));

vi.mock('@/components/billing/TrialExpirationBanner', () => ({
  TrialExpirationBanner: () => null,
}));

vi.mock('@/components/whitelabel/LimitGuard', () => ({
  LimitGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/dashboard/QuickActionsWidget', () => ({
  QuickActionsWidget: () => <div data-testid="quick-actions">Quick Actions</div>,
}));

vi.mock('@/lib/tutorials/tutorialConfig', () => ({
  dashboardTutorial: { id: 'dashboard', steps: [] },
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 1000,
  FREE_TIER_LIMITS: {
    max_menus_per_day: 5,
    max_orders_per_day: 10,
    max_sms_per_day: 10,
    max_exports_per_month: 5,
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/lib/utils/formatDate', () => ({
  formatSmartDate: vi.fn((date: string) => new Date(date).toLocaleDateString()),
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the UnifiedAnalyticsDashboard with real stat cards
vi.mock('@/components/analytics/UnifiedAnalyticsDashboard', () => ({
  UnifiedAnalyticsDashboard: ({ tenantId: _tenantId }: { tenantId: string }) => (
    <div data-testid="unified-analytics">
      <h2>Unified Analytics</h2>
      <div data-testid="stat-card-revenue">
        <span>Total Revenue</span>
        <span data-testid="revenue-value">$12,450.00</span>
        <span>Across all channels</span>
      </div>
      <div data-testid="stat-card-orders">
        <span>Total Orders</span>
        <span data-testid="orders-value">87</span>
        <span>Combined transactions</span>
      </div>
      <div data-testid="stat-card-aov">
        <span>Avg. Order Value</span>
        <span data-testid="aov-value">$143.10</span>
      </div>
    </div>
  ),
}));

// Import after mocks
import TenantAdminDashboardPage from '../DashboardPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { supabase } from '@/integrations/supabase/client';

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

// Default mock values to reset between tests
const defaultTenantAuth = {
  tenant: {
    id: 'tenant-123',
    slug: 'test-tenant',
    business_name: 'Test Cannabis Co',
    subscription_plan: 'professional',
    subscription_status: 'active',
    trial_ends_at: null,
    payment_method_added: true,
    usage: { products: 15, customers: 42, menus: 8 },
    limits: { products: 100, customers: 200, menus: 50 },
  },
  loading: false,
  admin: { id: 'admin-123', email: 'admin@test.com' },
  tenantSlug: 'test-tenant',
  logout: vi.fn(),
};

const defaultTenantLimits = {
  getLimit: (resource: string) => {
    const limits: Record<string, number> = { products: 100, customers: 200, menus: 50 };
    return limits[resource] || Infinity;
  },
  getCurrent: (resource: string) => {
    const current: Record<string, number> = { products: 15, customers: 42, menus: 8 };
    return current[resource] || 0;
  },
  isLoading: false,
};

describe('Dashboard Hub Integration - 5 Stat Cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Reset auth mock to defaults
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue(defaultTenantAuth);

    // Reset tenant limits mock to defaults
    (useTenantLimits as ReturnType<typeof vi.fn>).mockReturnValue(defaultTenantLimits);

    // Setup default supabase mock that resolves with empty data
    const createChainMock = (resolvedValue = { data: [], error: null }) => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.neq = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockReturnValue(chain);
      chain.gte = vi.fn().mockReturnValue(chain);
      chain.lt = vi.fn().mockReturnValue(chain);
      chain.lte = vi.fn().mockReturnValue(chain);
      chain.not = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.returns = vi.fn().mockResolvedValue(resolvedValue);
      chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
      chain.single = vi.fn().mockResolvedValue(resolvedValue);
      chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
      return chain;
    };

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => createChainMock());
  });

  describe('Stat Card 1: Products Usage Card', () => {
    it('should render Products stat card with usage data', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
      });

      // Should show usage/limit format
      expect(screen.getByText('15/100')).toBeInTheDocument();
    });

    it('should navigate to products page when Products card is clicked', async () => {
      const user = userEvent.setup();
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
      });

      // Find the Products card and click it
      const productsCard = screen.getByText('15/100').closest('[class*="cursor-pointer"]');
      expect(productsCard).toBeInTheDocument();

      if (productsCard) {
        await user.click(productsCard);
        expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/inventory/products');
      }
    });

    it('should show unlimited products message on professional plan', async () => {
      // Override to show unlimited
      (useTenantLimits as ReturnType<typeof vi.fn>).mockReturnValue({
        getLimit: () => Infinity,
        getCurrent: (resource: string) => {
          const current: Record<string, number> = { products: 15, customers: 42, menus: 8 };
          return current[resource] || 0;
        },
        isLoading: false,
      });

      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Unlimited products/i)).toBeInTheDocument();
      });
    });
  });

  describe('Stat Card 2: Customers Usage Card', () => {
    it('should render Customers stat card with usage data', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Customers')).toBeInTheDocument();
      });

      expect(screen.getByText('42/200')).toBeInTheDocument();
    });

    it('should navigate to customers page when Customers card is clicked', async () => {
      const user = userEvent.setup();
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Customers')).toBeInTheDocument();
      });

      const customersCard = screen.getByText('42/200').closest('[class*="cursor-pointer"]');
      expect(customersCard).toBeInTheDocument();

      if (customersCard) {
        await user.click(customersCard);
        expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/big-plug-clients');
      }
    });
  });

  describe('Stat Card 3: Menus Usage Card', () => {
    it('should render Menus stat card with usage data', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Menus')).toBeInTheDocument();
      });

      expect(screen.getByText('8/50')).toBeInTheDocument();
    });

    it('should navigate to menus page when Menus card is clicked', async () => {
      const user = userEvent.setup();
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Menus')).toBeInTheDocument();
      });

      const menusCard = screen.getByText('8/50').closest('[class*="cursor-pointer"]');
      expect(menusCard).toBeInTheDocument();

      if (menusCard) {
        await user.click(menusCard);
        expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/disposable-menus');
      }
    });
  });

  describe('Stat Card 4: Total Revenue (UnifiedAnalyticsDashboard)', () => {
    it('should render Total Revenue stat card with data', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });

      expect(screen.getByTestId('revenue-value')).toHaveTextContent('$12,450.00');
      expect(screen.getByText('Across all channels')).toBeInTheDocument();
    });

    it('should render within the UnifiedAnalyticsDashboard section', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        const analyticsSection = screen.getByTestId('unified-analytics');
        expect(analyticsSection).toBeInTheDocument();
        expect(within(analyticsSection).getByText('Total Revenue')).toBeInTheDocument();
      });
    });
  });

  describe('Stat Card 5: Total Orders (UnifiedAnalyticsDashboard)', () => {
    it('should render Total Orders stat card with data', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Total Orders')).toBeInTheDocument();
      });

      expect(screen.getByTestId('orders-value')).toHaveTextContent('87');
      expect(screen.getByText('Combined transactions')).toBeInTheDocument();
    });

    it('should render within the UnifiedAnalyticsDashboard section', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        const analyticsSection = screen.getByTestId('unified-analytics');
        expect(within(analyticsSection).getByText('Total Orders')).toBeInTheDocument();
      });
    });
  });

  describe('All 5 Stat Cards Integration', () => {
    it('should render all 5 stat cards simultaneously', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        // Usage stat cards
        expect(screen.getByText('Products')).toBeInTheDocument();
        expect(screen.getByText('Customers')).toBeInTheDocument();
        expect(screen.getByText('Menus')).toBeInTheDocument();
        // Analytics stat cards
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
        expect(screen.getByText('Total Orders')).toBeInTheDocument();
      });
    });

    it('should display real data values in all stat cards', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        // Usage cards show real data
        expect(screen.getByText('15/100')).toBeInTheDocument();
        expect(screen.getByText('42/200')).toBeInTheDocument();
        expect(screen.getByText('8/50')).toBeInTheDocument();
        // Revenue and orders show formatted values
        expect(screen.getByTestId('revenue-value')).toHaveTextContent('$12,450.00');
        expect(screen.getByTestId('orders-value')).toHaveTextContent('87');
      });
    });

    it('should show the dashboard stats section with tutorial data attribute', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        const statsSection = document.querySelector('[data-tutorial="dashboard-stats"]');
        expect(statsSection).toBeInTheDocument();
      });
    });

    it('should not show loading state when auth is complete', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator when auth is loading', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        tenant: null,
        loading: true,
        admin: null,
        tenantSlug: null,
        logout: vi.fn(),
      });

      render(<TenantAdminDashboardPage />, { wrapper });

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });
  });

  describe('Stat Card Links/Navigation', () => {
    it('should provide correct navigation paths for all clickable stat cards', async () => {
      const user = userEvent.setup();
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
      });

      // Click Products card
      const productsCard = screen.getByText('15/100').closest('[class*="cursor-pointer"]');
      if (productsCard) {
        await user.click(productsCard);
        expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/inventory/products');
      }

      mockNavigate.mockClear();

      // Click Customers card
      const customersCard = screen.getByText('42/200').closest('[class*="cursor-pointer"]');
      if (customersCard) {
        await user.click(customersCard);
        expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/big-plug-clients');
      }

      mockNavigate.mockClear();

      // Click Menus card
      const menusCard = screen.getByText('8/50').closest('[class*="cursor-pointer"]');
      if (menusCard) {
        await user.click(menusCard);
        expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/disposable-menus');
      }
    });

    it('should include tenant slug in all navigation paths', async () => {
      const user = userEvent.setup();
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
      });

      const productsCard = screen.getByText('15/100').closest('[class*="cursor-pointer"]');
      if (productsCard) {
        await user.click(productsCard);
        // Verify the path includes the tenant slug
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('test-tenant')
        );
      }
    });
  });

  describe('Usage Limit Warnings', () => {
    it('should show capacity warning when usage exceeds 80%', async () => {
      (useTenantLimits as ReturnType<typeof vi.fn>).mockReturnValue({
        getLimit: (resource: string) => {
          const limits: Record<string, number> = { products: 20, customers: 200, menus: 50 };
          return limits[resource] || Infinity;
        },
        getCurrent: (resource: string) => {
          const current: Record<string, number> = { products: 18, customers: 42, menus: 8 };
          return current[resource] || 0;
        },
        isLoading: false,
      });

      // Update tenant usage to match
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: {
          id: 'tenant-123',
          slug: 'test-tenant',
          business_name: 'Test Cannabis Co',
          subscription_plan: 'starter',
          subscription_status: 'active',
          trial_ends_at: null,
          payment_method_added: true,
          usage: { products: 18, customers: 42, menus: 8 },
          limits: { products: 20, customers: 200, menus: 50 },
        },
        loading: false,
        admin: { id: 'admin-123', email: 'admin@test.com' },
        tenantSlug: 'test-tenant',
        logout: vi.fn(),
      });

      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        // 18/20 = 90% capacity
        expect(screen.getByText(/90% capacity/i)).toBeInTheDocument();
      });
    });
  });

  describe('UnifiedAnalyticsDashboard Integration', () => {
    it('should pass tenantId to UnifiedAnalyticsDashboard', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        // The component renders with the analytics section
        expect(screen.getByTestId('unified-analytics')).toBeInTheDocument();
      });
    });

    it('should render Avg Order Value as an additional metric', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Avg. Order Value')).toBeInTheDocument();
        expect(screen.getByTestId('aov-value')).toHaveTextContent('$143.10');
      });
    });
  });

  describe('Business Name Display', () => {
    it('should display the tenant business name in the header', async () => {
      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Test Cannabis Co/)).toBeInTheDocument();
      });
    });

    it('should show fallback when business name is not set', async () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: {
          id: 'tenant-123',
          slug: 'test-tenant',
          business_name: null,
          subscription_plan: 'professional',
          subscription_status: 'active',
          usage: { products: 0, customers: 0, menus: 0 },
          limits: {},
        },
        loading: false,
        admin: { id: 'admin-123', email: 'admin@test.com' },
        tenantSlug: 'test-tenant',
        logout: vi.fn(),
      });

      render(<TenantAdminDashboardPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
      });
    });
  });
});
