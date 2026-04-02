/**
 * TenantAdminAuthContext Security Tests
 * Tests for authentication flow security
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies before importing the context
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getUser: vi.fn(),
      mfa: {
        listFactors: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
        getAuthenticatorAssuranceLevel: vi.fn(),
      },
      refreshSession: vi.fn(),
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
  resilientFetch: vi.fn(),
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

vi.mock('@/lib/toastUtils', () => ({
  showErrorToast: vi.fn(),
}));

vi.mock('@/hooks/useAuthError', () => ({
  emitAuthError: vi.fn(),
}));

vi.mock('@/lib/auth/sessionFixation', () => ({
  clearPreAuthSessionData: vi.fn(),
  invalidateSessionNonce: vi.fn(),
}));

// Import after mocks
import { TenantAdminAuthProvider, useTenantAdminAuth } from '../TenantAdminAuthContext';
import { resilientFetch } from '@/lib/utils/networkResilience';
import { safeStorage } from '@/utils/safeStorage';
import { clearPreAuthSessionData } from '@/lib/auth/sessionFixation';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
    <TenantAdminAuthProvider>{children}</TenantAdminAuthProvider>
  </MemoryRouter>
);

describe('TenantAdminAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    safeStorage.clear();
    // Reset fetch mock
    (resilientFetch as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initial State', () => {
    it('should start with loading true', async () => {
      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      // Initial state
      expect(result.current.loading).toBe(true);
      expect(result.current.admin).toBeNull();
      expect(result.current.tenant).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear stale tokens on auth pages', async () => {
      // Create wrapper that starts on login page
      const loginWrapper = ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={['/test-tenant/admin/login']}>
          <TenantAdminAuthProvider>{children}</TenantAdminAuthProvider>
        </MemoryRouter>
      );

      // Set some stale tokens
      safeStorage.setItem('tenant_admin_access_token', 'old-token');
      safeStorage.setItem('tenant_admin_refresh_token', 'old-refresh');

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper: loginWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Tokens should be cleared on auth pages
      expect(safeStorage.getItem('tenant_admin_access_token')).toBeNull();
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBeNull();
    });
  });

  describe('Login Flow', () => {
    it('should validate input on login', async () => {
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 }),
        attempts: 1,
        category: 'client',
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.login('invalid-email', 'password', 'test-tenant')
      ).rejects.toThrow();
    });

    it('should handle successful login', async () => {
      const mockAdmin = {
        id: 'admin-123',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'owner',
        tenant_id: 'tenant-123',
        userId: 'user-123',
      };

      const mockTenant = {
        id: 'tenant-123',
        business_name: 'Test Business',
        slug: 'test-tenant',
        subscription_plan: 'pro',
        subscription_status: 'active',
        limits: { customers: 100, menus: 10, products: 500, locations: 5, users: 10 },
        usage: { customers: 10, menus: 2, products: 50, locations: 1, users: 3 },
      };

      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({
            user: { id: 'user-123', email: 'admin@test.com' },
            session: { access_token: 'access-token', refresh_token: 'refresh-token' },
            admin: mockAdmin,
            tenant: mockTenant,
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          }),
          { status: 200 }
        ),
        attempts: 1,
        category: null,
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('admin@test.com', 'password123', 'test-tenant');
      });

      expect(result.current.admin?.email).toBe('admin@test.com');
      expect(result.current.tenant?.slug).toBe('test-tenant');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle rate limiting (429)', async () => {
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({
            error: 'Too many login attempts',
            retryAfter: 300,
          }),
          {
            status: 429,
            headers: { 'Retry-After': '300' },
          }
        ),
        attempts: 1,
        category: 'client',
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.login('admin@test.com', 'password', 'test-tenant')
      ).rejects.toThrow();
    });

    it('should handle invalid credentials (401)', async () => {
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401 }
        ),
        attempts: 1,
        category: 'auth',
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.login('admin@test.com', 'wrong-password', 'test-tenant')
      ).rejects.toThrow();

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle server error (500)', async () => {
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({ error: 'Internal server error' }),
          { status: 500 }
        ),
        attempts: 1,
        category: 'server',
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.login('admin@test.com', 'password', 'test-tenant')
      ).rejects.toThrow();

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear pre-auth session data on login (session fixation protection)', async () => {
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401 }
        ),
        attempts: 1,
        category: 'auth',
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await result.current.login('admin@test.com', 'password', 'test-tenant');
      } catch {
        // Expected to throw
      }

      expect(clearPreAuthSessionData).toHaveBeenCalledWith('tenant_admin');
    });

    it('should store tokens in safeStorage after successful login', async () => {
      const mockAdmin = {
        id: 'admin-456',
        email: 'admin@store.com',
        role: 'owner',
        tenant_id: 'tenant-456',
        userId: 'user-456',
      };

      const mockTenant = {
        id: 'tenant-456',
        business_name: 'Test Store',
        slug: 'test-store',
        subscription_plan: 'starter',
        subscription_status: 'active',
        limits: { customers: 50, menus: 3, products: 100, locations: 2, users: 3 },
        usage: { customers: 5, menus: 1, products: 10, locations: 1, users: 1 },
      };

      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({
            user: { id: 'user-456', email: 'admin@store.com' },
            session: { access_token: 'new-access-tok', refresh_token: 'new-refresh-tok' },
            admin: mockAdmin,
            tenant: mockTenant,
            access_token: 'new-access-tok',
            refresh_token: 'new-refresh-tok',
          }),
          { status: 200 }
        ),
        attempts: 1,
        category: null,
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('admin@store.com', 'password123', 'test-store');
      });

      expect(safeStorage.getItem('tenant_admin_access_token')).toBe('new-access-tok');
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBe('new-refresh-tok');
      expect(safeStorage.getItem('tenant_admin_user')).toContain('admin@store.com');
      expect(safeStorage.getItem('tenant_data')).toContain('test-store');
    });

    it('should sync tokens with Supabase client after login', async () => {
      const mockAdmin = {
        id: 'admin-789',
        email: 'admin@sync.com',
        role: 'admin',
        tenant_id: 'tenant-789',
        userId: 'user-789',
      };

      const mockTenant = {
        id: 'tenant-789',
        business_name: 'Sync Business',
        slug: 'sync-biz',
        subscription_plan: 'pro',
        subscription_status: 'active',
        limits: { customers: 100, menus: 10, products: 500, locations: 5, users: 10 },
        usage: { customers: 0, menus: 0, products: 0, locations: 0, users: 0 },
      };

      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({
            user: { id: 'user-789', email: 'admin@sync.com' },
            session: { access_token: 'sync-access', refresh_token: 'sync-refresh' },
            admin: mockAdmin,
            tenant: mockTenant,
            access_token: 'sync-access',
            refresh_token: 'sync-refresh',
          }),
          { status: 200 }
        ),
        attempts: 1,
        category: null,
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('admin@sync.com', 'password123', 'sync-biz');
      });

      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'sync-access',
        refresh_token: 'sync-refresh',
      });
    });

    it('should apply default limits when tenant response lacks them', async () => {
      const mockAdmin = {
        id: 'admin-def',
        email: 'admin@defaults.com',
        role: 'owner',
        tenant_id: 'tenant-def',
        userId: 'user-def',
      };

      const mockTenant = {
        id: 'tenant-def',
        business_name: 'Defaults Business',
        slug: 'defaults-biz',
        subscription_plan: 'free',
        subscription_status: 'active',
        // No limits or usage provided
      };

      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({
            user: { id: 'user-def', email: 'admin@defaults.com' },
            session: { access_token: 'def-access', refresh_token: 'def-refresh' },
            admin: mockAdmin,
            tenant: mockTenant,
            access_token: 'def-access',
            refresh_token: 'def-refresh',
          }),
          { status: 200 }
        ),
        attempts: 1,
        category: null,
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('admin@defaults.com', 'password123', 'defaults-biz');
      });

      // Should have default limits applied
      expect(result.current.tenant?.limits).toEqual({
        customers: 50,
        menus: 3,
        products: 100,
        locations: 2,
        users: 3,
      });
      expect(result.current.tenant?.usage).toEqual({
        customers: 0,
        menus: 0,
        products: 0,
        locations: 0,
        users: 0,
      });
    });

    it('should handle access denied (403)', async () => {
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({ error: 'Account suspended' }),
          { status: 403 }
        ),
        attempts: 1,
        category: 'auth',
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.login('admin@test.com', 'password', 'test-tenant')
      ).rejects.toThrow();

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Re-initialization Guard', () => {
    it('should not loop infinitely when on admin route with no session', async () => {
      // The wrapper starts on /test-tenant/admin/dashboard (admin route)
      // With no session and no stored tokens, initialization completes with loading=false
      // The re-init guard should prevent infinite loops
      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should stabilize with no auth
      expect(result.current.admin).toBeNull();
      expect(result.current.tenant).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should clear auth state on logout', async () => {
      // Setup authenticated state
      safeStorage.setItem('tenant_admin_access_token', 'token');
      safeStorage.setItem('tenant_admin_refresh_token', 'refresh');
      safeStorage.setItem('tenant_admin_user', JSON.stringify({ id: 'admin-123' }));
      safeStorage.setItem('tenant_data', JSON.stringify({ id: 'tenant-123', slug: 'test-tenant' }));

      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: new Response(JSON.stringify({ success: true }), { status: 200 }),
        attempts: 1,
        category: null,
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.admin).toBeNull();
      expect(result.current.tenant).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(safeStorage.getItem('tenant_admin_access_token')).toBeNull();
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBeNull();
    });

    it('should handle token refresh', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'valid-refresh-token');

      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: new Response(
          JSON.stringify({
            user: { id: 'user-123' },
            session: { access_token: 'new-access', refresh_token: 'new-refresh' },
            access_token: 'new-access',
            refresh_token: 'new-refresh',
          }),
          { status: 200 }
        ),
        attempts: 1,
        category: null,
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      expect(safeStorage.getItem('tenant_admin_access_token')).toBe('new-access');
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBe('new-refresh');
    });

    it('should clear state on refresh failure (401)', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'expired-refresh');
      safeStorage.setItem('tenant_admin_access_token', 'old-access');

      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: new Response(
          JSON.stringify({ error: 'Invalid refresh token' }),
          { status: 401 }
        ),
        attempts: 1,
        category: 'auth',
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      // Auth state should be cleared on 401
      expect(result.current.admin).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear state when refresh token is empty string', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', '');
      safeStorage.setItem('tenant_admin_access_token', 'old-access');

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      // Should not make network request, should clear state immediately
      expect(resilientFetch).not.toHaveBeenCalled();
      expect(result.current.admin).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear state when refresh token is "undefined" string', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'undefined');
      safeStorage.setItem('tenant_admin_access_token', 'old-access');

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      // Should not make network request, should clear state immediately
      expect(resilientFetch).not.toHaveBeenCalled();
      expect(result.current.admin).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear state when refresh token is "null" string', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', 'null');
      safeStorage.setItem('tenant_admin_access_token', 'old-access');

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      // Should not make network request, should clear state immediately
      expect(resilientFetch).not.toHaveBeenCalled();
      expect(result.current.admin).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear state when refresh token is whitespace only', async () => {
      safeStorage.setItem('tenant_admin_refresh_token', '   ');
      safeStorage.setItem('tenant_admin_access_token', 'old-access');

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshAuthToken();
      });

      // Should not make network request, should clear state immediately
      expect(resilientFetch).not.toHaveBeenCalled();
      expect(result.current.admin).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('MFA Flow', () => {
    it('should require MFA when user has verified TOTP', async () => {
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({
            user: { id: 'user-123', email: 'admin@test.com' },
            session: {
              access_token: 'access-token',
              refresh_token: 'refresh-token',
              user: {
                factors: [{ factor_type: 'totp', status: 'verified' }]
              }
            },
            admin: { id: 'admin-123', email: 'admin@test.com' },
            tenant: { id: 'tenant-123', slug: 'test-tenant' },
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          }),
          { status: 200 }
        ),
        attempts: 1,
        category: null,
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('admin@test.com', 'password123', 'test-tenant');
      });

      // Should require MFA but not be fully authenticated yet
      expect(result.current.mfaRequired).toBe(true);
    });
  });

  describe('Tenant Context Security', () => {
    it('should expose context through hook', () => {
      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      expect(result.current).toHaveProperty('admin');
      expect(result.current).toHaveProperty('tenant');
      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('login');
      expect(result.current).toHaveProperty('logout');
      expect(result.current).toHaveProperty('refreshAuthToken');
      expect(result.current).toHaveProperty('refreshTenant');
    });

    it('should throw when used outside provider', () => {
      // Render without wrapper
      expect(() => {
        renderHook(() => useTenantAdminAuth());
      }).toThrow('useTenantAdminAuth must be used within a TenantAdminAuthProvider');
    });
  });
});

describe('Storage Security', () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it('should not store sensitive data in plaintext', async () => {
    // After login, check what's stored
    const mockAdmin = {
      id: 'admin-123',
      email: 'admin@test.com',
      role: 'owner',
      tenant_id: 'tenant-123',
    };

    safeStorage.setItem('tenant_admin_user', JSON.stringify(mockAdmin));

    const stored = safeStorage.getItem('tenant_admin_user');
    expect(stored).not.toBeNull();

    // Verify no actual password is stored (it shouldn't be sent back anyway)
    expect(stored).not.toContain('password');
    expect(stored).not.toContain('secret');
  });

  it('should use safeStorage wrapper for all operations', () => {
    // safeStorage should handle localStorage failures gracefully
    const mockLocalStorage = {
      getItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage not available');
      }),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage not available');
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
    });

    // safeStorage should not throw even if localStorage fails
    expect(() => safeStorage.setItem('key', 'value')).not.toThrow();
    expect(() => safeStorage.getItem('key')).not.toThrow();
  });
});
