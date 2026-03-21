/**
 * SelectPlanPage Tests
 * Verifies that free tier redirect and payment status redirect
 * correctly use tenant slug in navigation paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mock navigate ---
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// --- Mock logger ---
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- Mock sonner ---
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// --- Mock error handling ---
vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

// --- Mock supabase ---
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { maybeSingle: mockMaybeSingle };
          },
        };
      },
    }),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

// --- Mock tenant admin auth ---
const mockTenant = {
  id: 'tenant-123',
  slug: 'my-dispensary',
  subscription_status: 'trialing',
  subscription_plan: 'starter',
  is_free_tier: false,
  payment_method_added: false,
  trial_ends_at: new Date(Date.now() + 86400000 * 14).toISOString(),
};

const mockRefreshTenant = vi.fn().mockResolvedValue(undefined);

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    refreshTenant: mockRefreshTenant,
  }),
}));

// --- Mock subscription status ---
const mockSubscriptionStatus = {
  isFreeTier: false,
  isEnterprise: false,
  isProfessional: false,
  isStarter: true,
  isTrial: true,
  isActive: false,
  isSuspended: false,
  isCancelled: false,
  isPastDue: false,
  hasActiveSubscription: true,
  canUpgrade: true,
  canDowngrade: false,
  needsPaymentMethod: true,
  isTrialExpired: false,
  currentTier: 'starter' as const,
  status: 'trialing',
  tenant: mockTenant,
};

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockSubscriptionStatus,
}));

// --- Mock credits constant ---
vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 500,
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderSelectPlanPage() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/my-dispensary/admin/select-plan']}>
        <SelectPlanPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Lazy import so mocks are in place
let SelectPlanPage: typeof import('../SelectPlanPage').default;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset tenant to default
  mockTenant.id = 'tenant-123';
  mockTenant.slug = 'my-dispensary';
  mockTenant.subscription_status = 'trialing';
  mockTenant.is_free_tier = false;
  mockTenant.payment_method_added = false;

  // Default: no active subscription (don't auto-redirect)
  mockMaybeSingle.mockResolvedValue({
    data: {
      payment_method_added: false,
      subscription_status: 'trialing',
      is_free_tier: false,
      slug: 'my-dispensary',
    },
    error: null,
  });

  // Import fresh module
  const mod = await import('../SelectPlanPage');
  SelectPlanPage = mod.default;
});

describe('SelectPlanPage', () => {
  describe('payment status redirect uses slug', () => {
    it('redirects to dashboard using freshTenant.slug when already paid', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: true,
          subscription_status: 'active',
          is_free_tier: false,
          slug: 'fresh-slug',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/fresh-slug/admin/dashboard',
          { replace: true },
        );
      });
    });

    it('redirects using freshTenant.slug when free tier is active', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'active',
          is_free_tier: true,
          slug: 'free-tenant-slug',
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/free-tenant-slug/admin/dashboard',
          { replace: true },
        );
      });
    });

    it('falls back to tenant.slug when freshTenant.slug is missing', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: true,
          subscription_status: 'active',
          is_free_tier: false,
          slug: null,
        },
        error: null,
      });

      renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/my-dispensary/admin/dashboard',
          { replace: true },
        );
      });
    });

    it('does not redirect when subscription is not active', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_method_added: false,
          subscription_status: 'trialing',
          is_free_tier: false,
          slug: 'my-dispensary',
        },
        error: null,
      });

      renderSelectPlanPage();

      // Wait for the effect to run
      await waitFor(() => {
        expect(mockMaybeSingle).toHaveBeenCalled();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('handleSelectFreeTier uses slug', () => {
    it('navigates using edge function slug after selecting free tier', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true, slug: 'edge-fn-slug', credits_granted: 500 },
        error: null,
      });

      renderSelectPlanPage();

      // Find and click the "Switch to Free" button
      const freeButton = await screen.findByRole('button', { name: /switch to free/i });
      await userEvent.click(freeButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('set-free-tier', {
          body: { tenant_id: 'tenant-123' },
        });
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/edge-fn-slug/admin/dashboard',
          { replace: true },
        );
      });
    });

    it('falls back to tenant.slug when edge function returns no slug', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      renderSelectPlanPage();

      const freeButton = await screen.findByRole('button', { name: /switch to free/i });
      await userEvent.click(freeButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/my-dispensary/admin/dashboard',
          { replace: true },
        );
      });
    });

    it('refreshes tenant context before navigating', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true, slug: 'my-dispensary' },
        error: null,
      });

      renderSelectPlanPage();

      const freeButton = await screen.findByRole('button', { name: /switch to free/i });
      await userEvent.click(freeButton);

      await waitFor(() => {
        expect(mockRefreshTenant).toHaveBeenCalled();
      });
    });
  });

  describe('navigation buttons use slug', () => {
    it('back to dashboard button uses tenant slug', async () => {
      renderSelectPlanPage();

      const dashboardButton = await screen.findByRole('button', { name: /dashboard/i });
      await userEvent.click(dashboardButton);

      expect(mockNavigate).toHaveBeenCalledWith('/my-dispensary/admin/dashboard');
    });
  });
});
