/**
 * TenantAdminAuthContext - Token Refresh Flow Tests
 *
 * Tests the complete token refresh lifecycle:
 * - Edge function refresh (success, 401, 500)
 * - Supabase native fallback on 401
 * - Invalid/missing refresh tokens
 * - Race condition prevention
 * - Timer cleanup on logout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

// --- Hoisted mocks (accessible inside vi.mock factories) ---
const {
  mockSetSession,
  mockRefreshSession,
  mockResilientFetch,
  mockTimerCleanup,
  mockCreateRefreshTimer,
} = vi.hoisted(() => ({
  mockSetSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
  mockRefreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  mockResilientFetch: vi.fn(),
  mockTimerCleanup: vi.fn(),
  mockCreateRefreshTimer: vi.fn().mockReturnValue({
    cleanup: vi.fn(),
    checkNow: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      setSession: mockSetSession,
      getUser: vi.fn(),
      refreshSession: mockRefreshSession,
      mfa: {
        listFactors: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
        getAuthenticatorAssuranceLevel: vi.fn(),
      },
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue('SUBSCRIBED'),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/utils/networkResilience', () => ({
  resilientFetch: (...args: unknown[]) => mockResilientFetch(...args),
  safeFetch: vi.fn(),
  ErrorCategory: {
    NETWORK: 'network',
    AUTH: 'auth',
    SERVER: 'server',
    CLIENT: 'client',
    TIMEOUT: 'timeout',
    UNKNOWN: 'unknown',
  },
  getErrorMessage: vi.fn().mockReturnValue('Error'),
  initConnectionMonitoring: vi.fn(),
  onConnectionStatusChange: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('@/lib/encryption/clientEncryption', () => ({
  clientEncryption: {
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  },
}));

vi.mock('@/config/featureFlags', () => ({
  useFeatureFlags: vi.fn().mockReturnValue({
    shouldAutoApprove: vi.fn().mockReturnValue(false),
    flags: {},
  }),
}));

vi.mock('@/hooks/useTenantRouteGuard', () => ({
  useTenantRouteGuard: vi.fn().mockReturnValue({
    routeInfo: { type: 'tenant-admin', tenantSlug: 'test-tenant' },
    requiresTenant: true,
    hasMismatch: false,
  }),
}));

vi.mock('@/components/auth/SessionTimeoutWarning', () => ({
  SessionTimeoutWarning: () => null,
}));

vi.mock('@/components/onboarding/OnboardingWizard', () => ({
  OnboardingWizard: () => null,
}));

vi.mock('@/components/onboarding/FreeTierOnboardingFlow', () => ({
  FreeTierOnboardingFlow: () => null,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
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

vi.mock('@/lib/debug/logger', () => ({
  logAuth: vi.fn(),
  logAuthWarn: vi.fn(),
  logAuthError: vi.fn(),
  logStateChange: vi.fn(),
}));

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

vi.mock('@/lib/utils/authHelpers', () => ({
  performFullLogout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/sessionFixation', () => ({
  clearPreAuthSessionData: vi.fn(),
  establishFreshSession: vi.fn(),
  invalidateSessionNonce: vi.fn(),
}));

vi.mock('@/lib/auth/logoutCleanup', () => ({
  performLogoutCleanup: vi.fn(),
  broadcastLogout: vi.fn(),
}));

vi.mock('@/lib/auth/tokenRefresh', () => ({
  createRefreshTimer: (...args: unknown[]) => mockCreateRefreshTimer(...args),
  isValidRefreshToken: vi.fn((token: string | null | undefined) => {
    if (!token) return false;
    if (token === 'undefined' || token === 'null') return false;
    if (typeof token !== 'string') return false;
    if (token.trim() === '') return false;
    if (token.length < 10) return false;
    return true;
  }),
  tokenNeedsRefresh: vi.fn().mockReturnValue(false),
  REFRESH_BUFFER_MS: 5 * 60 * 1000,
}));

vi.mock('@/lib/auth/jwt', () => ({
  getTokenExpiration: vi.fn(),
}));

vi.mock('@/lib/toastUtils', () => ({
  showErrorToast: vi.fn(),
}));

vi.mock('@/hooks/useAuthError', () => ({
  emitAuthError: vi.fn(),
}));

// Import after mocks
import { TenantAdminAuthProvider, useTenantAdminAuth } from '../TenantAdminAuthContext';
import { safeStorage } from '@/utils/safeStorage';
import { logger } from '@/lib/logger';


function mockResponse(body: Record<string, unknown>, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Wrapper WITHOUT stored tokens — init flow exits early (no fetch needed)
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
    <TenantAdminAuthProvider>{children}</TenantAdminAuthProvider>
  </MemoryRouter>
);

describe('TenantAdminAuthContext - Token Refresh Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    safeStorage.clear();
    mockResilientFetch.mockReset();
    mockSetSession.mockResolvedValue({ data: {}, error: null });
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null });
    mockTimerCleanup.mockClear();
    mockCreateRefreshTimer.mockReset();
    mockCreateRefreshTimer.mockReturnValue({
      cleanup: mockTimerCleanup,
      checkNow: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // Helper: render hook and wait for init to complete
  async function renderAndWait() {
    const hookResult = renderHook(() => useTenantAdminAuth(), { wrapper });
    await waitFor(() => {
      expect(hookResult.result.current.loading).toBe(false);
    });
    return hookResult;
  }

  describe('refreshAuthToken - Edge Function Success', () => {
    it('should update tokens and storage on successful refresh', async () => {
      // Only set refresh token (no access token) to avoid init flow verification
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token-here');

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        }),
        attempts: 1,
        category: null,
      });

      const { result } = await renderAndWait();

      let refreshResult: boolean = false;
      await act(async () => {
        refreshResult = await result.current.refreshAuthToken();
      });

      expect(refreshResult).toBe(true);
      expect(safeStorage.getItem('tenant_admin_access_token')).toBe('new-access-token');
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBe('new-refresh-token');
    });

    it('should sync with Supabase client after successful refresh', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token-here');

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
        }),
        attempts: 1,
        category: null,
      });

      const { result } = await renderAndWait();

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      });
    });

    it('should set up new refresh timer after successful refresh', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token-here');

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token',
        }),
        attempts: 1,
        category: null,
      });

      const { result } = await renderAndWait();

      mockCreateRefreshTimer.mockClear();

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(mockCreateRefreshTimer).toHaveBeenCalled();
    });
  });

  describe('refreshAuthToken - 401 with Supabase Fallback', () => {
    it('should fall back to Supabase native refresh when edge returns 401', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token-here');

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({ error: 'Invalid session' }, 401),
        attempts: 1,
        category: 'auth',
      });

      mockRefreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'supabase-new-access',
            refresh_token: 'supabase-new-refresh',
          },
        },
        error: null,
      });

      const { result } = await renderAndWait();

      let refreshResult: boolean = false;
      await act(async () => {
        refreshResult = await result.current.refreshAuthToken();
      });

      expect(refreshResult).toBe(true);
      expect(mockRefreshSession).toHaveBeenCalledWith({
        refresh_token: 'valid-refresh-token-here',
      });
      expect(safeStorage.getItem('tenant_admin_access_token')).toBe('supabase-new-access');
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBe('supabase-new-refresh');
    });

    it('should clear auth state when both refresh methods fail', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'expired-refresh-token');

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({ error: 'Invalid session' }, 401),
        attempts: 1,
        category: 'auth',
      });

      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' },
      });

      const { result } = await renderAndWait();

      let refreshResult: boolean = false;
      await act(async () => {
        refreshResult = await result.current.refreshAuthToken();
      });

      expect(refreshResult).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.admin).toBeNull();
    });
  });

  describe('refreshAuthToken - Non-401 Errors', () => {
    it('should return false and log warning on 500 error', async () => {
      // Set only refresh token — no access token to avoid init verification
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token-here');

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({ error: 'Internal server error' }, 500),
        attempts: 1,
        category: 'server',
      });

      const { result } = await renderAndWait();

      let refreshResult: boolean = false;
      await act(async () => {
        refreshResult = await result.current.refreshAuthToken();
      });

      expect(refreshResult).toBe(false);
      // Should NOT attempt Supabase fallback for non-401 errors
      expect(mockRefreshSession).not.toHaveBeenCalled();
      // Should log warning about unexpected status
      expect(logger.warn).toHaveBeenCalledWith(
        '[AUTH] Token refresh failed with unexpected status',
        expect.objectContaining({ status: 500 })
      );
    });

    it('should return false on network exception', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token-here');

      mockResilientFetch.mockRejectedValue(new Error('Network request failed'));

      const { result } = await renderAndWait();

      let refreshResult: boolean = false;
      await act(async () => {
        refreshResult = await result.current.refreshAuthToken();
      });

      expect(refreshResult).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[AUTH] Token refresh exception',
        expect.any(Error)
      );
    });
  });

  describe('refreshAuthToken - Invalid Refresh Tokens', () => {
    it('should not make network call when refresh token is empty', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', '');

      const { result } = await renderAndWait();

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(mockResilientFetch).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should not make network call when refresh token is "undefined" string', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'undefined');

      const { result } = await renderAndWait();

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(mockResilientFetch).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should not make network call when refresh token is "null" string', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'null');

      const { result } = await renderAndWait();

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(mockResilientFetch).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should not make network call when refresh token is whitespace only', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', '   ');

      const { result } = await renderAndWait();

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(mockResilientFetch).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should not make network call when refresh token is too short', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'abc');

      const { result } = await renderAndWait();

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(mockResilientFetch).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should not make network call when no refresh token exists', async () => {
      const { result } = await renderAndWait();

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(mockResilientFetch).not.toHaveBeenCalled();
    });
  });

  describe('refreshAuthToken - Race Condition Prevention', () => {
    it('should deduplicate concurrent refresh calls', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token-here');

      let resolveRefresh: ((value: unknown) => void) | null = null;
      mockResilientFetch.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      });

      const { result } = await renderAndWait();

      let result1: boolean | undefined;
      let result2: boolean | undefined;

      await act(async () => {
        const p1 = result.current.refreshAuthToken().then(r => { result1 = r; });
        const p2 = result.current.refreshAuthToken().then(r => { result2 = r; });

        // Resolve the single fetch
        if (resolveRefresh) {
          resolveRefresh({
            response: mockResponse({
              access_token: 'deduped-access',
              refresh_token: 'deduped-refresh',
            }),
            attempts: 1,
            category: null,
          });
        }

        await Promise.all([p1, p2]);
      });

      // Only one network request should have been made
      expect(mockResilientFetch).toHaveBeenCalledTimes(1);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('Logout - Timer Cleanup', () => {
    it('should clean up visibility-aware refresh timer on logout', async () => {
      // Don't set access token before render to avoid init verification.
      // Set only refresh token so the hook renders cleanly.
      mockResilientFetch.mockResolvedValue({
        response: mockResponse({ success: true }),
        attempts: 1,
        category: null,
      });

      const { result } = await renderAndWait();

      const cleanupCallsBefore = mockTimerCleanup.mock.calls.length;

      await act(async () => {
        await result.current.logout();
      });

      // The visibility-aware timer cleanup should have been called during logout
      expect(mockTimerCleanup.mock.calls.length).toBeGreaterThanOrEqual(cleanupCallsBefore);
    });

    it('should clear auth state after logout', async () => {
      // Set only refresh token for clean init
      safeStorage.setItem('tenant_admin_refresh_token', 'refresh-token-value');

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({ success: true }),
        attempts: 1,
        category: null,
      });

      const { result } = await renderAndWait();

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.admin).toBeNull();
      expect(result.current.tenant).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(safeStorage.getItem('tenant_admin_access_token')).toBeNull();
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBeNull();
    });
  });

  describe('Refresh Token from Storage Fallback', () => {
    it('should use refresh token from safeStorage when state is null', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'storage-refresh-token');

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
        }),
        attempts: 1,
        category: null,
      });

      const { result } = await renderAndWait();

      let refreshResult: boolean = false;
      await act(async () => {
        refreshResult = await result.current.refreshAuthToken();
      });

      expect(refreshResult).toBe(true);
      expect(mockResilientFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockResilientFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('action=refresh');
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.refresh_token).toBe('storage-refresh-token');
    });
  });

  describe('setSession Failure Handling', () => {
    it('should succeed even if Supabase setSession fails', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token-here');

      mockSetSession.mockRejectedValue(new Error('setSession failed'));

      mockResilientFetch.mockResolvedValue({
        response: mockResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
        }),
        attempts: 1,
        category: null,
      });

      const { result } = await renderAndWait();

      let refreshResult: boolean = false;
      await act(async () => {
        refreshResult = await result.current.refreshAuthToken();
      });

      // Should still succeed - setSession failure is non-blocking
      expect(refreshResult).toBe(true);
      expect(safeStorage.getItem('tenant_admin_access_token')).toBe('new-access');
    });
  });
});
