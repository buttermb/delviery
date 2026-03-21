/**
 * SelectPlanPage — Active Paid User Redirect Tests
 *
 * Verifies that users with an active paid subscription are redirected
 * to the billing settings page, and free-tier users go to the dashboard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    useLocation: () => ({ state: null, pathname: '/select-plan', search: '', hash: '', key: 'default' }),
  };
});

const mockGetSession = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
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

// ============================================================================
// Helpers
// ============================================================================

function setupSupabaseQuery(tenantData: Record<string, unknown> | null, error: unknown = null) {
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: tenantData, error }),
      }),
    }),
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/select-plan?tenant_id=tenant-123']}>
      <SelectPlanPage />
    </MemoryRouter>,
  );
}

// ============================================================================
// Import after mocks
// ============================================================================

import SelectPlanPage from '../SelectPlanPage';
import { toast } from 'sonner';

// ============================================================================
// Tests
// ============================================================================

describe('SelectPlanPage — active subscription redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
    });
  });

  it('redirects active paid users to settings?tab=payments with replace', async () => {
    setupSupabaseQuery({
      subscription_status: 'active',
      subscription_plan: 'professional',
      slug: 'acme-corp',
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/acme-corp/admin/settings?tab=payments',
        { replace: true },
      );
    });

    expect(toast.info).toHaveBeenCalledWith(
      'You already have an active subscription. Redirecting to billing...',
    );
  });

  it('redirects active starter plan users to settings?tab=payments', async () => {
    setupSupabaseQuery({
      subscription_status: 'active',
      subscription_plan: 'starter',
      slug: 'my-shop',
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/my-shop/admin/settings?tab=payments',
        { replace: true },
      );
    });
  });

  it('redirects active enterprise plan users to settings?tab=payments', async () => {
    setupSupabaseQuery({
      subscription_status: 'active',
      subscription_plan: 'enterprise',
      slug: 'big-co',
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/big-co/admin/settings?tab=payments',
        { replace: true },
      );
    });
  });

  it('redirects active free-tier users to dashboard instead', async () => {
    setupSupabaseQuery({
      subscription_status: 'active',
      subscription_plan: 'free',
      slug: 'free-tenant',
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/free-tenant/admin/dashboard',
        { replace: true },
      );
    });

    // Should NOT show the billing toast
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('does not redirect trial users (non-active status)', async () => {
    setupSupabaseQuery({
      subscription_status: 'trialing',
      subscription_plan: 'professional',
      slug: 'trial-tenant',
    });

    renderPage();

    // Wait for plans to load and auth check to complete
    await waitFor(() => {
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('settings'),
      expect.anything(),
    );
  });

  it('does not redirect when tenant query errors', async () => {
    setupSupabaseQuery(null, { message: 'not found' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('settings'),
      expect.anything(),
    );
  });

  it('does not redirect when no tenant_id in search params', async () => {
    // Override searchParams to have no tenant_id
    mockSearchParams.delete('tenant_id');

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('settings'),
      expect.anything(),
    );

    // Restore
    mockSearchParams.set('tenant_id', 'tenant-123');
  });
});
