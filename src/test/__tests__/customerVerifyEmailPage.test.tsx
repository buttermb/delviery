/**
 * Tests for CustomerVerifyEmailPage component
 *
 * Validates: rendering, form inputs, code pre-fill from URL,
 * resend flow, and verification submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks — must be before component imports
// ---------------------------------------------------------------------------

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle, eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/utils/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import CustomerVerifyEmailPage from '@/pages/customer/VerifyEmailPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface RenderOptions {
  initialRoute?: string;
}

function renderPage({ initialRoute = '/test-store/verify-email' }: RenderOptions = {}) {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route
            path="/:tenantSlug/verify-email"
            element={<CustomerVerifyEmailPage />}
          />
          <Route
            path="/:tenantSlug/customer/login"
            element={<div data-testid="login-page">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CustomerVerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: tenant lookup succeeds
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'tenant-1', slug: 'test-store', business_name: 'Test Store' },
      error: null,
    });
  });

  it('renders the verification form after tenant loads', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
  });

  it('shows loading spinner while tenant loads', () => {
    // Delay tenant resolution
    mockMaybeSingle.mockReturnValue(new Promise(() => {}));
    renderPage();

    // The spinner uses an SVG with animate-spin class — just check no form yet
    expect(screen.queryByText('Verify Your Email')).not.toBeInTheDocument();
  });

  it('pre-fills code and email from URL params', async () => {
    renderPage({
      initialRoute: '/test-store/verify-email?code=123456&email=user@example.com',
    });

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const codeInput = screen.getByLabelText(/verification code/i) as HTMLInputElement;

    expect(emailInput.value).toBe('user@example.com');
    expect(codeInput.value).toBe('123456');
    // Email should be disabled when pre-filled
    expect(emailInput).toBeDisabled();
  });

  it('restricts code input to 6 numeric digits', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/verification code/i) as HTMLInputElement;

    // Type letters — should be stripped
    await user.type(codeInput, 'abc123def456');
    expect(codeInput.value).toBe('123456');
  });

  it('disables verify button when code is incomplete', async () => {
    renderPage({
      initialRoute: '/test-store/verify-email?email=user@example.com',
    });

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const verifyButton = screen.getByRole('button', { name: /verify email/i });
    // No code entered yet — button should be disabled
    expect(verifyButton).toBeDisabled();
  });

  it('shows resend button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    expect(screen.getByText(/didn't receive a code/i)).toBeInTheDocument();
  });

  it('shows back to login link', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const backLink = screen.getByText(/back to login/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/test-store/customer/login');
  });

  it('calls verify-email-code on form submit', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    // Second call for customer_users lookup after verification
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { id: 'tenant-1', slug: 'test-store', business_name: 'Test Store' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { tenant_id: 'tenant-1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { slug: 'test-store' },
        error: null,
      });

    renderPage({
      initialRoute: '/test-store/verify-email?code=654321&email=test@example.com',
    });

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const verifyButton = screen.getByRole('button', { name: /verify email/i });
    await user.click(verifyButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/verify-email-code'),
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
        }),
      );
    });
  });

  it('handles verification API error', async () => {
    const { toast } = await import('sonner');

    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid verification code' }),
    });

    renderPage({
      initialRoute: '/test-store/verify-email?code=999999&email=test@example.com',
    });

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const verifyButton = screen.getByRole('button', { name: /verify email/i });
    await user.click(verifyButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Verification Failed',
        expect.objectContaining({
          description: 'Invalid verification code',
        }),
      );
    });
  });

  it('calls send-verification-email on resend', async () => {
    // First resolve tenant, then customer lookup for resend
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { id: 'tenant-1', slug: 'test-store', business_name: 'Test Store' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'customer-1', tenant_id: 'tenant-1' },
        error: null,
      });

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    renderPage({
      initialRoute: '/test-store/verify-email?email=resend@example.com',
    });

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const resendButton = screen.getByText(/didn't receive a code/i);
    await user.click(resendButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/send-verification-email'),
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
        }),
      );
    });
  });

  it('shows error toast when resend fails', async () => {
    const { toast } = await import('sonner');

    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { id: 'tenant-1', slug: 'test-store', business_name: 'Test Store' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'customer-1', tenant_id: 'tenant-1' },
        error: null,
      });

    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Rate limited' }),
    });

    renderPage({
      initialRoute: '/test-store/verify-email?email=fail@example.com',
    });

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const resendButton = screen.getByText(/didn't receive a code/i);
    await user.click(resendButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to Resend',
        expect.objectContaining({
          description: 'Rate limited',
        }),
      );
    });
  });

  it('shows account not found when resend has no matching customer', async () => {
    const { toast } = await import('sonner');

    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { id: 'tenant-1', slug: 'test-store', business_name: 'Test Store' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    renderPage({
      initialRoute: '/test-store/verify-email?email=unknown@example.com',
    });

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    });

    const resendButton = screen.getByText(/didn't receive a code/i);
    await user.click(resendButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Account Not Found',
        expect.objectContaining({
          description: expect.stringContaining('No account found'),
        }),
      );
    });
  });
});
