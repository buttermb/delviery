import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// --- Navigation mock ---
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// --- Logger mock ---
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// --- Sonner mock ---
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

// --- Error handling mock ---
vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

// --- Supabase mock ---
const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    functions: { invoke: mockInvoke },
  },
}));

// --- Credits mock ---
vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 500,
}));

// --- Subscription status mock ---
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
  needsPaymentMethod: false,
  isTrialExpired: false,
  currentTier: 'starter' as string,
  status: undefined as string | undefined,
  tenant: undefined as Record<string, unknown> | undefined,
};

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockSubscriptionStatus,
}));

// --- Tenant admin auth mock ---
const mockTenant = { id: 'tenant-123', slug: 'acme' };
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    refreshTenant: vi.fn(),
  }),
}));

// --- cn mock ---
vi.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

import SelectPlanPage from '@/pages/tenant-admin/SelectPlanPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <SelectPlanPage />
    </MemoryRouter>,
  );
}

function setEnterprise(active: boolean) {
  mockSubscriptionStatus.isEnterprise = true;
  mockSubscriptionStatus.hasActiveSubscription = active;
  mockSubscriptionStatus.isActive = active;
  mockSubscriptionStatus.currentTier = 'enterprise';
  mockSubscriptionStatus.status = 'active';
  mockSubscriptionStatus.canUpgrade = false;
}

function resetToStarter() {
  mockSubscriptionStatus.isFreeTier = false;
  mockSubscriptionStatus.isEnterprise = false;
  mockSubscriptionStatus.isProfessional = false;
  mockSubscriptionStatus.isStarter = true;
  mockSubscriptionStatus.isTrial = false;
  mockSubscriptionStatus.isActive = true;
  mockSubscriptionStatus.hasActiveSubscription = true;
  mockSubscriptionStatus.currentTier = 'starter';
  mockSubscriptionStatus.status = 'active';
  mockSubscriptionStatus.canUpgrade = true;
  mockSubscriptionStatus.canDowngrade = false;
}

describe('SelectPlanPage — Enterprise Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetToStarter();
  });

  describe('when user is on Enterprise with active subscription', () => {
    beforeEach(() => {
      setEnterprise(true);
    });

    it('renders the enterprise guard UI instead of plan cards', () => {
      renderPage();

      expect(screen.getByText("You're on our highest tier!")).toBeInTheDocument();
      expect(screen.getByText(/You have access to all features with our Enterprise plan/)).toBeInTheDocument();
    });

    it('displays the Crown icon area', () => {
      renderPage();

      // Crown icon is in a rounded-full container
      const heading = screen.getByText("You're on our highest tier!");
      expect(heading.tagName).toBe('H1');
    });

    it('shows enterprise benefits alert', () => {
      renderPage();

      expect(screen.getByText(/Enterprise Plan Benefits:/)).toBeInTheDocument();
      expect(screen.getByText(/Unlimited everything, priority support/)).toBeInTheDocument();
      expect(screen.getByText(/custom integrations, and dedicated account management/)).toBeInTheDocument();
    });

    it('renders "Back to Dashboard" button that navigates correctly', () => {
      renderPage();

      const dashboardBtn = screen.getByRole('button', { name: /back to dashboard/i });
      expect(dashboardBtn).toBeInTheDocument();

      fireEvent.click(dashboardBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/acme/admin/dashboard');
    });

    it('renders "Manage Subscription" button', () => {
      renderPage();

      const manageBtn = screen.getByRole('button', { name: /manage subscription/i });
      expect(manageBtn).toBeInTheDocument();
      expect(manageBtn).not.toBeDisabled();
    });

    it('opens Stripe portal on "Manage Subscription" click', async () => {
      const mockOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      mockInvoke.mockResolvedValueOnce({
        data: { url: 'https://billing.stripe.com/portal/test' },
        error: null,
      });

      renderPage();

      const manageBtn = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(manageBtn);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
          body: { tenant_id: 'tenant-123' },
        });
      });

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith(
          'https://billing.stripe.com/portal/test',
          '_blank',
          'noopener,noreferrer',
        );
      });

      mockOpen.mockRestore();
    });

    it('shows loading state while portal is loading', async () => {
      // Make the invoke hang to observe loading state
      mockInvoke.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: { url: 'https://test.com' }, error: null }), 500)),
      );

      renderPage();

      const manageBtn = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(manageBtn);

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    it('handles portal error gracefully', async () => {
      const { handleError } = await import('@/utils/errorHandling/handlers');
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('Stripe error'),
      });

      renderPage();

      const manageBtn = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(manageBtn);

      await waitFor(() => {
        expect(handleError).toHaveBeenCalled();
      });
    });

    it('does NOT render plan selection cards', () => {
      renderPage();

      expect(screen.queryByText('Choose Your Plan')).not.toBeInTheDocument();
      expect(screen.queryByText('Monthly')).not.toBeInTheDocument();
      expect(screen.queryByText('Yearly')).not.toBeInTheDocument();
    });
  });

  describe('when user is on Enterprise but subscription is NOT active', () => {
    beforeEach(() => {
      mockSubscriptionStatus.isEnterprise = true;
      mockSubscriptionStatus.hasActiveSubscription = false;
      mockSubscriptionStatus.isActive = false;
      mockSubscriptionStatus.currentTier = 'enterprise';
      mockSubscriptionStatus.status = 'cancelled';
    });

    it('does NOT show enterprise guard — shows plan selection instead', () => {
      renderPage();

      expect(screen.queryByText("You're on our highest tier!")).not.toBeInTheDocument();
      // Plan selection UI should be visible
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });
  });

  describe('when user is NOT on Enterprise tier', () => {
    it('shows plan selection for starter tier', () => {
      resetToStarter();
      renderPage();

      expect(screen.queryByText("You're on our highest tier!")).not.toBeInTheDocument();
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    it('shows plan selection for professional tier', () => {
      mockSubscriptionStatus.isEnterprise = false;
      mockSubscriptionStatus.isProfessional = true;
      mockSubscriptionStatus.currentTier = 'professional';
      mockSubscriptionStatus.hasActiveSubscription = true;
      mockSubscriptionStatus.isActive = true;

      renderPage();

      expect(screen.queryByText("You're on our highest tier!")).not.toBeInTheDocument();
      expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    });

    it('shows plan selection for free tier', () => {
      mockSubscriptionStatus.isFreeTier = true;
      mockSubscriptionStatus.isEnterprise = false;
      mockSubscriptionStatus.isStarter = false;
      mockSubscriptionStatus.currentTier = 'starter';
      mockSubscriptionStatus.hasActiveSubscription = false;

      renderPage();

      expect(screen.queryByText("You're on our highest tier!")).not.toBeInTheDocument();
    });
  });
});
