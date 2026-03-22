/**
 * BillingPage "Manage Subscription" Button Tests
 *
 * Verifies the "Manage Subscription" button in the Current Plan tab:
 * 1. Renders and is clickable
 * 2. Calls stripe-customer-portal edge function with tenant_id
 * 3. Opens portal URL in new tab on success
 * 4. Shows error when not authenticated
 * 5. Shows error when edge function fails
 * 6. Shows error when no portal URL returned
 * 7. Shows loading state while processing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Hoist mock references so vi.mock factories can use them
const { mockNavigate, mockSupabaseAuth, mockFunctionsInvoke, mockToast, mockWindowOpen } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSupabaseAuth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  mockFunctionsInvoke: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  mockWindowOpen: vi.fn(),
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tenantSlug: 'test-tenant' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock supabase client
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
    chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => createChainMock()),
      functions: {
        invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
      },
      auth: mockSupabaseAuth,
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    },
  };
});

// Mock TenantAdminAuthContext
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
      business_tier: 'block',
      usage: { products: 15, customers: 42, menus: 8, locations: 1, users: 2 },
      limits: { products: 500, customers: 200, menus: 10, locations: 5, users: 10 },
    },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com', role: 'owner', tenant_id: 'tenant-123', userId: 'user-1' },
    tenantSlug: 'test-tenant',
    logout: vi.fn(),
    refreshTenant: vi.fn(),
  }),
}));

// Mock feature access
vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: vi.fn().mockReturnValue({
    currentTier: 'block',
    hasAccess: vi.fn().mockReturnValue(true),
    getRequiredTier: vi.fn().mockReturnValue('starter'),
  }),
}));

// Mock credits
vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 500,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 100,
  }),
}));

// Mock Stripe redirect handler
vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: mockToast,
}));

// Mock billing components
vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/tenant-admin/TrialBanner', () => ({
  TrialBanner: () => null,
}));

vi.mock('@/components/tenant-admin/TrialCountdown', () => ({
  TrialCountdown: () => null,
}));

vi.mock('@/components/integrations/IntegrationStatus', () => ({
  IntegrationStatus: () => <div data-testid="integration-status">Integration Status</div>,
}));

vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => null,
}));

vi.mock('@/components/credits/CreditPurchaseModal', () => ({
  CreditPurchaseModal: () => null,
}));

// Import the component under test
import TenantAdminBillingPage from '../BillingPage';

// Test wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('BillingPage - Manage Subscription Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated session
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token', user: { id: 'user-1' } } },
      error: null,
    });
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabaseAuth.signOut.mockResolvedValue({ error: null });
    mockSupabaseAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    // Default: edge functions return null (no-op)
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: null });

    // Mock window.open
    window.open = mockWindowOpen;
  });

  it('renders the Manage Subscription button in the Current Plan card', async () => {
    render(<TenantAdminBillingPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /manage subscription/i })).toBeInTheDocument();
    });
  });

  it('calls stripe-customer-portal with tenant_id on click and opens URL', async () => {
    const portalUrl = 'https://billing.stripe.com/session/test-portal-session';

    mockFunctionsInvoke.mockImplementation(async (fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return { data: { url: portalUrl }, error: null };
      }
      return { data: null, error: null };
    });

    const user = userEvent.setup();
    render(<TenantAdminBillingPage />, { wrapper: createWrapper() });

    const manageBtn = await screen.findByRole('button', { name: /manage subscription/i });
    await user.click(manageBtn);

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
        body: { tenant_id: 'tenant-123' },
      });
    });

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(portalUrl, '_blank', 'noopener,noreferrer');
    });

    expect(mockToast.success).toHaveBeenCalledWith('Success', {
      description: 'Opening Stripe Customer Portal...',
    });
  });

  it('shows error toast when session is missing (not authenticated)', async () => {
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const user = userEvent.setup();
    render(<TenantAdminBillingPage />, { wrapper: createWrapper() });

    const manageBtn = await screen.findByRole('button', { name: /manage subscription/i });
    await user.click(manageBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Not Authenticated', {
        description: 'Please log in to manage payment methods.',
      });
    });

    // Should NOT call the edge function
    expect(mockFunctionsInvoke).not.toHaveBeenCalledWith(
      'stripe-customer-portal',
      expect.anything()
    );
  });

  it('shows error toast when edge function returns an error', async () => {
    mockFunctionsInvoke.mockImplementation(async (fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return { data: null, error: new Error('Edge function failed') };
      }
      return { data: null, error: null };
    });

    const user = userEvent.setup();
    render(<TenantAdminBillingPage />, { wrapper: createWrapper() });

    const manageBtn = await screen.findByRole('button', { name: /manage subscription/i });
    await user.click(manageBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error', expect.objectContaining({
        description: expect.stringContaining('Edge function failed'),
      }));
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('shows error toast when response body contains an error field', async () => {
    mockFunctionsInvoke.mockImplementation(async (fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return { data: { error: 'Stripe customer not found' }, error: null };
      }
      return { data: null, error: null };
    });

    const user = userEvent.setup();
    render(<TenantAdminBillingPage />, { wrapper: createWrapper() });

    const manageBtn = await screen.findByRole('button', { name: /manage subscription/i });
    await user.click(manageBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error', {
        description: 'Stripe customer not found',
      });
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('shows error toast when no portal URL is returned', async () => {
    mockFunctionsInvoke.mockImplementation(async (fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return { data: { success: true }, error: null };
      }
      return { data: null, error: null };
    });

    const user = userEvent.setup();
    render(<TenantAdminBillingPage />, { wrapper: createWrapper() });

    const manageBtn = await screen.findByRole('button', { name: /manage subscription/i });
    await user.click(manageBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error', {
        description: 'No portal URL returned from Stripe',
      });
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('disables button while loading and re-enables after completion', async () => {
    // Slow-resolve to observe loading state
    let resolvePortal: (value: { data: { url: string }; error: null }) => void;
    const portalPromise = new Promise<{ data: { url: string }; error: null }>((resolve) => {
      resolvePortal = resolve;
    });

    mockFunctionsInvoke.mockImplementation(async (fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return portalPromise;
      }
      return { data: null, error: null };
    });

    const user = userEvent.setup();
    render(<TenantAdminBillingPage />, { wrapper: createWrapper() });

    const manageBtn = await screen.findByRole('button', { name: /manage subscription/i });
    expect(manageBtn).not.toBeDisabled();

    await user.click(manageBtn);

    // Button should be disabled while loading
    await waitFor(() => {
      expect(manageBtn).toBeDisabled();
    });

    // Resolve the promise
    resolvePortal!({ data: { url: 'https://stripe.com/portal' }, error: null });

    // Button should re-enable after completion
    await waitFor(() => {
      expect(manageBtn).not.toBeDisabled();
    });
  });
});
