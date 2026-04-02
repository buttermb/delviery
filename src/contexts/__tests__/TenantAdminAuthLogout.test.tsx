/**
 * TenantAdminAuthContext Logout Tests
 * Comprehensive tests for the logout flow including:
 * - Edge function call with Authorization header
 * - Graceful degradation when edge function fails
 * - Storage cleanup
 * - React state cleanup
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
        data: { subscription: { unsubscribe: vi.fn() } },
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

// Import after mocks
import { TenantAdminAuthProvider, useTenantAdminAuth } from '../TenantAdminAuthContext';
import { resilientFetch } from '@/lib/utils/networkResilience';
import { safeStorage } from '@/utils/safeStorage';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { supabase } from '@/integrations/supabase/client';

// Use login page wrapper so init skips the raw fetch() verification call
// (the init fast-paths for auth pages by clearing stale tokens and returning)
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/test-tenant/admin/login']}>
    <TenantAdminAuthProvider>{children}</TenantAdminAuthProvider>
  </MemoryRouter>
);

const mockLoginResponse = {
  user: { id: 'user-123', email: 'admin@test.com' },
  session: { access_token: 'test-access-token', refresh_token: 'test-refresh-token' },
  admin: {
    id: 'admin-123',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'owner',
    tenant_id: 'tenant-123',
    userId: 'user-123',
  },
  tenant: {
    id: 'tenant-123',
    business_name: 'Test Business',
    slug: 'test-tenant',
    subscription_plan: 'pro',
    subscription_status: 'active',
    limits: { customers: 100, menus: 10, products: 500, locations: 5, users: 10 },
    usage: { customers: 10, menus: 2, products: 50, locations: 1, users: 3 },
  },
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
};

/** Helper: render hook, wait for init, login, return result */
async function renderAndLogin(overrideToken?: string) {
  const token = overrideToken || 'test-access-token';
  const response = overrideToken
    ? { ...mockLoginResponse, access_token: token, session: { ...mockLoginResponse.session, access_token: token } }
    : mockLoginResponse;

  (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    response: new Response(JSON.stringify(response), { status: 200 }),
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

  expect(result.current.isAuthenticated).toBe(true);
  return result;
}

describe('TenantAdminAuth Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    safeStorage.clear();
    (resilientFetch as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Edge Function Call', () => {
    it('should send Authorization header with access token on logout', async () => {
      const result = await renderAndLogin('my-access-token');

      // Reset mock call history to isolate logout call
      (resilientFetch as ReturnType<typeof vi.fn>).mockClear();
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: new Response(JSON.stringify({ success: true }), { status: 200 }),
        attempts: 1,
        category: null,
      });

      await act(async () => {
        await result.current.logout();
      });

      // Verify edge function was called with Authorization header
      expect(resilientFetch).toHaveBeenCalledWith(
        expect.stringContaining('tenant-admin-auth?action=logout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'Authorization': 'Bearer my-access-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should call logout endpoint without Authorization when no token exists', async () => {
      // Render on login page (no tokens)
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: new Response(JSON.stringify({ success: true }), { status: 200 }),
        attempts: 1,
        category: null,
      });

      const { result } = renderHook(() => useTenantAdminAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear mock history, then call logout with no auth state
      (resilientFetch as ReturnType<typeof vi.fn>).mockClear();
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: new Response(JSON.stringify({ success: true }), { status: 200 }),
        attempts: 1,
        category: null,
      });

      await act(async () => {
        await result.current.logout();
      });

      // Verify Authorization header was NOT included
      expect(resilientFetch).toHaveBeenCalled();
      const callArgs = (resilientFetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('Graceful Degradation', () => {
    it('should complete logout even when edge function fails with network error', async () => {
      const result = await renderAndLogin();

      // Mock logout to fail
      (resilientFetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error'),
      );

      await act(async () => {
        await result.current.logout();
      });

      // State should still be cleared despite network error
      expect(result.current.admin).toBeNull();
      expect(result.current.tenant).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(safeStorage.getItem('tenant_admin_access_token')).toBeNull();
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBeNull();
    });

    it('should complete logout even when edge function returns 500', async () => {
      const result = await renderAndLogin();

      // Mock logout to return server error
      (resilientFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        response: new Response(JSON.stringify({ error: 'Server error' }), { status: 500 }),
        attempts: 1,
        category: 'server',
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.admin).toBeNull();
    });
  });

  describe('Storage Cleanup', () => {
    it('should clear all tenant admin storage keys on logout', async () => {
      const result = await renderAndLogin();

      await act(async () => {
        await result.current.logout();
      });

      expect(safeStorage.getItem('tenant_admin_access_token')).toBeNull();
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBeNull();
      expect(safeStorage.getItem('tenant_admin_user')).toBeNull();
      expect(safeStorage.getItem('tenant_data')).toBeNull();
    });

    it('should call supabase.auth.signOut during logout', async () => {
      const result = await renderAndLogin();

      await act(async () => {
        await result.current.logout();
      });

      // performFullLogout calls supabase.auth.signOut
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should destroy encryption session during logout', async () => {
      const result = await renderAndLogin();

      await act(async () => {
        await result.current.logout();
      });

      // performFullLogout calls clientEncryption.destroy
      expect(clientEncryption.destroy).toHaveBeenCalled();
    });
  });

  describe('React State Cleanup', () => {
    it('should clear all context state on logout', async () => {
      const result = await renderAndLogin();

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.admin).toBeNull();
      expect(result.current.tenant).toBeNull();
      expect(result.current.tenantSlug).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should not be in loading state after logout', async () => {
      const result = await renderAndLogin();

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Multiple Logouts', () => {
    it('should handle double logout gracefully', async () => {
      const result = await renderAndLogin();

      // First logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);

      // Second logout should not throw
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.admin).toBeNull();
    });
  });

  describe('Full Login-Logout Cycle', () => {
    it('should fully clear state after login then logout', async () => {
      const result = await renderAndLogin();

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.admin?.email).toBe('admin@test.com');

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.admin).toBeNull();
      expect(result.current.tenant).toBeNull();
      expect(safeStorage.getItem('tenant_admin_access_token')).toBeNull();
      expect(safeStorage.getItem('tenant_admin_refresh_token')).toBeNull();
      expect(safeStorage.getItem('tenant_admin_user')).toBeNull();
      expect(safeStorage.getItem('tenant_data')).toBeNull();
    });
  });
});
