/**
 * SaaS SelectPlanPage — Redirect Tests
 *
 * Verifies that active free-tier users are redirected to dashboard,
 * active paid users are redirected to billing, and unauthenticated
 * or new users stay on the plan selection page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ============================================================================
// Mocks
// ============================================================================

const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockLocation = { state: null, pathname: '/select-plan', search: '', hash: '', key: 'default' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
    useLocation: () => mockLocation,
  };
});

const mockGetSession = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn().mockReturnValue('Error message'),
}));

vi.mock('@/components/FloraIQLogo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('@/components/marketing/ForceLightMode', () => ({
  ForceLightMode: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 500,
}));

vi.mock('@/config/planPricing', () => ({
  PLAN_CONFIG: {
    free: { name: 'Free', priceMonthly: 0, priceYearly: 0, stripePriceId: null, stripeProductId: null, description: 'Free plan', trialDays: 14 },
    starter: { name: 'Starter', priceMonthly: 79, priceYearly: 790, stripePriceId: 'price_starter', stripeProductId: 'prod_starter', description: 'Starter plan', trialDays: 14 },
    professional: { name: 'Professional', priceMonthly: 150, priceYearly: 1500, stripePriceId: 'price_pro', stripeProductId: 'prod_pro', description: 'Pro plan', trialDays: 14 },
    enterprise: { name: 'Enterprise', priceMonthly: 499, priceYearly: 4990, stripePriceId: 'price_ent', stripeProductId: 'prod_ent', description: 'Enterprise plan', trialDays: 14 },
  },
  getPlanConfig: () => ({ name: 'Free', priceMonthly: 0, description: 'Free plan' }),
}));

// ============================================================================
// Constants
// ============================================================================

const TENANT_ID = 'tenant-test-123';
const TENANT_SLUG = 'acme-dispensary';

const MOCK_SESSION = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-123', email: 'test@example.com' },
};

// ============================================================================
// Helpers
// ============================================================================

function setupAuthenticatedUser() {
  mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
}

function setupTenantQuery(tenantData: Record<string, unknown> | null, error: unknown = null) {
  mockMaybeSingle.mockResolvedValue({ data: tenantData, error });
}

async function renderSelectPlanPage() {
  const { default: SelectPlanPage } = await import('../SelectPlanPage');
  return render(
    <MemoryRouter>
      <SelectPlanPage />
    </MemoryRouter>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('SaaS SelectPlanPage — Redirect behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('tenant_id');
    mockLocation.state = null;
  });

  describe('Active free-tier user redirect', () => {
    it('should redirect to dashboard when is_free_tier is true and status is active', async () => {
      mockSearchParams.set('tenant_id', TENANT_ID);
      setupAuthenticatedUser();
      setupTenantQuery({
        subscription_status: 'active',
        subscription_plan: 'free',
        is_free_tier: true,
        payment_method_added: false,
        slug: TENANT_SLUG,
      });

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          `/${TENANT_SLUG}/admin/dashboard`,
          { replace: true }
        );
      });
    });

    it('should use is_free_tier as source of truth, not subscription_plan', async () => {
      // Edge case: subscription_plan might be something other than 'free' but is_free_tier is true
      mockSearchParams.set('tenant_id', TENANT_ID);
      setupAuthenticatedUser();
      setupTenantQuery({
        subscription_status: 'active',
        subscription_plan: 'starter', // plan says starter
        is_free_tier: true, // but is_free_tier is true (source of truth)
        payment_method_added: false,
        slug: TENANT_SLUG,
      });

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          `/${TENANT_SLUG}/admin/dashboard`,
          { replace: true }
        );
      });
    });

    it('should log redirect for active free-tier users', async () => {
      const { logger } = await import('@/lib/logger');

      mockSearchParams.set('tenant_id', TENANT_ID);
      setupAuthenticatedUser();
      setupTenantQuery({
        subscription_status: 'active',
        subscription_plan: 'free',
        is_free_tier: true,
        payment_method_added: false,
        slug: TENANT_SLUG,
      });

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[SELECT_PLAN] Active free-tier user, redirecting to dashboard',
          expect.objectContaining({ tenantId: TENANT_ID, slug: TENANT_SLUG })
        );
      });
    });
  });

  describe('Active paid subscriber redirect', () => {
    it('should redirect to billing when user has active paid subscription', async () => {
      const { toast } = await import('sonner');

      mockSearchParams.set('tenant_id', TENANT_ID);
      setupAuthenticatedUser();
      setupTenantQuery({
        subscription_status: 'active',
        subscription_plan: 'professional',
        is_free_tier: false,
        payment_method_added: true,
        slug: TENANT_SLUG,
      });

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith(
          'You already have an active subscription. Redirecting to billing...'
        );
        expect(mockNavigate).toHaveBeenCalledWith(
          `/${TENANT_SLUG}/admin/settings/billing`,
          { replace: true }
        );
      });
    });

    it('should not redirect paid users who lack payment_method_added', async () => {
      mockSearchParams.set('tenant_id', TENANT_ID);
      setupAuthenticatedUser();
      setupTenantQuery({
        subscription_status: 'active',
        subscription_plan: 'professional',
        is_free_tier: false,
        payment_method_added: false,
        slug: TENANT_SLUG,
      });

      await renderSelectPlanPage();

      // Wait for loading to finish and plans to render
      await waitFor(() => {
        expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
      });

      // Navigate should not have been called for billing or dashboard redirect
      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/admin/settings/billing'),
        expect.anything()
      );
    });
  });

  describe('Non-redirect scenarios', () => {
    it('should not redirect when subscription_status is not active', async () => {
      mockSearchParams.set('tenant_id', TENANT_ID);
      setupAuthenticatedUser();
      setupTenantQuery({
        subscription_status: 'trial',
        subscription_plan: 'free',
        is_free_tier: false,
        payment_method_added: false,
        slug: TENANT_SLUG,
      });

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/admin/dashboard'),
        expect.anything()
      );
    });

    it('should not redirect when no tenant_id in search params', async () => {
      // No tenant_id set
      setupAuthenticatedUser();

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/admin/dashboard'),
        expect.anything()
      );
    });

    it('should not redirect when tenant query returns error', async () => {
      mockSearchParams.set('tenant_id', TENANT_ID);
      setupAuthenticatedUser();
      setupTenantQuery(null, { message: 'Not found' });

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/admin/dashboard'),
        expect.anything()
      );
    });

    it('should not redirect cancelled free-tier users', async () => {
      mockSearchParams.set('tenant_id', TENANT_ID);
      setupAuthenticatedUser();
      setupTenantQuery({
        subscription_status: 'cancelled',
        subscription_plan: 'free',
        is_free_tier: true,
        payment_method_added: false,
        slug: TENANT_SLUG,
      });

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/admin/dashboard'),
        expect.anything()
      );
    });
  });

  describe('Unauthenticated user redirect', () => {
    it('should redirect to login when not authenticated and not from signup', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await renderSelectPlanPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/saas/login?returnUrl=/select-plan');
      });
    });
  });
});
