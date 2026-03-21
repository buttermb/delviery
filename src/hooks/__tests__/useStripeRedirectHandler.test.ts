/**
 * useStripeRedirectHandler Hook Tests
 * Verifies URL params are cleaned after Stripe redirect processing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// --- Mocks (must be declared before imports that use them) ---

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}));

const mockInvoke = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'test-tenant' }, error: null }),
        })),
      })),
    })),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    admin: { id: 'admin-1' },
    tenant: { id: 'tenant-1', slug: 'test-tenant' },
    refreshTenant: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/lib/utils/checkEdgeFunctionError', () => ({
  checkEdgeFunctionError: vi.fn(() => null),
}));

// --- Import after mocks ---
import { useStripeRedirectHandler } from '@/hooks/useStripeRedirectHandler';

describe('useStripeRedirectHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockSearchParams = new URLSearchParams();

    // Default: valid session
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });

    // Default: successful edge function call
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('does not navigate when success param is absent', () => {
    mockSearchParams = new URLSearchParams('?other=value');

    renderHook(() => useStripeRedirectHandler());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when trial param is absent', () => {
    mockSearchParams = new URLSearchParams('?success=true');

    renderHook(() => useStripeRedirectHandler());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('cleans URL params after successful Stripe redirect with success=true&trial=true', async () => {
    mockSearchParams = new URLSearchParams('?success=true&trial=true');

    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/test-tenant/admin/dashboard',
        { replace: true }
      );
    });

    // Navigate should be called exactly once — no lingering params
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    // The navigate path must NOT contain query parameters
    const [navigatedPath] = mockNavigate.mock.calls[0] as [string];
    expect(navigatedPath).not.toContain('?');
    expect(navigatedPath).not.toContain('success');
    expect(navigatedPath).not.toContain('trial');
  });

  it('cleans URL params with backward-compat welcome=true param', async () => {
    mockSearchParams = new URLSearchParams('?welcome=true&trial=true');

    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/test-tenant/admin/dashboard',
        { replace: true }
      );
    });

    const [navigatedPath] = mockNavigate.mock.calls[0] as [string];
    expect(navigatedPath).not.toContain('welcome');
  });

  it('cleans tenant_id param from URL after processing', async () => {
    mockSearchParams = new URLSearchParams(
      '?success=true&trial=true&tenant_id=uuid-123'
    );

    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    const [navigatedPath] = mockNavigate.mock.calls[0] as [string];
    expect(navigatedPath).not.toContain('tenant_id');
    expect(navigatedPath).not.toContain('uuid-123');
  });

  it('cleans URL params even when edge function fails (error path)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Edge function failed'),
    });

    // Provide fallback slug via safeStorage
    const { safeStorage } = await import('@/utils/safeStorage');
    vi.mocked(safeStorage.getItem).mockReturnValue('fallback-tenant');

    mockSearchParams = new URLSearchParams('?success=true&trial=true');

    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    const [navigatedPath, options] = mockNavigate.mock.calls[0] as [string, { replace: boolean }];
    expect(navigatedPath).not.toContain('?');
    expect(navigatedPath).not.toContain('success');
    expect(options).toEqual({ replace: true });
  });

  it('uses replace: true to prevent back-button returning to param URL', async () => {
    mockSearchParams = new URLSearchParams('?success=true&trial=true');

    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    const [, options] = mockNavigate.mock.calls[0] as [string, { replace: boolean }];
    expect(options).toEqual({ replace: true });
  });

  it('redirects to login and cleans params when session is expired', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    mockSearchParams = new URLSearchParams('?success=true&trial=true');

    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    const [navigatedPath] = mockNavigate.mock.calls[0] as [string];
    expect(navigatedPath).not.toContain('?');
    expect(navigatedPath).not.toContain('success');
    expect(navigatedPath).not.toContain('trial');
    // Should redirect to login (with tenant slug if available)
    expect(navigatedPath).toContain('login');
  });

  it('calls update-trial-status edge function with correct payload', async () => {
    mockSearchParams = new URLSearchParams('?success=true&trial=true');

    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update-trial-status', {
        body: {
          tenant_id: 'tenant-1',
          payment_method_added: true,
        },
      });
    });
  });

  it('redirects to /saas/login when no tenant slug and error occurs', async () => {
    // Override context to have no tenant
    vi.mocked(await import('@/contexts/TenantAdminAuthContext')).useTenantAdminAuth = vi.fn(() => ({
      admin: null,
      tenant: null,
      refreshTenant: vi.fn().mockResolvedValue(undefined),
    })) as ReturnType<typeof vi.fn>;

    // safeStorage also returns null
    const { safeStorage } = await import('@/utils/safeStorage');
    vi.mocked(safeStorage.getItem).mockReturnValue(null);

    // Edge function fails
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('failed'),
    });

    mockSearchParams = new URLSearchParams('?success=true&trial=true');

    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    const [navigatedPath, options] = mockNavigate.mock.calls[0] as [string, { replace: boolean }];
    expect(navigatedPath).toBe('/saas/login');
    expect(navigatedPath).not.toContain('?');
    expect(options).toEqual({ replace: true });
  });
});
