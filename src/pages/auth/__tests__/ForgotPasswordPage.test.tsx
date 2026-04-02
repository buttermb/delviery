/**
 * ForgotPasswordPage (Admin Auth) Component Tests
 *
 * Tests the admin forgot password form:
 * - Email form rendering and validation
 * - Client-side rate limiting
 * - Success state with email enumeration protection
 * - "Try a different email" button resets form
 * - Navigation links
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

vi.mock('@/components/FloraIQLogo', () => ({
  default: () => <div data-testid="logo">FloraIQ</div>,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe('ForgotPasswordPage (Admin Auth)', () => {
  let ForgotPasswordPage: React.ComponentType;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApiFetch.mockReset();
    const mod = await import('../ForgotPasswordPage');
    ForgotPasswordPage = mod.ForgotPasswordPage;
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/auth/forgot-password']}>
          <Routes>
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Form rendering', () => {
    it('should render the forgot password form', () => {
      renderPage();

      expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    });

    it('should have email input with correct attributes', () => {
      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('inputMode', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
    });

    it('should have a back to login link', () => {
      renderPage();

      const backLink = screen.getByText(/back to login/i);
      expect(backLink).toBeInTheDocument();
      expect(backLink.closest('a')).toHaveAttribute('href', '/saas/login');
    });

    it('should disable submit button when email is empty', () => {
      renderPage();

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when email is entered', async () => {
      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'admin@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Email validation', () => {
    it('should show error for invalid email on blur', async () => {
      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'not-an-email');
      fireEvent.blur(emailInput);

      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });

    it('should clear error when user starts typing', async () => {
      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'bad');
      fireEvent.blur(emailInput);

      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();

      await userEvent.type(emailInput, '@example.com');

      // Error should be cleared while typing
      expect(screen.queryByText(/please enter a valid email/i)).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('should show success state after submission', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'admin@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });
    });

    it('should always show success for security (email enumeration protection)', async () => {
      // API fails but UI should still show success
      mockApiFetch.mockRejectedValue(new Error('Network error'));

      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'nonexistent@example.com');

      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });
    });

    it('should display submitted email in success message', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'admin@example.com');

      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });
    });

    it('should call API with correct payload', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'Admin@Example.COM');

      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/functions/v1/auth-forgot-password'),
          expect.objectContaining({
            method: 'POST',
            skipAuth: true,
          })
        );

        const callBody = JSON.parse(
          (mockApiFetch.mock.calls[0][1] as Record<string, string>).body
        );
        expect(callBody.email).toBe('admin@example.com'); // lowercased
        expect(callBody.userType).toBe('tenant_admin');
      });
    });

    it('should show success immediately without waiting for API (fire-and-forget)', async () => {
      // API never resolves — but page should still show success immediately
      mockApiFetch.mockImplementation(() => new Promise(() => {}));

      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'admin@example.com');

      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      // Success should appear immediately, not waiting for API
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Try a different email button', () => {
    it('should reset form when clicking "Try a different email"', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      renderPage();

      // Submit form
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'admin@example.com');
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      // Click "Try a different email"
      const tryDifferentButton = screen.getByRole('button', { name: /try a different email/i });
      fireEvent.click(tryDifferentButton);

      // Should be back to the form
      await waitFor(() => {
        expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/email address/i)).toHaveValue('');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on email input', () => {
      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('aria-required', 'true');
    });

    it('should have accessible error messages', async () => {
      renderPage();

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'invalid');
      fireEvent.blur(emailInput);

      const errorMessage = screen.getByText(/please enter a valid email/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });
});
