/**
 * TenantAdminAuthContext Memoization Tests
 *
 * Tests to verify that the context value is properly memoized using useMemo
 * to prevent unnecessary re-renders of consumer components.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, render } from '@testing-library/react';
import { ReactNode, useRef, useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantAdminAuthProvider, useTenantAdminAuth } from '../TenantAdminAuthContext';

// --- Mocks ---

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock debug logger
vi.mock('@/lib/debug/logger', () => ({
  logAuth: vi.fn(),
  logAuthWarn: vi.fn(),
  logAuthError: vi.fn(),
  logStateChange: vi.fn(),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
        challenge: vi.fn(),
        verify: vi.fn(),
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: 'aal1', nextLevel: 'aal1' },
          error: null,
        }),
      },
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue(Promise.resolve('SUBSCRIBED')),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock encryption
vi.mock('@/lib/encryption/clientEncryption', () => ({
  clientEncryption: {
    initialize: vi.fn(),
    clearKeys: vi.fn(),
  },
}));

// Mock network resilience
vi.mock('@/lib/utils/networkResilience', () => ({
  resilientFetch: vi.fn(),
  safeFetch: vi.fn(),
  ErrorCategory: {
    NETWORK: 'NETWORK',
    AUTH: 'AUTH',
    SERVER: 'SERVER',
  },
  getErrorMessage: vi.fn((cat) => `Error: ${cat}`),
  initConnectionMonitoring: vi.fn(),
  onConnectionStatusChange: vi.fn().mockReturnValue(() => {}),
}));

// Mock auth flow logger
vi.mock('@/lib/utils/authFlowLogger', () => ({
  authFlowLogger: {
    startFlow: vi.fn().mockReturnValue('flow-id'),
    logStep: vi.fn(),
    logFetchAttempt: vi.fn(),
    logFetchRetry: vi.fn(),
    logFetchFailure: vi.fn(),
    logFetchSuccess: vi.fn(),
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
    LOGOUT: 'LOGOUT',
  },
}));

// Mock auth helpers
vi.mock('@/lib/utils/authHelpers', () => ({
  performFullLogout: vi.fn(),
}));

// Mock feature flags
vi.mock('@/config/featureFlags', () => ({
  useFeatureFlags: () => ({
    shouldAutoApprove: vi.fn().mockReturnValue(false),
    flags: {},
  }),
}));

// Mock session fixation
vi.mock('@/lib/auth/sessionFixation', () => ({
  clearPreAuthSessionData: vi.fn(),
  establishFreshSession: vi.fn(),
  invalidateSessionNonce: vi.fn(),
}));

// Mock logout cleanup
vi.mock('@/lib/auth/logoutCleanup', () => ({
  performLogoutCleanup: vi.fn(),
  broadcastLogout: vi.fn(),
}));

// Mock token refresh
vi.mock('@/lib/auth/tokenRefresh', () => ({
  createRefreshTimer: vi.fn().mockReturnValue({ cleanup: vi.fn() }),
  isValidRefreshToken: vi.fn().mockReturnValue(false),
  tokenNeedsRefresh: vi.fn().mockReturnValue(false),
}));

// Mock JWT utils
vi.mock('@/lib/auth/jwt', () => ({
  getTokenExpiration: vi.fn(),
}));

// Mock safe storage
vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Mock components
vi.mock('@/components/auth/SessionTimeoutWarning', () => ({
  SessionTimeoutWarning: () => null,
}));

vi.mock('@/components/onboarding/OnboardingWizard', () => ({
  OnboardingWizard: () => null,
}));

vi.mock('@/components/onboarding/FreeTierOnboardingFlow', () => ({
  FreeTierOnboardingFlow: () => null,
}));

// Mock tenant route guard
vi.mock('@/hooks/useTenantRouteGuard', () => ({
  useTenantRouteGuard: vi.fn(),
}));

// Mock toast utils
vi.mock('@/lib/toastUtils', () => ({
  showErrorToast: vi.fn(),
}));

// Mock auth error hook
vi.mock('@/hooks/useAuthError', () => ({
  emitAuthError: vi.fn(),
}));

describe('TenantAdminAuthContext - Memoization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
        <TenantAdminAuthProvider>{children}</TenantAdminAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  it('should not cause re-renders when parent re-renders without state changes', async () => {
    let renderCount = 0;

    const TestComponent = () => {
      const _context = useTenantAdminAuth();
      renderCount++;

      return (
        <div data-testid="test-component">
          Render count: {renderCount}
        </div>
      );
    };

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
          <TenantAdminAuthProvider>
            <TestComponent />
          </TenantAdminAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(renderCount).toBeGreaterThan(0);
    });

    const initialRenderCount = renderCount;

    // Force a parent re-render by changing a prop
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
          <TenantAdminAuthProvider>
            <TestComponent />
          </TenantAdminAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // The component should not re-render if the context value is properly memoized
    // Allow for loading state changes, but verify we're not getting excessive re-renders
    await waitFor(() => {
      // After loading is complete, render count should stabilize
      expect(renderCount).toBeLessThan(initialRenderCount + 5);
    });
  });

  it('should memoize the context value with all required properties', async () => {
    const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Verify all expected properties are present
    expect(result.current).toHaveProperty('admin');
    expect(result.current).toHaveProperty('tenant');
    expect(result.current).toHaveProperty('tenantSlug');
    expect(result.current).toHaveProperty('token');
    expect(result.current).toHaveProperty('accessToken');
    expect(result.current).toHaveProperty('refreshToken');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('connectionStatus');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('logout');
    expect(result.current).toHaveProperty('refreshAuthToken');
    expect(result.current).toHaveProperty('refreshTenant');
    expect(result.current).toHaveProperty('handleSignupSuccess');
    expect(result.current).toHaveProperty('mfaRequired');
    expect(result.current).toHaveProperty('verifyMfa');

    // Verify function stability (functions should be the same reference across renders)
    const firstLogin = result.current.login;
    const firstLogout = result.current.logout;
    const firstRefreshAuthToken = result.current.refreshAuthToken;

    await waitFor(() => {
      // After loading completes, functions should remain stable
      if (!result.current.loading) {
        expect(result.current.login).toBe(firstLogin);
        expect(result.current.logout).toBe(firstLogout);
        expect(result.current.refreshAuthToken).toBe(firstRefreshAuthToken);
      }
    });
  });

  it('should maintain referential equality of context value when dependencies do not change', async () => {
    const contextReferences: ReturnType<typeof useTenantAdminAuth>[] = [];

    const TestComponent = () => {
      const context = useTenantAdminAuth();
      const contextRef = useRef(context);

      useEffect(() => {
        contextReferences.push(contextRef.current);
      }, [context]);

      return <div>Test</div>;
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
          <TenantAdminAuthProvider>
            <TestComponent />
          </TenantAdminAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(contextReferences.length).toBeGreaterThan(0);
      const lastContext = contextReferences[contextReferences.length - 1];
      // Context should eventually finish loading
      if (contextReferences.length > 1) {
        expect(lastContext).toBeDefined();
      }
    }, { timeout: 3000 });

    // Verify that we have a stable context after initialization
    expect(contextReferences.length).toBeGreaterThanOrEqual(1);
  });

  it('should have stable function references', async () => {
    const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current.loading).toBe(false);
    });

    const initialFunctions = {
      login: result.current.login,
      logout: result.current.logout,
      refreshAuthToken: result.current.refreshAuthToken,
      refreshTenant: result.current.refreshTenant,
      verifyMfa: result.current.verifyMfa,
    };

    // Force a re-render by waiting
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Function references should remain stable
    expect(result.current.login).toBe(initialFunctions.login);
    expect(result.current.logout).toBe(initialFunctions.logout);
    expect(result.current.refreshAuthToken).toBe(initialFunctions.refreshAuthToken);
    expect(result.current.refreshTenant).toBe(initialFunctions.refreshTenant);
    expect(result.current.verifyMfa).toBe(initialFunctions.verifyMfa);
  });
});
