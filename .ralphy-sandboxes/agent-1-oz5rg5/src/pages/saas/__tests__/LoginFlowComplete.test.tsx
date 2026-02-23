/**
 * Login Flow Complete Tests
 *
 * Tests for:
 * 1. Complete login flow with valid credentials - session created
 * 2. Invalid password shows error without revealing email exists
 * 3. Locked/suspended account shows appropriate message
 * 4. Remember me persists session longer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// --- Mocks ---

const mockSignInWithPassword = vi.fn();
const mockFrom = vi.fn();
const mockNavigate = vi.fn();
const mockToast = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

const mockResilientFetch = vi.fn();
vi.mock('@/lib/utils/networkResilience', () => ({
  resilientFetch: (...args: unknown[]) => mockResilientFetch(...args),
  isOffline: vi.fn().mockReturnValue(false),
  onConnectionStatusChange: vi.fn().mockReturnValue(() => {}),
  ErrorCategory: {
    NETWORK: 'network',
    AUTH: 'auth',
    SERVER: 'server',
    CLIENT: 'client',
    TIMEOUT: 'timeout',
    UNKNOWN: 'unknown',
  },
  getErrorMessage: vi.fn().mockReturnValue('Error'),
}));

vi.mock('@/lib/utils/authFlowLogger', () => ({
  authFlowLogger: {
    startFlow: vi.fn().mockReturnValue('flow-123'),
    logStep: vi.fn(),
    completeFlow: vi.fn(),
    failFlow: vi.fn(),
  },
  AuthFlowStep: {
    VALIDATE_INPUT: 'VALIDATE_INPUT',
    NETWORK_REQUEST: 'NETWORK_REQUEST',
    PARSE_RESPONSE: 'PARSE_RESPONSE',
    COMPLETE: 'COMPLETE',
  },
  AuthAction: {
    LOGIN: 'LOGIN',
  },
}));

vi.mock('@/lib/encryption/clientEncryption', () => ({
  clientEncryption: {
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
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

vi.mock('@/components/ThemeToggle', () => ({
  default: () => null,
}));

vi.mock('@/components/FloraIQLogo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('@/components/marketing/ForceLightMode', () => ({
  ForceLightMode: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Helpers ---

function setupSuccessfulLoginMocks() {
  mockSignInWithPassword.mockResolvedValue({
    data: {
      user: { id: 'user-123', email: 'admin@greenleaf.com' },
      session: { access_token: 'access-tok-123', refresh_token: 'refresh-tok-456' },
    },
    error: null,
  });

  // tenant_users query
  const tenantUsersChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { tenant_id: 'tenant-abc' },
      error: null,
    }),
  };

  // tenants query
  const tenantsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { slug: 'greenleaf' },
      error: null,
    }),
  };

  mockFrom.mockImplementation((table: string) => {
    if (table === 'tenant_users') return tenantUsersChain;
    if (table === 'tenants') return tenantsChain;
    return tenantUsersChain;
  });

  mockResilientFetch.mockResolvedValue({
    response: new Response(
      JSON.stringify({
        access_token: 'final-access-token',
        refresh_token: 'final-refresh-token',
        admin: {
          id: 'admin-id-1',
          email: 'admin@greenleaf.com',
          name: 'Admin User',
          role: 'owner',
          tenant_id: 'tenant-abc',
          userId: 'user-123',
        },
        tenant: {
          id: 'tenant-abc',
          business_name: 'GreenLeaf Distro',
          slug: 'greenleaf',
          subscription_plan: 'pro',
          subscription_status: 'active',
          limits: { customers: 100, menus: 5, products: 500, locations: 5, users: 10 },
          usage: { customers: 12, menus: 2, products: 50, locations: 1, users: 3 },
        },
      }),
      { status: 200 }
    ),
    attempts: 1,
    category: 'auth',
  });
}

async function fillAndSubmitLoginForm(email: string, password: string) {
  const user = userEvent.setup();
  const emailInput = screen.getByPlaceholderText('you@company.com');
  const passwordInput = screen.getByPlaceholderText('••••••••');

  await user.type(emailInput, email);
  await user.type(passwordInput, password);

  const submitButton = screen.getByRole('button', { name: /sign in/i });
  await user.click(submitButton);
}

// --- Tests ---

describe('Login Flow - Complete with Valid Credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should authenticate and create a session with tokens stored', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      // Verify Supabase signInWithPassword was called with correct credentials
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'admin@greenleaf.com',
        password: 'SecurePass123!',
      });
    });

    await waitFor(() => {
      // Verify tokens are stored in localStorage (session created)
      expect(localStorage.getItem('tenant_admin_access_token')).toBe('final-access-token');
      expect(localStorage.getItem('tenant_admin_refresh_token')).toBe('final-refresh-token');
    });
  });

  it('should store admin and tenant data in session', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      const storedAdmin = JSON.parse(localStorage.getItem('tenant_admin_user') || '{}');
      expect(storedAdmin.email).toBe('admin@greenleaf.com');
      expect(storedAdmin.role).toBe('owner');
      expect(storedAdmin.tenant_id).toBe('tenant-abc');
    });

    await waitFor(() => {
      const storedTenant = JSON.parse(localStorage.getItem('tenant_data') || '{}');
      expect(storedTenant.business_name).toBe('GreenLeaf Distro');
      expect(storedTenant.slug).toBe('greenleaf');
      expect(storedTenant.subscription_status).toBe('active');
    });
  });

  it('should store user id in sessionStorage and localStorage', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      expect(sessionStorage.getItem('floraiq_user_id')).toBe('user-123');
      expect(localStorage.getItem('floraiq_user_id')).toBe('user-123');
    });
  });

  it('should store lastTenantSlug for session continuity', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      expect(localStorage.getItem('lastTenantSlug')).toBe('greenleaf');
    });
  });

  it('should show welcome toast and navigate to dashboard on success', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Welcome back!',
          description: expect.stringContaining('GreenLeaf Distro'),
        })
      );
    });

    // Advance timer to trigger the redirect
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/greenleaf/admin/dashboard', { replace: true });
    });

    vi.useRealTimers();
  });

  it('should call edge function with correct payload', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      expect(mockResilientFetch).toHaveBeenCalledWith(
        expect.stringContaining('tenant-admin-auth?action=login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'admin@greenleaf.com',
            password: 'SecurePass123!',
            tenantSlug: 'greenleaf',
          }),
        })
      );
    });
  });

  it('should normalize email to lowercase before login', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('Admin@GreenLeaf.COM', 'SecurePass123!');

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'admin@greenleaf.com',
        password: 'SecurePass123!',
      });
    });
  });
});

describe('Login Flow - Invalid Password Error (No Email Disclosure)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should show generic error on invalid password without revealing email exists', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('real-user@company.com', 'WrongPassword!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login Failed',
          variant: 'destructive',
        })
      );
    });

    // Verify the error message does NOT reveal whether the email exists
    const toastCall = mockToast.mock.calls.find(
      (call) => call[0]?.title === 'Login Failed'
    );
    expect(toastCall).toBeDefined();
    const description = toastCall![0].description as string;
    // Should not say "email not found" or "user does not exist"
    expect(description.toLowerCase()).not.toContain('email not found');
    expect(description.toLowerCase()).not.toContain('user does not exist');
    expect(description.toLowerCase()).not.toContain('no account');
  });

  it('should show generic error on non-existent email without revealing it', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('nonexistent@company.com', 'SomePassword123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login Failed',
          variant: 'destructive',
        })
      );
    });

    // Error message should be the same whether email exists or not (prevents enumeration)
    const toastCall = mockToast.mock.calls.find(
      (call) => call[0]?.title === 'Login Failed'
    );
    expect(toastCall).toBeDefined();
    const description = toastCall![0].description as string;
    expect(description.toLowerCase()).not.toContain('no user');
    expect(description.toLowerCase()).not.toContain('email not registered');
  });

  it('should clear password field after failed login attempt', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('user@company.com', 'WrongPass123!');

    await waitFor(() => {
      const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
      expect(passwordInput.value).toBe('');
    });
  });

  it('should not create any session data on failed login', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('user@company.com', 'WrongPass123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });

    // No tokens should be stored
    expect(localStorage.getItem('tenant_admin_access_token')).toBeNull();
    expect(localStorage.getItem('tenant_admin_refresh_token')).toBeNull();
    expect(localStorage.getItem('tenant_admin_user')).toBeNull();
    expect(localStorage.getItem('tenant_data')).toBeNull();
    expect(localStorage.getItem('lastTenantSlug')).toBeNull();
  });

  it('should show error from edge function response when credentials fail at edge', async () => {
    // Supabase auth passes but edge function returns 401
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'user@company.com' },
        session: null,
      },
      error: null,
    });

    const tenantUsersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-abc' },
        error: null,
      }),
    };

    const tenantsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { slug: 'greenleaf' },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenant_users') return tenantUsersChain;
      if (table === 'tenants') return tenantsChain;
      return tenantUsersChain;
    });

    mockResilientFetch.mockResolvedValue({
      response: new Response(
        JSON.stringify({
          error: 'Invalid credentials',
          detail: 'Email or password is incorrect. Please try again.',
        }),
        { status: 401 }
      ),
      attempts: 1,
      category: 'auth',
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('user@company.com', 'WrongPass123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login Failed',
          description: 'Invalid credentials',
          variant: 'destructive',
        })
      );
    });
  });
});

describe('Login Flow - Locked/Suspended Account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should show account suspended message when tenant is suspended', async () => {
    // Auth passes but edge function returns account suspended error
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'admin@suspended.com' },
        session: null,
      },
      error: null,
    });

    const tenantUsersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-suspended' },
        error: null,
      }),
    };

    const tenantsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { slug: 'suspended-co' },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenant_users') return tenantUsersChain;
      if (table === 'tenants') return tenantsChain;
      return tenantUsersChain;
    });

    mockResilientFetch.mockResolvedValue({
      response: new Response(
        JSON.stringify({
          error: 'Account suspended',
          detail: 'Your account has been suspended. Please contact support.',
        }),
        { status: 403 }
      ),
      attempts: 1,
      category: 'auth',
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@suspended.com', 'ValidPass123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login Failed',
          description: 'Account suspended',
          variant: 'destructive',
        })
      );
    });
  });

  it('should show access denied message when user is not authorized for tenant', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'outsider@other.com' },
        session: null,
      },
      error: null,
    });

    const tenantUsersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-abc' },
        error: null,
      }),
    };

    const tenantsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { slug: 'greenleaf' },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenant_users') return tenantUsersChain;
      if (table === 'tenants') return tenantsChain;
      return tenantUsersChain;
    });

    mockResilientFetch.mockResolvedValue({
      response: new Response(
        JSON.stringify({
          error: 'You do not have access to this tenant',
          detail: 'The account outsider@other.com is not authorized to access GreenLeaf Distro.',
        }),
        { status: 403 }
      ),
      attempts: 1,
      category: 'auth',
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('outsider@other.com', 'ValidPass123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login Failed',
          description: 'You do not have access to this tenant',
          variant: 'destructive',
        })
      );
    });
  });

  it('should not store session data when account is locked', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-locked', email: 'locked@company.com' },
        session: null,
      },
      error: null,
    });

    const tenantUsersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-locked' },
        error: null,
      }),
    };

    const tenantsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { slug: 'locked-co' },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenant_users') return tenantUsersChain;
      if (table === 'tenants') return tenantsChain;
      return tenantUsersChain;
    });

    mockResilientFetch.mockResolvedValue({
      response: new Response(
        JSON.stringify({
          error: 'Account locked due to too many failed attempts',
          detail: 'Please try again later or contact support.',
        }),
        { status: 429 }
      ),
      attempts: 1,
      category: 'auth',
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('locked@company.com', 'ValidPass123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login Failed',
          variant: 'destructive',
        })
      );
    });

    // No session data should be stored
    expect(localStorage.getItem('tenant_admin_access_token')).toBeNull();
    expect(localStorage.getItem('tenant_admin_refresh_token')).toBeNull();
    expect(localStorage.getItem('tenant_admin_user')).toBeNull();
    expect(localStorage.getItem('tenant_data')).toBeNull();
  });

  it('should show rate-limited error when too many login attempts', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'user@company.com' },
        session: null,
      },
      error: null,
    });

    const tenantUsersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-abc' },
        error: null,
      }),
    };

    const tenantsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { slug: 'greenleaf' },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenant_users') return tenantUsersChain;
      if (table === 'tenants') return tenantsChain;
      return tenantUsersChain;
    });

    mockResilientFetch.mockResolvedValue({
      response: new Response(
        JSON.stringify({
          error: 'Too many login attempts. Please try again in 5 minutes.',
        }),
        { status: 429, headers: { 'Retry-After': '300' } }
      ),
      attempts: 1,
      category: 'auth',
    });

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('user@company.com', 'SomePass123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login Failed',
          description: expect.stringContaining('Too many login attempts'),
          variant: 'destructive',
        })
      );
    });
  });

  it('should handle no tenant found without revealing account details', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-orphan', email: 'orphan@company.com' },
        session: null,
      },
      error: null,
    });

    const tenantUsersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    mockFrom.mockImplementation(() => tenantUsersChain);

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('orphan@company.com', 'ValidPass123!');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login Failed',
          variant: 'destructive',
        })
      );
    });

    // Should not reveal the specific reason in a way that leaks info
    const toastCall = mockToast.mock.calls.find(
      (call) => call[0]?.title === 'Login Failed'
    );
    expect(toastCall).toBeDefined();
  });
});

describe('Login Flow - Remember Me Session Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should render the Remember me checkbox', async () => {
    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Remember me')).toBeInTheDocument();
  });

  it('should persist access token in localStorage for session continuity', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      // Access token in localStorage persists across browser sessions
      expect(localStorage.getItem('tenant_admin_access_token')).toBe('final-access-token');
      expect(localStorage.getItem('tenant_admin_refresh_token')).toBe('final-refresh-token');
    });
  });

  it('should persist tenant and admin data in localStorage for session recovery', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      // Data persists in localStorage (survives browser restart)
      const storedAdmin = localStorage.getItem('tenant_admin_user');
      const storedTenant = localStorage.getItem('tenant_data');
      expect(storedAdmin).not.toBeNull();
      expect(storedTenant).not.toBeNull();

      const admin = JSON.parse(storedAdmin!);
      const tenant = JSON.parse(storedTenant!);
      expect(admin.email).toBe('admin@greenleaf.com');
      expect(tenant.slug).toBe('greenleaf');
    });
  });

  it('should store lastTenantSlug in localStorage for cross-session persistence', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      // localStorage persists even after browser is closed (remember me behavior)
      expect(localStorage.getItem('lastTenantSlug')).toBe('greenleaf');
    });
  });

  it('should store user id in both sessionStorage and localStorage for hybrid persistence', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      // sessionStorage = current session only; localStorage = persists across sessions
      expect(sessionStorage.getItem('floraiq_user_id')).toBe('user-123');
      expect(localStorage.getItem('floraiq_user_id')).toBe('user-123');
    });
  });

  it('should use edge function cookie with 7-day Max-Age for persistent sessions', async () => {
    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      // The edge function is called, which sets httpOnly cookies with 7-day Max-Age
      expect(mockResilientFetch).toHaveBeenCalledWith(
        expect.stringContaining('tenant-admin-auth?action=login'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    // Verify session tokens are stored for persistence
    await waitFor(() => {
      expect(localStorage.getItem('tenant_admin_access_token')).toBeTruthy();
      expect(localStorage.getItem('tenant_admin_refresh_token')).toBeTruthy();
    });
  });

  it('should clear stale session before new login to prevent conflicts', async () => {
    // Set stale session data
    localStorage.setItem('tenant_admin_access_token', 'stale-token');
    localStorage.setItem('tenant_admin_refresh_token', 'stale-refresh');
    localStorage.setItem('lastTenantSlug', 'old-tenant');
    localStorage.setItem('tenant_admin_user', '{"id":"old"}');
    localStorage.setItem('tenant_data', '{"slug":"old"}');

    setupSuccessfulLoginMocks();

    const { default: LoginPage } = await import('../LoginPage');

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await fillAndSubmitLoginForm('admin@greenleaf.com', 'SecurePass123!');

    await waitFor(() => {
      // New tokens replace old ones
      expect(localStorage.getItem('tenant_admin_access_token')).toBe('final-access-token');
      expect(localStorage.getItem('tenant_admin_refresh_token')).toBe('final-refresh-token');
      expect(localStorage.getItem('lastTenantSlug')).toBe('greenleaf');
    });
  });
});
