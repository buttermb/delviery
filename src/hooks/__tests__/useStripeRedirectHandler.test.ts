/**
 * useStripeRedirectHandler Tests
 *
 * Verifies redirect behavior after Stripe checkout success:
 * - Navigates to /{slug}/admin/dashboard on success with tenant slug
 * - Falls back to /saas/login when tenant slug is unavailable
 * - Handles expired sessions (redirect to login)
 * - Handles edge function errors (fallback redirect)
 * - Skips processing when URL params are missing
 * - Supports legacy ?welcome=true parameter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ── Mock variables (hoisted) ────────────────────────────────────────

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

const mockRefreshTenant = vi.fn().mockResolvedValue(undefined);
let mockTenant: { id: string; slug: string } | null = { id: 'tenant-123', slug: 'acme' };
let mockAdmin: { id: string } | null = { id: 'admin-1' };

const mockGetSession = vi.fn();
const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockSafeStorageGetItem = vi.fn().mockReturnValue(null);
const mockSafeStorageSetItem = vi.fn();

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    admin: mockAdmin,
    tenant: mockTenant,
    refreshTenant: mockRefreshTenant,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: (...args: unknown[]) => mockSafeStorageGetItem(...args),
    setItem: (...args: unknown[]) => mockSafeStorageSetItem(...args),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/utils/checkEdgeFunctionError', () => ({
  checkEdgeFunctionError: vi.fn().mockReturnValue(null),
}));

// ── Helpers ─────────────────────────────────────────────────────────

function setUrlParams(params: Record<string, string>) {
  mockSearchParams = new URLSearchParams(params);
}

function mockValidSession() {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'tok', user: { id: 'u1' } } },
  });
}

function mockNoSession() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
}

function mockEdgeFunctionSuccess() {
  mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
}

function mockEdgeFunctionError(message: string) {
  mockInvoke.mockResolvedValue({ data: null, error: new Error(message) });
}

// ── Tests ───────────────────────────────────────────────────────────

describe('useStripeRedirectHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockTenant = { id: 'tenant-123', slug: 'acme' };
    mockAdmin = { id: 'admin-1' };
    mockSafeStorageGetItem.mockReturnValue(null);
  });

  it('does nothing when success param is missing', async () => {
    setUrlParams({ trial: 'true' });

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    // Should not call getSession or navigate
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does nothing when trial param is missing', async () => {
    setUrlParams({ success: 'true' });

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to /{slug}/admin/dashboard on success with tenant slug from context', async () => {
    setUrlParams({ success: 'true', trial: 'true' });
    mockValidSession();
    mockEdgeFunctionSuccess();

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/acme/admin/dashboard', { replace: true });
    });

    expect(mockInvoke).toHaveBeenCalledWith('update-trial-status', {
      body: { tenant_id: 'tenant-123', payment_method_added: true },
    });
    expect(mockRefreshTenant).toHaveBeenCalled();
  });

  it('supports legacy ?welcome=true parameter', async () => {
    setUrlParams({ welcome: 'true', trial: 'true' });
    mockValidSession();
    mockEdgeFunctionSuccess();

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/acme/admin/dashboard', { replace: true });
    });
  });

  it('fetches tenant slug from DB when context has no slug but URL has tenant_id', async () => {
    mockTenant = null;
    mockAdmin = null;
    setUrlParams({ success: 'true', trial: 'true', tenant_id: 'tid-999' });
    mockValidSession();
    mockEdgeFunctionSuccess();

    // Mock supabase .from('tenants').select().eq().maybeSingle()
    const maybeSingle = vi.fn().mockResolvedValue({ data: { slug: 'fetched-slug' } });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/fetched-slug/admin/dashboard', { replace: true });
    });

    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(mockSafeStorageSetItem).toHaveBeenCalledWith('lastTenantSlug', 'fetched-slug');
  });

  it('uses safeStorage fallback when context slug is unavailable', async () => {
    mockTenant = null;
    mockSafeStorageGetItem.mockReturnValue('stored-slug');
    setUrlParams({ success: 'true', trial: 'true' });
    mockValidSession();
    mockEdgeFunctionSuccess();

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/stored-slug/admin/dashboard', { replace: true });
    });
  });

  it('redirects to /saas/login when no tenant slug is available at all', async () => {
    mockTenant = null;
    setUrlParams({ success: 'true', trial: 'true' });
    mockValidSession();
    mockEdgeFunctionSuccess();

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/saas/login', { replace: true });
    });
  });

  it('redirects to login when session is expired', async () => {
    setUrlParams({ success: 'true', trial: 'true' });
    mockNoSession();

    const { toast } = await import('sonner');
    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/acme/admin/login');
    });

    expect(toast.error).toHaveBeenCalledWith('Session expired. Please log in again.');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('redirects to /saas/login when session expired and no tenant slug', async () => {
    mockTenant = null;
    setUrlParams({ success: 'true', trial: 'true' });
    mockNoSession();

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/saas/login');
    });
  });

  it('falls back to safeStorage slug on edge function error', async () => {
    setUrlParams({ success: 'true', trial: 'true' });
    mockValidSession();
    mockEdgeFunctionError('Internal server error');
    mockSafeStorageGetItem.mockReturnValue('fallback-slug');

    const { toast } = await import('sonner');
    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/fallback-slug/admin/dashboard', { replace: true });
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to complete setup', {
      description: 'Please contact support if this issue persists.',
    });
  });

  it('redirects to /saas/login on error when no fallback slug', async () => {
    mockTenant = null;
    setUrlParams({ success: 'true', trial: 'true' });
    mockValidSession();
    mockEdgeFunctionError('Server error');

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/saas/login', { replace: true });
    });
  });

  it('uses tenant_id from URL params when tenant context is null', async () => {
    mockTenant = null;
    setUrlParams({ success: 'true', trial: 'true', tenant_id: 'url-tenant-id' });
    mockValidSession();
    mockEdgeFunctionSuccess();

    // Mock DB fetch returning null (no slug found)
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update-trial-status', {
        body: { tenant_id: 'url-tenant-id', payment_method_added: true },
      });
    });
  });

  it('shows success toast with trial message on successful redirect', async () => {
    setUrlParams({ success: 'true', trial: 'true' });
    mockValidSession();
    mockEdgeFunctionSuccess();

    const { toast } = await import('sonner');
    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Payment method added successfully!', {
        description: 'Your 14-day trial has started.',
      });
    });
  });

  it('calls navigate with replace: true to prevent back-button issues', async () => {
    setUrlParams({ success: 'true', trial: 'true' });
    mockValidSession();
    mockEdgeFunctionSuccess();

    const { useStripeRedirectHandler } = await import('../useStripeRedirectHandler');
    renderHook(() => useStripeRedirectHandler());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ replace: true }),
      );
    });
  });
});
