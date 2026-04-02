/**
 * AuthCallbackPage Tests
 *
 * Tests the auth callback page that handles post-authentication redirects
 * for magic links, Google OAuth, and other auth methods.
 *
 * Key behaviors:
 * - Session exchange from URL code
 * - Redirect to correct dashboard per portal type
 * - Generic success toast (not provider-specific)
 * - Error handling and redirect-loop detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGetSession = vi.fn();
const mockExchangeCode = vi.fn();
const mockSignOut = vi.fn();
const mockGetAAL = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCode(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      mfa: {
        getAuthenticatorAssuranceLevel: (...args: unknown[]) => mockGetAAL(...args),
      },
    },
  },
}));

const mockToast = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign(mockToast, {
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

vi.mock('@/hooks/useIntendedDestination', () => ({
  intendedDestinationUtils: {
    consume: vi.fn().mockReturnValue(null),
    save: vi.fn(),
  },
}));

vi.mock('@/constants/storageKeys', () => ({
  STORAGE_KEYS: {
    SUPABASE_AUTH_TOKEN: 'sb-auth-token',
  },
}));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Default: session exists, no MFA
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
      error: null,
    });
    mockGetAAL.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });

    // Clear sessionStorage
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const renderCallback = async (portal: string, path: string) => {
    const { AuthCallbackPage, CustomerAuthCallback, TenantAdminAuthCallback, SuperAdminAuthCallback } = await import('../AuthCallbackPage');

    const Component = portal === 'customer'
      ? CustomerAuthCallback
      : portal === 'tenant-admin'
        ? TenantAdminAuthCallback
        : SuperAdminAuthCallback;

    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:tenantSlug/customer/auth/callback" element={<Component />} />
          <Route path="/:tenantSlug/admin/auth/callback" element={<Component />} />
          <Route path="/super-admin/auth/callback" element={<Component />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('should show loading state initially', async () => {
    // Never-resolving session to keep loading state
    mockGetSession.mockImplementation(() => new Promise(() => {}));

    await renderCallback('customer', '/test-store/customer/auth/callback');

    expect(screen.getByText(/completing sign in/i)).toBeInTheDocument();
  });

  it('should show success state after session is established', async () => {
    await renderCallback('customer', '/test-store/customer/auth/callback');

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });

  it('should display generic success toast, not provider-specific', async () => {
    const { toast } = await import('sonner');

    await renderCallback('customer', '/test-store/customer/auth/callback');

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Welcome!',
        expect.objectContaining({
          description: "You've been signed in successfully.",
        })
      );
    });

    // Must NOT mention Google or any specific provider
    const successCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(successCall[1].description).not.toContain('Google');
  });

  it('should redirect customer to shop dashboard', async () => {
    await renderCallback('customer', '/test-store/customer/auth/callback');

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    // Advance past the redirect timeout
    vi.advanceTimersByTime(1500);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/test-store/shop/dashboard',
      { replace: true }
    );
  });

  it('should redirect tenant-admin to admin dashboard', async () => {
    await renderCallback('tenant-admin', '/test-store/admin/auth/callback');

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    vi.advanceTimersByTime(1500);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/test-store/admin/dashboard',
      { replace: true }
    );
  });

  it('should exchange code for session when no existing session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockExchangeCode.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
      error: null,
    });

    await renderCallback('customer', '/test-store/customer/auth/callback?code=auth-code-123');

    await waitFor(() => {
      expect(mockExchangeCode).toHaveBeenCalledWith('auth-code-123');
    });

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });

  it('should show error when no session and no code', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await renderCallback('customer', '/test-store/customer/auth/callback');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /authentication failed/i })).toBeInTheDocument();
    });
  });

  it('should show error when session exchange fails', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockExchangeCode.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid or expired code' },
    });

    await renderCallback('customer', '/test-store/customer/auth/callback?code=bad-code');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /authentication failed/i })).toBeInTheDocument();
    });
  });

  it('should detect redirect loops', async () => {
    // Simulate prior redirect timestamps
    const now = Date.now();
    sessionStorage.setItem(
      'auth_redirect_timestamps',
      JSON.stringify([now - 3000, now - 2000, now - 1000])
    );

    await renderCallback('customer', '/test-store/customer/auth/callback');

    await waitFor(() => {
      expect(screen.getByText(/login issue detected/i)).toBeInTheDocument();
    });
  });

  it('should redirect to MFA challenge when required', async () => {
    mockGetAAL.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
      error: null,
    });

    await renderCallback('customer', '/test-store/customer/auth/callback');

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    vi.advanceTimersByTime(1500);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/test-store/customer/auth/mfa-challenge',
      { replace: true }
    );
  });
});
