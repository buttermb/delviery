/**
 * Auth SignupPage Tests
 *
 * Tests the multi-step signup form:
 * Step 1: Email & Password
 * Step 2: Full Name & Phone
 * Step 3: Tenant Selection/Creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ============================================================================
// Mocks
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignUp = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
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
    <div data-testid="password-strength">{password ? 'strength-shown' : ''}</div>
  ),
}));

vi.mock('@/components/auth/AuthErrorAlert', () => ({
  AuthErrorAlert: ({ message }: { message: string }) =>
    message ? <div role="alert">{message}</div> : null,
  getAuthErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

// ============================================================================
// Helpers
// ============================================================================

function renderSignupPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>
  );
}

// ============================================================================
// Tests
// ============================================================================

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SignupPage: any;

describe('Auth SignupPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../SignupPage');
    SignupPage = mod.SignupPage;
  });

  describe('Step 1: Email & Password', () => {
    it('should render step 1 with email and password fields', () => {
      renderSignupPage();

      expect(screen.getByText('Create your account')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    });

    it('should show progress indicator with 3 steps', () => {
      renderSignupPage();

      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    });

    it('should validate password confirmation match', async () => {
      renderSignupPage();
      const user = userEvent.setup();

      await user.type(screen.getByPlaceholderText('you@company.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'SecurePass1A');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'DifferentPass1');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('should advance to step 2 with valid data', async () => {
      renderSignupPage();
      const user = userEvent.setup();

      await user.type(screen.getByPlaceholderText('you@company.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'SecurePass1A');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'SecurePass1A');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Personal information')).toBeInTheDocument();
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
      });
    });

    it('should toggle password visibility', async () => {
      renderSignupPage();
      const user = userEvent.setup();

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleButtons = screen.getAllByLabelText('Show password');
      await user.click(toggleButtons[0]);
      expect(passwordInput).toHaveAttribute('type', 'text');
    });
  });

  describe('Step 2: Full Name & Phone', () => {
    async function advanceToStep2() {
      renderSignupPage();
      const user = userEvent.setup();

      await user.type(screen.getByPlaceholderText('you@company.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'SecurePass1A');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'SecurePass1A');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Personal information')).toBeInTheDocument();
      });

      return user;
    }

    it('should render name and phone fields', async () => {
      await advanceToStep2();

      expect(screen.getByPlaceholderText('John Smith')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
    });

    it('should have a back button to return to step 1', async () => {
      const user = await advanceToStep2();

      await user.click(screen.getByRole('button', { name: /back/i }));

      await waitFor(() => {
        expect(screen.getByText('Create your account')).toBeInTheDocument();
      });
    });

    it('should advance to step 3 with valid name', async () => {
      const user = await advanceToStep2();

      await user.type(screen.getByPlaceholderText('John Smith'), 'Jane Doe');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Set up your organization')).toBeInTheDocument();
        expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
      });
    });
  });

  describe('Step 3: Tenant Selection', () => {
    async function advanceToStep3() {
      renderSignupPage();
      const user = userEvent.setup();

      // Step 1
      await user.type(screen.getByPlaceholderText('you@company.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'SecurePass1A');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'SecurePass1A');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Personal information')).toBeInTheDocument();
      });

      // Step 2
      await user.type(screen.getByPlaceholderText('John Smith'), 'Jane Doe');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Set up your organization')).toBeInTheDocument();
      });

      return user;
    }

    it('should show create and join options', async () => {
      await advanceToStep3();

      expect(screen.getByText('Create New')).toBeInTheDocument();
      expect(screen.getByText('Join Existing')).toBeInTheDocument();
    });

    it('should show business name field when create is selected', async () => {
      await advanceToStep3();

      expect(screen.getByPlaceholderText('Your Company Name')).toBeInTheDocument();
    });

    it('should show organization ID field when join is selected', async () => {
      const user = await advanceToStep3();

      await user.click(screen.getByText('Join Existing'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('your-organization')).toBeInTheDocument();
      });
    });

    it('should require license attestation checkbox', async () => {
      const user = await advanceToStep3();

      await user.type(screen.getByPlaceholderText('Your Company Name'), 'Test Company');
      // Don't check the license attestation
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Form should not submit without attestation
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('should submit signup with all data on create tenant', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockRpc.mockResolvedValue({
        data: { tenant_id: 'tenant-123' },
        error: null,
      });

      const user = await advanceToStep3();

      await user.type(screen.getByPlaceholderText('Your Company Name'), 'Test Company');

      // Check license attestation
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'test@example.com',
            password: 'SecurePass1A',
            options: expect.objectContaining({
              data: expect.objectContaining({
                full_name: 'Jane Doe',
                tenant_slug: 'test-company',
              }),
            }),
          })
        );
      });
    });

    it('should navigate to verify-email on successful signup', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockRpc.mockResolvedValue({
        data: { tenant_id: 'tenant-123' },
        error: null,
      });

      const user = await advanceToStep3();

      await user.type(screen.getByPlaceholderText('Your Company Name'), 'Test Company');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/verify-email', expect.objectContaining({
          state: expect.objectContaining({
            email: 'test@example.com',
            fromSignup: true,
          }),
        }));
      });
    });

    it('should show error on signup failure', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Signup failed' },
      });

      const user = await advanceToStep3();

      await user.type(screen.getByPlaceholderText('Your Company Name'), 'Test Company');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Login link', () => {
    it('should have a link to sign in page', () => {
      renderSignupPage();

      const signInLink = screen.getByText('Sign in');
      expect(signInLink).toBeInTheDocument();
      expect(signInLink.closest('a')).toHaveAttribute('href', '/saas/login');
    });
  });
});
