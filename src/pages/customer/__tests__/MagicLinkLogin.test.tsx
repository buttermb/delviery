/**
 * Magic Link Login Tests
 *
 * Tests the magic link login flow in CustomerLoginPage:
 * - Toggling between password and magic link modes
 * - Sending magic link via edge function
 * - Error handling for failed requests
 * - Rate limit display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock env vars
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});

const mockMaybeSingle = vi.fn().mockResolvedValue({
  data: { id: 'tenant-001', slug: 'test-store', business_name: 'Test Store' },
  error: null,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: () => mockMaybeSingle(),
        }),
      }),
    }),
  },
}));

vi.mock('@/contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    login: vi.fn().mockRejectedValue(new Error('Invalid credentials')),
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    loading: false,
  }),
}));

vi.mock('@/hooks/useAuthRedirect', () => ({
  useAuthRedirect: vi.fn(),
}));

vi.mock('@/hooks/useAuthOffline', () => ({
  useAuthOffline: () => ({
    isOnline: true,
    hasQueuedAttempt: false,
    queueLoginAttempt: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCsrfToken', () => ({
  useCsrfToken: () => ({
    csrfToken: 'test-csrf-token',
    validateToken: vi.fn().mockReturnValue(true),
    refreshToken: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAuthRateLimit', () => ({
  useAuthRateLimit: () => ({
    isLocked: false,
    remainingSeconds: 0,
    attemptCount: 0,
    recordAttempt: vi.fn(),
    resetOnSuccess: vi.fn(),
  }),
}));

vi.mock('@/hooks/useIntendedDestination', () => ({
  intendedDestinationUtils: {
    consume: vi.fn().mockReturnValue(null),
    save: vi.fn(),
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

vi.mock('@/components/auth/AuthErrorAlert', () => ({
  AuthErrorAlert: ({ message }: { message: string }) =>
    message ? <div role="alert">{message}</div> : null,
  getAuthErrorType: () => 'error',
  getAuthErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock('@/components/auth/RateLimitWarning', () => ({
  RateLimitWarning: () => null,
}));

vi.mock('@/components/auth/AuthOfflineIndicator', () => ({
  AuthOfflineIndicator: () => null,
}));

vi.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => <button>Sign in with Google</button>,
}));

vi.mock('@/components/auth/ForgotPasswordDialog', () => ({
  ForgotPasswordDialog: () => null,
}));

describe('CustomerLoginPage - Magic Link Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'tenant-001', slug: 'test-store', business_name: 'Test Store' },
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = async () => {
    const { default: CustomerLoginPage } = await import('../../customer/LoginPage');

    render(
      <MemoryRouter initialEntries={['/test-store/customer/login']}>
        <Routes>
          <Route path="/:tenantSlug/customer/login" element={<CustomerLoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for tenant to load
    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });
  };

  it('should start in password mode by default', async () => {
    await renderPage();

    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to shop/i })).toBeInTheDocument();
    expect(screen.getByText(/send magic link instead/i)).toBeInTheDocument();
  });

  it('should toggle to magic link mode when clicking the toggle', async () => {
    await renderPage();

    const toggleButton = screen.getByText(/send magic link instead/i);
    fireEvent.click(toggleButton);

    // Password field should be gone, magic link button should appear
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument();
  });

  it('should toggle back to password mode', async () => {
    await renderPage();

    // Toggle to magic link
    fireEvent.click(screen.getByText(/send magic link instead/i));
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument();

    // Toggle back to password
    fireEvent.click(screen.getByText(/use password instead/i));
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('should send magic link request to edge function on submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: 'Check your email for a login link!',
      }),
    });

    await renderPage();

    // Toggle to magic link mode
    fireEvent.click(screen.getByText(/send magic link instead/i));

    // Enter email
    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    // Submit
    const submitButton = screen.getByRole('button', { name: /send magic link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/magic-link-login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('user@example.com'),
        })
      );
    });
  });

  it('should include redirectTo in magic link request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Link sent' }),
    });

    await renderPage();

    fireEvent.click(screen.getByText(/send magic link instead/i));

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.redirectTo).toContain('/test-store/customer/auth/callback');
    });
  });

  it('should show success toast after sending magic link', async () => {
    const { toast } = await import('sonner');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: 'Check your email for a login link!',
      }),
    });

    await renderPage();

    fireEvent.click(screen.getByText(/send magic link instead/i));

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Magic Link Sent!',
        expect.objectContaining({
          description: expect.stringContaining('Check your email'),
        })
      );
    });
  });

  it('should reset to password mode after successful magic link send', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Sent' }),
    });

    await renderPage();

    fireEvent.click(screen.getByText(/send magic link instead/i));
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    // After success, should reset back to password mode
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in to shop/i })).toBeInTheDocument();
    });
  });

  it('should show error when magic link request fails with non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Too many attempts. Please try again later.' }),
    });

    await renderPage();

    fireEvent.click(screen.getByText(/send magic link instead/i));

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('should show error when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await renderPage();

    fireEvent.click(screen.getByText(/send magic link instead/i));

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('should display store not found when tenant does not exist', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { default: CustomerLoginPage } = await import('../../customer/LoginPage');

    render(
      <MemoryRouter initialEntries={['/bad-store/customer/login']}>
        <Routes>
          <Route path="/:tenantSlug/customer/login" element={<CustomerLoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/store not found/i)).toBeInTheDocument();
    });
  });
});
