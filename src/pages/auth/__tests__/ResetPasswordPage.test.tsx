/**
 * ResetPasswordPage (Admin Auth) Component Tests
 *
 * Tests the admin password reset form:
 * - Token verification on mount
 * - Password form rendering and validation
 * - Password strength requirements checklist
 * - Submit with correct payload (new_password snake_case)
 * - Error and success state transitions
 * - Invalid/expired token states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
const mockApiFetch = vi.fn();
vi.mock('@/lib/utils/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
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

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  getErrorMessage: (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Unknown error';
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe('ResetPasswordPage (Admin Auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = (searchParams = '?token=valid-test-token-abc123def456') => {
    const queryClient = createTestQueryClient();

    // Mock verify token call as successful by default
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valid: true, email: 'admin@example.com' }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/auth/reset-password${searchParams}`]}>
          <Routes>
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  let ResetPasswordPage: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('../ResetPasswordPage');
    ResetPasswordPage = mod.ResetPasswordPage;
  });

  describe('Token verification', () => {
    it('should show loading state while verifying token', () => {
      // Never-resolving promise to keep loading state
      mockApiFetch.mockReset();
      mockApiFetch.mockImplementation(() => new Promise(() => {}));

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/auth/reset-password?token=some-token-value-123']}>
            <Routes>
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/verifying your reset link/i)).toBeInTheDocument();
    });

    it('should show error when no token is provided', () => {
      mockApiFetch.mockReset();
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/auth/reset-password']}>
            <Routes>
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
    });

    it('should show error for invalid token format', () => {
      mockApiFetch.mockReset();
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/auth/reset-password?token=bad!']}>
            <Routes>
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
    });

    it('should call verify endpoint with action and token', async () => {
      renderPage('?token=valid-test-token-abc123def456');

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/functions/v1/auth-reset-password'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ action: 'verify', token: 'valid-test-token-abc123def456' }),
            skipAuth: true,
          })
        );
      });
    });

    it('should show password form after successful token verification', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/set new password/i)).toBeInTheDocument();
      });
    });

    it('should display verified email in form description', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
      });
    });

    it('should show expired link state for expired tokens', async () => {
      mockApiFetch.mockReset();
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Reset token has expired. Please request a new one.' }),
      });

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/auth/reset-password?token=expired-token-abc123def456']}>
            <Routes>
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/link expired|invalid reset link/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password form', () => {
    it('should render password and confirm password fields', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      });
    });

    it('should show password requirements checklist when typing', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      await userEvent.type(passwordInput, 'ab');

      // Should show requirements
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one number/i)).toBeInTheDocument();
      expect(screen.getByText(/one special character/i)).toBeInTheDocument();
    });

    it('should show password strength indicator', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      await userEvent.type(passwordInput, 'StrongP@ss1');

      expect(screen.getByText(/strong/i)).toBeInTheDocument();
    });

    it('should show passwords match indicator', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'StrongP@ss1');

      expect(screen.getByText(/passwords match/i)).toBeInTheDocument();
    });

    it('should show passwords do not match indicator', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'Different');

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    it('should disable submit when password is weak', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'weak');
      await userEvent.type(confirmInput, 'weak');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit when passwords do not match', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'StrongP@ss2');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit when password is strong and passwords match', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'StrongP@ss1');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should toggle password visibility', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Two "Show password" buttons exist (password + confirm), get the first
      const showButtons = screen.getAllByLabelText(/show password/i);
      fireEvent.click(showButtons[0]);
      expect(passwordInput).toHaveAttribute('type', 'text');
    });
  });

  describe('Form submission', () => {
    it('should send new_password in snake_case to the API', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      // Reset mock to clear the verify call, then set up the reset response
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Password reset successfully.' }),
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'StrongP@ss1');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Find the reset call (not the verify call)
        const resetCall = mockApiFetch.mock.calls.find((call: unknown[]) => {
          const body = typeof call[1] === 'object' && call[1] !== null ? (call[1] as Record<string, unknown>).body : undefined;
          return typeof body === 'string' && body.includes('new_password');
        });

        expect(resetCall).toBeDefined();
        const parsedBody = JSON.parse(resetCall![1].body as string);
        expect(parsedBody).toHaveProperty('new_password', 'StrongP@ss1');
        expect(parsedBody).toHaveProperty('token', 'valid-test-token-abc123def456');
        // Should NOT have camelCase newPassword
        expect(parsedBody).not.toHaveProperty('newPassword');
      });
    });

    it('should show success state after successful reset', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Password reset successfully.' }),
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'StrongP@ss1');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password reset successful/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      // Never-resolving promise for loading state
      mockApiFetch.mockImplementation(() => new Promise(() => {}));

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'StrongP@ss1');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/resetting password/i)).toBeInTheDocument();
      });
    });

    it('should show error when password validation fails client-side', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      // Directly test submit validation with non-matching passwords
      // The button should be disabled so we can't submit, but let's verify
      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'StrongP@ss1');

      // Change confirm to not match
      await userEvent.clear(confirmInput);
      await userEvent.type(confirmInput, 'StrongP@ss2');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('should have a back to login link', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const backLink = screen.getByText(/back to login/i);
      expect(backLink).toBeInTheDocument();
      expect(backLink.closest('a')).toHaveAttribute('href', '/login');
    });

    it('should have request new link button on error state', async () => {
      mockApiFetch.mockReset();
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/auth/reset-password']}>
            <Routes>
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const requestLink = screen.getByText(/request a new reset link/i);
      expect(requestLink.closest('a')).toHaveAttribute('href', '/auth/forgot-password');
    });

    it('should have login link on success state', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Password reset successfully.' }),
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(passwordInput, 'StrongP@ss1');
      await userEvent.type(confirmInput, 'StrongP@ss1');

      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/go to login/i)).toBeInTheDocument();
        expect(screen.getByText(/go to login/i).closest('a')).toHaveAttribute('href', '/login');
      });
    });
  });
});
