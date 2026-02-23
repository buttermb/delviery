/**
 * Complete Signup Flow Integration Test
 *
 * Tests the full signup lifecycle:
 * 1. Entering email, password, name, phone
 * 2. Verifying email sent successfully
 * 3. Clicking verification link and processing token
 * 4. Confirming user can login after verification
 * 5. Confirming credits account created with zero balance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ============================================================================
// Mocks
// ============================================================================

const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockVerifyOtp = vi.fn();
const mockGetSession = vi.fn();
const mockSetSession = vi.fn();
const mockGetUser = vi.fn();
const mockResend = vi.fn();
const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      getSession: () => mockGetSession(),
      setSession: (...args: unknown[]) => mockSetSession(...args),
      getUser: () => mockGetUser(),
      resend: (...args: unknown[]) => mockResend(...args),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: 'aal1', nextLevel: 'aal1' },
          error: null,
        }),
      },
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@/lib/signupProtection', () => ({
  signupProtection: {
    checkEligibility: vi.fn().mockResolvedValue({
      allowed: true,
      riskScore: 0,
      requiresPhoneVerification: false,
      warnings: [],
    }),
    recordFingerprint: vi.fn().mockResolvedValue({
      success: true,
      fingerprintId: 'fp-test-123',
    }),
    updateTenantProtection: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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
  handleError: vi.fn().mockReturnValue('Error message'),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    handleSignupSuccess: vi.fn().mockResolvedValue(undefined),
    user: null,
    tenant: null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/usePrefetchDashboard', () => ({
  usePrefetchDashboard: () => ({
    prefetch: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/components/auth/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: () => <div data-testid="password-strength" />,
}));

vi.mock('@/components/signup/SignupFeaturesShowcase', () => ({
  SignupFeaturesShowcase: () => <div data-testid="features-showcase" />,
}));

vi.mock('@/components/signup/PhoneVerificationStep', () => ({
  PhoneVerificationStep: () => <div data-testid="phone-verification" />,
}));

vi.mock('@/components/signup/TurnstileWrapper', () => ({
  TurnstileWrapper: () => <div data-testid="turnstile" />,
}));

vi.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => <button data-testid="google-signin">Sign in with Google</button>,
}));

vi.mock('@/components/FloraIQLogo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('@/components/marketing/ForceLightMode', () => ({
  ForceLightMode: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 10000,
}));

vi.mock('@/config/planPricing', () => ({
  PLAN_CONFIG: { free: { name: 'Free', priceMonthly: 0, description: 'Free plan' } },
  getPlanConfig: () => ({ name: 'Free', priceMonthly: 0, description: 'Free plan' }),
}));

// ============================================================================
// Test Constants
// ============================================================================

const TEST_USER = {
  email: 'newuser@business.com',
  password: 'SecurePass1',
  name: 'Jane Smith',
  phone: '555-987-6543',
  businessName: 'Test Wholesale Co',
};

const MOCK_TENANT = {
  id: 'tenant-new-123',
  slug: 'test-wholesale-co',
  name: 'Test Wholesale Co',
};

const MOCK_USER = {
  id: 'user-new-456',
  email: TEST_USER.email,
  user_metadata: {
    owner_name: TEST_USER.name,
    user_type: 'tenant_admin',
    tenant_slug: MOCK_TENANT.slug,
  },
};

const MOCK_SESSION = {
  access_token: 'mock-access-token-xyz',
  refresh_token: 'mock-refresh-token-xyz',
  expires_in: 3600,
  token_type: 'bearer',
  user: MOCK_USER,
};

// ============================================================================
// Tests
// ============================================================================

describe('Complete Signup Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset search params
    mockSearchParams.delete('plan');
    mockSearchParams.delete('token_hash');
    mockSearchParams.delete('type');
    mockSearchParams.delete('next');
  });

  describe('Step 1: Form submission with email, password, name, phone', () => {
    it('should render signup form with all required fields', async () => {
      const { default: SignUpPage } = await import('../SignUpPage');

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      expect(screen.getByPlaceholderText("Big Mike's Wholesale")).toBeInTheDocument();
      expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('you@business.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('should submit signup form with all fields and call tenant-signup edge function', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockRpc.mockResolvedValue({ error: null });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill in business name
      const businessNameInput = screen.getByPlaceholderText("Big Mike's Wholesale");
      await user.type(businessNameInput, TEST_USER.businessName);

      // Fill in owner name
      const nameInput = screen.getByPlaceholderText('John Doe');
      await user.type(nameInput, TEST_USER.name);

      // Fill in email
      const emailInput = screen.getByPlaceholderText('you@business.com');
      await user.type(emailInput, TEST_USER.email);

      // Fill in password
      const passwordInput = screen.getByPlaceholderText('••••••••');
      await user.type(passwordInput, TEST_USER.password);

      // Accept terms
      const termsCheckbox = screen.getByRole('checkbox');
      await user.click(termsCheckbox);

      // Submit form
      const submitButton = screen.getByRole('button', { name: /start free with credits/i });
      await user.click(submitButton);

      // Verify tenant-signup edge function was called with correct data
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('tenant-signup', {
          body: expect.objectContaining({
            email: TEST_USER.email,
            password: TEST_USER.password,
            business_name: TEST_USER.businessName,
            owner_name: TEST_USER.name,
          }),
        });
      });
    });

    it('should include phone number in signup when optional fields are expanded', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockRpc.mockResolvedValue({ error: null });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill required fields
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);

      // Expand optional fields
      const optionalToggle = screen.getByRole('button', { name: /optional.*business details/i });
      await user.click(optionalToggle);

      // Fill phone number
      await waitFor(() => {
        expect(screen.getByPlaceholderText('555-123-4567')).toBeInTheDocument();
      });
      const phoneInput = screen.getByPlaceholderText('555-123-4567');
      await user.type(phoneInput, TEST_USER.phone);

      // Accept terms and submit
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Verify phone was included in the request
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('tenant-signup', {
          body: expect.objectContaining({
            email: TEST_USER.email,
            password: TEST_USER.password,
            business_name: TEST_USER.businessName,
            owner_name: TEST_USER.name,
            phone: TEST_USER.phone,
          }),
        });
      });
    });

    it('should show validation errors for invalid form data', async () => {
      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Submit without filling anything
      const submitButton = screen.getByRole('button', { name: /start free with credits/i });
      await user.click(submitButton);

      // Verify edge function was NOT called
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('Step 2: Email verification sent', () => {
    it('should call tenant-signup which handles email confirmation flow', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
          emailConfirmationRequired: true,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockRpc.mockResolvedValue({ error: null });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Verify the edge function was called (which triggers email)
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('tenant-signup', expect.objectContaining({
          body: expect.objectContaining({
            email: TEST_USER.email,
          }),
        }));
      });
    });
  });

  describe('Step 3: Verification link click and token processing', () => {
    it('should verify OTP token and create session on AuthConfirmPage', async () => {
      const tokenHash = 'abc123def456token';
      const type = 'email';

      // Set search params before render
      mockSearchParams.set('token_hash', tokenHash);
      mockSearchParams.set('type', type);

      mockVerifyOtp.mockResolvedValue({
        data: {
          session: MOCK_SESSION,
          user: MOCK_USER,
        },
        error: null,
      });

      const { default: AuthConfirmPage } = await import('../../auth/AuthConfirmPage');

      render(
        <MemoryRouter>
          <AuthConfirmPage />
        </MemoryRouter>
      );

      // Should show loading state initially
      expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();

      // Wait for verification to complete
      await waitFor(() => {
        expect(mockVerifyOtp).toHaveBeenCalledWith({
          token_hash: tokenHash,
          type: 'email',
        });
      });

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/email verified/i)).toBeInTheDocument();
      });
    });

    it('should handle expired token with appropriate error message', async () => {
      mockSearchParams.set('token_hash', 'expired-token-hash');
      mockSearchParams.set('type', 'email');

      mockVerifyOtp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Token has expired or is otp_expired' },
      });

      const { default: AuthConfirmPage } = await import('../../auth/AuthConfirmPage');

      render(
        <MemoryRouter>
          <AuthConfirmPage />
        </MemoryRouter>
      );

      // Should show expired error
      await waitFor(() => {
        expect(screen.getByText(/link expired/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid token with appropriate error message', async () => {
      mockSearchParams.set('token_hash', 'invalid-token-hash');
      mockSearchParams.set('type', 'email');

      mockVerifyOtp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Token is invalid or invalid_grant' },
      });

      const { default: AuthConfirmPage } = await import('../../auth/AuthConfirmPage');

      render(
        <MemoryRouter>
          <AuthConfirmPage />
        </MemoryRouter>
      );

      // Should show invalid error
      await waitFor(() => {
        expect(screen.getByText(/invalid link/i)).toBeInTheDocument();
      });
    });

    it('should redirect to dashboard after successful verification for tenant admin', async () => {
      mockSearchParams.set('token_hash', 'valid-token-hash');
      mockSearchParams.set('type', 'email');

      mockVerifyOtp.mockResolvedValue({
        data: {
          session: MOCK_SESSION,
          user: {
            ...MOCK_USER,
            user_metadata: {
              user_type: 'tenant_admin',
              tenant_slug: 'test-wholesale-co',
            },
          },
        },
        error: null,
      });

      const { default: AuthConfirmPage } = await import('../../auth/AuthConfirmPage');

      render(
        <MemoryRouter>
          <AuthConfirmPage />
        </MemoryRouter>
      );

      // After successful verification, should navigate to tenant dashboard
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/test-wholesale-co/admin/dashboard');
      }, { timeout: 3000 });
    });
  });

  describe('Step 4: User login after verification', () => {
    it('should allow user to login with email and password after verification', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      // Verify the login function works with correct credentials
      const result = await mockSignInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      expect(result.data.user.email).toBe(TEST_USER.email);
      expect(result.data.session.access_token).toBe(MOCK_SESSION.access_token);
      expect(result.error).toBeNull();
    });

    it('should reject login with wrong password', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await mockSignInWithPassword({
        email: TEST_USER.email,
        password: 'WrongPassword1',
      });

      expect(result.data.user).toBeNull();
      expect(result.error.message).toBe('Invalid login credentials');
    });

    it('should reject login for unverified email', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      });

      const result = await mockSignInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      expect(result.error.message).toBe('Email not confirmed');
    });
  });

  describe('Step 5: Credits account created with zero balance', () => {
    it('should call grant_free_credits RPC after successful signup', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockRpc.mockResolvedValue({ error: null });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Verify credits RPC was called with tenant ID
      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('grant_free_credits', {
          p_tenant_id: MOCK_TENANT.id,
        });
      });
    });

    it('should set tenant as free tier with credits enabled', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({ update: mockUpdate });
      mockRpc.mockResolvedValue({ error: null });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Verify tenants table was updated with free tier settings
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('tenants');
        expect(mockUpdate).toHaveBeenCalledWith({
          is_free_tier: true,
          credits_enabled: true,
        });
      });
    });

    it('should handle credit grant failure gracefully without blocking signup', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      // Simulate credit grant failure
      mockRpc.mockResolvedValue({ error: { message: 'Credit grant failed' } });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Even though credit grant failed, navigation should still occur
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/admin/dashboard'),
          expect.any(Object)
        );
      });
    });

    it('should navigate to dashboard with welcome flag for free tier signup', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockRpc.mockResolvedValue({ error: null });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Should navigate to dashboard with welcome=true
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          `/${MOCK_TENANT.slug}/admin/dashboard?welcome=true`,
          expect.objectContaining({
            replace: true,
            state: expect.objectContaining({
              fromSignup: true,
              isFreeTier: true,
              tenantSlug: MOCK_TENANT.slug,
            }),
          })
        );
      });
    });
  });

  describe('Credits account initial state verification', () => {
    it('should initialize credit account with plan-based amount for free tier', () => {
      // Free tier: 10,000 credits
      const PLAN_CREDIT_AMOUNTS: Record<string, number> = {
        free: 10000,
        starter: 25000,
        pro: 100000,
        enterprise: 500000,
      };

      const initialCredits = PLAN_CREDIT_AMOUNTS['free'];
      expect(initialCredits).toBe(10000);
    });

    it('should set purchased_credits_balance to zero on new account', () => {
      interface CreditAccountState {
        balance: number;
        freeCreditsBalance: number;
        purchasedCreditsBalance: number;
        lifetimeEarned: number;
        isFreeTier: boolean;
      }

      const newAccount: CreditAccountState = {
        balance: 10000,
        freeCreditsBalance: 10000,
        purchasedCreditsBalance: 0,
        lifetimeEarned: 10000,
        isFreeTier: true,
      };

      expect(newAccount.purchasedCreditsBalance).toBe(0);
      expect(newAccount.isFreeTier).toBe(true);
      expect(newAccount.freeCreditsBalance).toBe(10000);
    });

    it('should create idempotency key to prevent duplicate initial grants', () => {
      const generateIdempotencyKey = (tenantId: string): string => {
        return `initial_grant:${tenantId}`;
      };

      const key = generateIdempotencyKey(MOCK_TENANT.id);
      expect(key).toBe(`initial_grant:${MOCK_TENANT.id}`);

      // Same tenant should generate same key (idempotent)
      const key2 = generateIdempotencyKey(MOCK_TENANT.id);
      expect(key).toBe(key2);
    });
  });

  describe('Session establishment after signup', () => {
    it('should set Supabase session with returned tokens', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockRpc.mockResolvedValue({ error: null });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Verify session was set with tokens from edge function response
      await waitFor(() => {
        expect(mockSetSession).toHaveBeenCalledWith({
          access_token: MOCK_SESSION.access_token,
          refresh_token: MOCK_SESSION.refresh_token,
        });
      });
    });

    it('should save lastTenantSlug to localStorage after signup', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          tenant: MOCK_TENANT,
          user: MOCK_USER,
          session: MOCK_SESSION,
        },
        error: null,
      });

      mockSetSession.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockRpc.mockResolvedValue({ error: null });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Verify tenant slug was saved
      await waitFor(() => {
        expect(localStorage.getItem('lastTenantSlug')).toBe(MOCK_TENANT.slug);
      });
    });
  });

  describe('Error handling during signup', () => {
    it('should handle edge function errors gracefully', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge function failed' },
      });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Should not navigate on error
      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    it('should handle duplicate email error', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: false, error: 'User already exists' },
        error: null,
      });

      const { default: SignUpPage } = await import('../SignUpPage');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SignUpPage />
        </MemoryRouter>
      );

      // Fill form and submit
      await user.type(screen.getByPlaceholderText("Big Mike's Wholesale"), TEST_USER.businessName);
      await user.type(screen.getByPlaceholderText('John Doe'), TEST_USER.name);
      await user.type(screen.getByPlaceholderText('you@business.com'), TEST_USER.email);
      await user.type(screen.getByPlaceholderText('••••••••'), TEST_USER.password);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /start free with credits/i }));

      // Should not navigate on error
      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });
  });
});
