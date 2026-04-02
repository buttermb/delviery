/**
 * VerifyEmailPage Tests
 *
 * Tests the tenant admin email verification page:
 * - Renders verification prompt when email not verified
 * - Shows verified state when email is verified
 * - Handles resend verification email flow
 * - Handles error states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockNavigate, mockInvoke, mockRefreshSession, mockFrom } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockInvoke: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tenantSlug: 'test-store' }),
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue = { data: null, error: null }) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
    return chain;
  };

  mockFrom.mockImplementation(() =>
    createChainMock({ data: { email_verified: false, email: 'admin@test.com' }, error: null })
  );

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
      },
      auth: {
        refreshSession: mockRefreshSession,
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
    },
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    admin: { id: 'admin-1', email: 'admin@test.com', name: 'Test Admin' },
    tenant: { id: 'tenant-1', slug: 'test-store', business_name: 'Test Store' },
    tenantSlug: 'test-store',
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    emailVerification: {
      all: ['email-verification-status'],
      byAdmin: (adminId?: string) => ['email-verification-status', adminId],
    },
  },
}));

import VerifyEmailPage from '../VerifyEmailPage';

function createChainMock(resolvedValue = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
  return chain;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-store/admin/verify-email']}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set default: unverified email
    mockFrom.mockImplementation(() =>
      createChainMock({ data: { email_verified: false, email: 'admin@test.com' }, error: null })
    );
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'valid-token' } },
      error: null,
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('should render the verification prompt', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    expect(screen.getByText(/admin@test.com/)).toBeInTheDocument();
    expect(screen.getByText('Resend Verification Email')).toBeInTheDocument();
    expect(screen.getByText('Skip for now')).toBeInTheDocument();

    // Button shows "Checking..." while query loads, then switches
    await waitFor(() => {
      expect(screen.getByText("I've verified my email")).toBeInTheDocument();
    });
  });

  it('should show verified state when email is verified', async () => {
    mockFrom.mockImplementation(() =>
      createChainMock({ data: { email_verified: true, email: 'admin@test.com' }, error: null })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    });

    expect(screen.getByText('Continue to Dashboard')).toBeInTheDocument();
  });

  it('should navigate to dashboard when "Continue to Dashboard" is clicked', async () => {
    mockFrom.mockImplementation(() =>
      createChainMock({ data: { email_verified: true, email: 'admin@test.com' }, error: null })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Continue to Dashboard')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Continue to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/test-store/admin/dashboard');
  });

  it('should navigate to dashboard when "Skip for now" is clicked', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Skip for now')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Skip for now'));
    expect(mockNavigate).toHaveBeenCalledWith('/test-store/admin/dashboard');
  });

  it('should call resend-admin-verification when resend button is clicked', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Resend Verification Email')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Resend Verification Email'));

    await waitFor(() => {
      expect(mockRefreshSession).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith('resend-admin-verification', {
        body: { email: 'admin@test.com', tenant_slug: 'test-store' },
      });
    });
  });

  it('should show error when resend fails with edge function error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Function returned error', name: 'FunctionsHttpError' },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Resend Verification Email')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Resend Verification Email'));

    await waitFor(() => {
      expect(screen.getByText('Error Sending Email')).toBeInTheDocument();
    });
  });

  it('should show error when resend returns API error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'Email service not configured' },
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Resend Verification Email')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Resend Verification Email'));

    await waitFor(() => {
      expect(screen.getByText('Error Sending Email')).toBeInTheDocument();
      expect(screen.getByText('Email service not configured')).toBeInTheDocument();
    });
  });

  it('should show error when session refresh fails', async () => {
    mockRefreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Session expired' },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Resend Verification Email')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Resend Verification Email'));

    await waitFor(() => {
      expect(screen.getByText('Error Sending Email')).toBeInTheDocument();
    });

    // Should not call invoke if session refresh failed
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should include troubleshooting link in error state', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'Some error' },
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Resend Verification Email')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Resend Verification Email'));

    await waitFor(() => {
      expect(screen.getByText('troubleshooting guide')).toBeInTheDocument();
    });
  });
});
