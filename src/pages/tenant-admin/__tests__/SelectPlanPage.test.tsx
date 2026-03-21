/**
 * Tenant Admin SelectPlanPage Tests
 * Verifies redirect behavior for already-subscribed users:
 * 1. Paid active subscribers are redirected to dashboard
 * 2. Free tier active users are redirected to dashboard
 * 3. Trial users without payment are NOT redirected (can select plan)
 * 4. Users with no subscription are NOT redirected
 * 5. Enterprise users with active subscription see enterprise guard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 500,
}));

// Mock tenant auth context
const mockTenantAuth = {
  tenant: null as {
    id: string;
    slug: string;
    subscription_plan?: string;
    subscription_status?: string;
    payment_method_added?: boolean;
    is_free_tier?: boolean;
    trial_ends_at?: string | null;
  } | null,
  refreshTenant: vi.fn(),
  admin: null as { email: string; userId: string; role: string } | null,
  tenantSlug: 'test-tenant',
  token: 'valid-token',
  accessToken: null,
  refreshToken: null,
  isAuthenticated: true,
  loading: false,
  initialized: true,
  login: vi.fn(),
  logout: vi.fn(),
  refreshAuthToken: vi.fn(),
  mfaRequired: false,
  mfaFactorId: null,
  verifyMfa: vi.fn(),
  handleSignupSuccess: vi.fn(),
};

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => mockTenantAuth,
  TenantAdminAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock useSubscriptionStatus
const mockSubscriptionStatus = {
  isFreeTier: false,
  isEnterprise: false,
  isProfessional: false,
  isStarter: false,
  isTrial: false,
  isActive: false,
  isSuspended: false,
  isCancelled: false,
  isPastDue: false,
  hasActiveSubscription: false,
  canUpgrade: true,
  canDowngrade: false,
  needsPaymentMethod: true,
  isTrialExpired: false,
  currentTier: 'starter' as string,
  status: undefined as string | undefined,
  tenant: null as typeof mockTenantAuth.tenant,
};

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockSubscriptionStatus,
}));

// Mock supabase
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
const mockFunctionsInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

// Import component after mocks
import SelectPlanPage from '../SelectPlanPage';

// --- Helpers ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location-pathname">{location.pathname}</span>;
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderSelectPlanPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/select-plan']}>
        <Routes>
          <Route path="/:tenantSlug/admin/select-plan" element={<SelectPlanPage />} />
          <Route path="/:tenantSlug/admin/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// --- Tests ---

describe('Tenant Admin SelectPlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset tenant auth
    mockTenantAuth.tenant = null;
    mockTenantAuth.tenantSlug = 'test-tenant';

    // Reset subscription status
    mockSubscriptionStatus.isFreeTier = false;
    mockSubscriptionStatus.isEnterprise = false;
    mockSubscriptionStatus.isProfessional = false;
    mockSubscriptionStatus.isStarter = false;
    mockSubscriptionStatus.isTrial = false;
    mockSubscriptionStatus.isActive = false;
    mockSubscriptionStatus.isSuspended = false;
    mockSubscriptionStatus.isCancelled = false;
    mockSubscriptionStatus.isPastDue = false;
    mockSubscriptionStatus.hasActiveSubscription = false;
    mockSubscriptionStatus.canUpgrade = true;
    mockSubscriptionStatus.canDowngrade = false;
    mockSubscriptionStatus.needsPaymentMethod = true;
    mockSubscriptionStatus.isTrialExpired = false;
    mockSubscriptionStatus.currentTier = 'starter';
    mockSubscriptionStatus.status = undefined;
    mockSubscriptionStatus.tenant = null;

    // Reset navigate
    mockNavigate.mockReset();

    // Default supabase mock: no active subscription
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  describe('Redirect already-subscribed users', () => {
    it('should redirect paid active subscribers to dashboard', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-123',
        slug: 'test-tenant',
        subscription_plan: 'professional',
        subscription_status: 'active',
        payment_method_added: true,
        is_free_tier: false,
      };
      mockSubscriptionStatus.isActive = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.currentTier = 'professional';
      mockSubscriptionStatus.isProfessional = true;
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      // Supabase returns fresh tenant data confirming paid active
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: true,
          subscription_status: 'active',
          is_free_tier: false,
          slug: 'test-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/test-tenant/admin/dashboard',
          { replace: true }
        );
      });
    });

    it('should redirect free tier active users to dashboard', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-456',
        slug: 'test-tenant',
        subscription_plan: 'free',
        subscription_status: 'active',
        payment_method_added: false,
        is_free_tier: true,
      };
      mockSubscriptionStatus.isFreeTier = true;
      mockSubscriptionStatus.isActive = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      // Supabase returns fresh tenant data confirming free tier active
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'active',
          is_free_tier: true,
          slug: 'test-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/test-tenant/admin/dashboard',
          { replace: true }
        );
      });
    });

    it('should NOT redirect trial users (they need to select a plan)', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-789',
        slug: 'test-tenant',
        subscription_plan: 'starter',
        subscription_status: 'trial',
        payment_method_added: false,
        is_free_tier: false,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };
      mockSubscriptionStatus.isTrial = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.needsPaymentMethod = true;
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      // Supabase returns trial data — no paid subscription, no free tier
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'trial',
          is_free_tier: false,
          slug: 'test-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      // Wait for the effect to run, then verify no redirect
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('tenants');
      });

      // Should NOT navigate away
      expect(mockNavigate).not.toHaveBeenCalled();

      // Should show plan selection UI (trial users see "Add Payment Method" header)
      expect(screen.getByText('Add Payment Method')).toBeInTheDocument();
    });

    it('should NOT redirect users with no subscription', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-new',
        slug: 'test-tenant',
        subscription_plan: 'starter',
        subscription_status: 'pending',
        payment_method_added: false,
        is_free_tier: false,
      };
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      // Supabase returns no active subscription
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'pending',
          is_free_tier: false,
          slug: 'test-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('tenants');
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    it('should use freshTenant slug for redirect when available', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-123',
        slug: 'old-slug',
        subscription_plan: 'starter',
        subscription_status: 'active',
        payment_method_added: true,
        is_free_tier: false,
      };
      mockSubscriptionStatus.isActive = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      // Fresh data from DB has updated slug
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: true,
          subscription_status: 'active',
          is_free_tier: false,
          slug: 'new-slug',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/new-slug/admin/dashboard',
          { replace: true }
        );
      });
    });

    it('should fall back to tenant.slug when freshTenant has no slug', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-123',
        slug: 'fallback-slug',
        subscription_plan: 'starter',
        subscription_status: 'active',
        payment_method_added: true,
        is_free_tier: false,
      };
      mockSubscriptionStatus.isActive = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      // Fresh data from DB has empty slug
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: true,
          subscription_status: 'active',
          is_free_tier: false,
          slug: '',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/fallback-slug/admin/dashboard',
          { replace: true }
        );
      });
    });

    it('should query tenants table with tenant id for fresh status check', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-abc-123',
        slug: 'test-tenant',
        subscription_plan: 'starter',
        subscription_status: 'pending',
        payment_method_added: false,
        is_free_tier: false,
      };
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'pending',
          is_free_tier: false,
          slug: 'test-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('tenants');
        expect(mockSelect).toHaveBeenCalledWith(
          'payment_method_added, subscription_status, is_free_tier, slug'
        );
        expect(mockEq).toHaveBeenCalledWith('id', 'tenant-abc-123');
      });
    });

    it('should not query when tenant is null', async () => {
      mockTenantAuth.tenant = null;

      renderSelectPlanPage();

      // Give effect time to run
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('Enterprise guard', () => {
    it('should show enterprise guard for enterprise users with active subscription', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-ent',
        slug: 'enterprise-tenant',
        subscription_plan: 'enterprise',
        subscription_status: 'active',
        payment_method_added: true,
        is_free_tier: false,
      };
      mockSubscriptionStatus.isEnterprise = true;
      mockSubscriptionStatus.isActive = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.currentTier = 'enterprise';
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      // Supabase returns enterprise active — redirect will fire
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: true,
          subscription_status: 'active',
          is_free_tier: false,
          slug: 'enterprise-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      // Enterprise guard renders immediately (no async wait for effect)
      expect(screen.getByText("You're on our highest tier!")).toBeInTheDocument();
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Manage Subscription')).toBeInTheDocument();
    });

    it('should NOT show enterprise guard when enterprise user has no active subscription', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-ent',
        slug: 'enterprise-tenant',
        subscription_plan: 'enterprise',
        subscription_status: 'cancelled',
        payment_method_added: true,
        is_free_tier: false,
      };
      mockSubscriptionStatus.isEnterprise = true;
      mockSubscriptionStatus.isActive = false;
      mockSubscriptionStatus.isCancelled = true;
      mockSubscriptionStatus.hasActiveSubscription = false;
      mockSubscriptionStatus.currentTier = 'enterprise';
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: true,
          subscription_status: 'cancelled',
          is_free_tier: false,
          slug: 'enterprise-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      // Should show plan selection, not enterprise guard
      expect(screen.queryByText("You're on our highest tier!")).not.toBeInTheDocument();
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });
  });

  describe('Plan display and interaction', () => {
    it('should display all plan cards including free tier', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-123',
        slug: 'test-tenant',
        subscription_plan: 'starter',
        subscription_status: 'trial',
        payment_method_added: false,
        is_free_tier: false,
      };
      mockSubscriptionStatus.isTrial = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'trial',
          is_free_tier: false,
          slug: 'test-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(screen.getByText('Free')).toBeInTheDocument();
        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('Professional')).toBeInTheDocument();
        expect(screen.getByText('Enterprise')).toBeInTheDocument();
      });
    });

    it('should show CURRENT PLAN badge on free tier card when user is on free tier', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-ft',
        slug: 'test-tenant',
        subscription_plan: 'free',
        subscription_status: 'active',
        payment_method_added: false,
        is_free_tier: true,
      };
      mockSubscriptionStatus.isFreeTier = true;
      mockSubscriptionStatus.isActive = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      // The redirect will fire, but we can check initial render
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'active',
          is_free_tier: true,
          slug: 'test-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      // Before redirect fires, the page renders with CURRENT PLAN on free tier
      expect(screen.getByText('CURRENT PLAN')).toBeInTheDocument();
    });

    it('should show billing cycle toggle with monthly and yearly options', async () => {
      mockTenantAuth.tenant = {
        id: 'tenant-123',
        slug: 'test-tenant',
        subscription_status: 'trial',
        payment_method_added: false,
        is_free_tier: false,
      };
      mockSubscriptionStatus.isTrial = true;
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.tenant = mockTenantAuth.tenant;

      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'trial',
          is_free_tier: false,
          slug: 'test-tenant',
        },
        error: null,
      });

      renderSelectPlanPage();

      expect(screen.getByText('Monthly')).toBeInTheDocument();
      expect(screen.getByText('Yearly')).toBeInTheDocument();
    });
  });
});
