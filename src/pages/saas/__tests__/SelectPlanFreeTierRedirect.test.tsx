/**
 * SelectPlanPage Free Tier Redirect Tests
 *
 * Verifies:
 * 1. Free tier users (is_free_tier=true) redirect to /{slug}/admin/dashboard
 * 2. Paid subscribers redirect to /{slug}/admin/settings/billing
 * 3. Slug is always used in redirect URLs (never hardcoded paths)
 * 4. handleSelectFreeTier uses slug from edge function response
 * 5. Missing slug from edge function falls back to /saas/login
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ============================================================================
// Mocks
// ============================================================================

const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams('tenant_id=tenant-123');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
    useLocation: () => ({ state: { fromSignup: true }, pathname: '/select-plan' }),
  };
});

const mockGetSession = vi.fn();
const mockInvoke = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              maybeSingle: () => mockMaybeSingle(),
            };
          },
        };
      },
    }),
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
  handleError: vi.fn(),
}));

vi.mock('@/components/marketing/ForceLightMode', () => ({
  ForceLightMode: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/FloraIQLogo', () => ({
  default: () => <div data-testid="logo" />,
}));

// Import the component under test
import SelectPlanPage from '../SelectPlanPage';
import { toast } from 'sonner';

// ============================================================================
// Helpers
// ============================================================================

function renderSelectPlanPage() {
  return render(
    <MemoryRouter initialEntries={['/select-plan?tenant_id=tenant-123']}>
      <SelectPlanPage />
    </MemoryRouter>,
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('SelectPlanPage free tier redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated session
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, access_token: 'tok' } },
    });
  });

  it('redirects free tier users to /{slug}/admin/dashboard', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        subscription_status: 'active',
        is_free_tier: true,
        slug: 'green-leaf',
      },
      error: null,
    });

    renderSelectPlanPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/green-leaf/admin/dashboard',
        { replace: true },
      );
    });
  });

  it('redirects paid subscribers to /{slug}/admin/settings/billing', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        subscription_status: 'active',
        is_free_tier: false,
        slug: 'pro-shop',
      },
      error: null,
    });

    renderSelectPlanPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/pro-shop/admin/settings/billing',
      );
    });
    expect(toast.info).toHaveBeenCalledWith(
      'You already have an active subscription. Redirecting to billing...',
    );
  });

  it('does not redirect when subscription is not active', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        subscription_status: 'trialing',
        is_free_tier: false,
        slug: 'test-shop',
      },
      error: null,
    });

    renderSelectPlanPage();

    // Wait for the auth + subscription checks to complete
    await waitFor(() => {
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    });

    // Should NOT have navigated
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/dashboard'),
      expect.anything(),
    );
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/settings/billing'),
    );
  });

  it('queries is_free_tier field (not subscription_plan)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    renderSelectPlanPage();

    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalledWith('subscription_status, is_free_tier, slug');
    });
  });

  it('uses slug from set-free-tier edge function response on free tier selection', async () => {
    // No existing subscription — show the page
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockInvoke.mockResolvedValue({
      data: { success: true, slug: 'my-dispensary', credits_granted: 500 },
      error: null,
    });

    renderSelectPlanPage();

    // Wait for page to render
    await waitFor(() => {
      expect(screen.getByText('Start Free')).toBeInTheDocument();
    });

    // Click the free tier button
    const freeButton = screen.getByText('Start Free');
    await userEvent.click(freeButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set-free-tier', {
        body: { tenant_id: 'tenant-123' },
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/my-dispensary/admin/dashboard',
        { replace: true },
      );
    });
  });

  it('redirects to /saas/login when edge function returns no slug', async () => {
    // No existing subscription — show the page
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockInvoke.mockResolvedValue({
      data: { success: true, slug: null, credits_granted: 500 },
      error: null,
    });

    renderSelectPlanPage();

    await waitFor(() => {
      expect(screen.getByText('Start Free')).toBeInTheDocument();
    });

    const freeButton = screen.getByText('Start Free');
    await userEvent.click(freeButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/saas/login',
        { replace: true },
      );
    });
  });
});
