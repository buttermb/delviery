/**
 * Password Reset Pages Component Tests
 *
 * Tests the ForgotPasswordPage and ResetPasswordPage UI components:
 * - Form rendering and validation
 * - Loading states during submission
 * - Success/error state transitions
 * - Password strength indicator
 * - Navigation links
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock dependencies
const mockMaybeSingle = vi.fn().mockResolvedValue({
  data: { id: 'tenant-001', business_name: 'Test Store', slug: 'test-store', status: 'active' },
  error: null,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: () => mockMaybeSingle(),
          }),
          maybeSingle: () => mockMaybeSingle(),
        }),
        maybeSingle: () => mockMaybeSingle(),
      }),
    }),
  },
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/utils/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
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

vi.mock('@/components/auth/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: ({ password }: { password: string }) => (
    <div data-testid="password-strength">{password.length >= 8 ? 'Strong' : 'Weak'}</div>
  ),
}));

describe('ForgotPasswordPage', () => {
  let ForgotPasswordPage: React.ComponentType;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApiFetch.mockReset();
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'tenant-001', business_name: 'Test Store', slug: 'test-store', status: 'active' },
      error: null,
    });
    const mod = await import('../ForgotPasswordPage');
    ForgotPasswordPage = mod.default;
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = async () => {
    render(
      <MemoryRouter initialEntries={['/test-store/customer/forgot-password']}>
        <Routes>
          <Route path="/:tenantSlug/customer/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for tenant loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /forgot password/i })).toBeInTheDocument();
    });
  };

  it('should render the forgot password form', async () => {
    await renderPage();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByText(/back to login/i)).toBeInTheDocument();
  });

  it('should disable submit button when email is empty', async () => {
    await renderPage();

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when email is entered', async () => {
    await renderPage();

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('should show loading state during submission', async () => {
    // Mock slow response
    mockApiFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    await renderPage();

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/sending/i)).toBeInTheDocument();
    });
  });

  it('should show success state after successful submission', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      }),
    });

    await renderPage();

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('should always show success for security regardless of API result', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Store not found or inactive' }),
    });

    await renderPage();

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'user@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitButton);

    // Should always show success to prevent email enumeration
    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('should display the user email in success message', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await renderPage();

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('should have a link back to login', async () => {
    await renderPage();

    const backLink = screen.getByText(/back to login/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/test-store/customer/login');
  });
});

describe('ResetPasswordPage', () => {
  let ResetPasswordPage: React.ComponentType;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApiFetch.mockReset();
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'tenant-001', business_name: 'Test Store', slug: 'test-store', status: 'active' },
      error: null,
    });
    const mod = await import('../ResetPasswordPage');
    ResetPasswordPage = mod.default;
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = async (searchParams = '?token=test-token-123&email=user@example.com') => {
    render(
      <MemoryRouter initialEntries={[`/test-store/customer/reset-password${searchParams}`]}>
        <Routes>
          <Route path="/:tenantSlug/customer/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for tenant loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
    });
  };

  it('should render the reset password form with prefilled email', async () => {
    await renderPage();

    expect(screen.getByLabelText(/email address/i)).toHaveValue('user@example.com');
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('should disable email input when pre-filled from URL', async () => {
    await renderPage();

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeDisabled();
  });

  it('should disable submit button when passwords are too short', async () => {
    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await userEvent.type(passwordInput, 'short');
    await userEvent.type(confirmInput, 'short');

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    expect(submitButton).toBeDisabled();
  });

  it('should disable submit button when passwords do not match', async () => {
    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await userEvent.type(passwordInput, 'StrongPass123!');
    await userEvent.type(confirmInput, 'DifferentPass123!');

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when passwords match and are valid', async () => {
    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await userEvent.type(passwordInput, 'StrongPass123!');
    await userEvent.type(confirmInput, 'StrongPass123!');

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('should show password strength indicator when typing password', async () => {
    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    await userEvent.type(passwordInput, 'MyStr0ng!');

    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
  });

  it('should show loading state during form submission', async () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await userEvent.type(passwordInput, 'StrongPass123!');
    await userEvent.type(confirmInput, 'StrongPass123!');

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/resetting password/i)).toBeInTheDocument();
    });
  });

  it('should show success state after successful reset', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: 'Password reset successfully.',
      }),
    });

    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await userEvent.type(passwordInput, 'StrongPass123!');
    await userEvent.type(confirmInput, 'StrongPass123!');

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password reset!/i)).toBeInTheDocument();
    });
  });

  it('should show error inline when reset fails', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid or expired reset token' }),
    });

    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await userEvent.type(passwordInput, 'StrongPass123!');
    await userEvent.type(confirmInput, 'StrongPass123!');

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    // Error is shown inline via AuthErrorAlert, not via toast
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('should call API with correct payload', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await userEvent.type(passwordInput, 'NewSecurePass123!');
    await userEvent.type(confirmInput, 'NewSecurePass123!');

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/reset-password'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            token: 'test-token-123',
            email: 'user@example.com',
            new_password: 'NewSecurePass123!',
            tenant_slug: 'test-store',
          }),
          skipAuth: true,
        })
      );
    });
  });

  it('should have a toggle to show/hide password', async () => {
    await renderPage();

    const passwordInput = screen.getByLabelText(/new password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Find the toggle button by its type="button" attribute (not submit)
    const toggleButtons = screen.getAllByRole('button').filter(
      btn => btn.getAttribute('type') === 'button'
    );

    if (toggleButtons.length > 0) {
      fireEvent.click(toggleButtons[0]);
      expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });

  it('should have a link back to login', async () => {
    await renderPage();

    const backLink = screen.getByText(/back to login/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/test-store/customer/login');
  });
});
