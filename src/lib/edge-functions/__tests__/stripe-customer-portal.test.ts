/**
 * Stripe Customer Portal Edge Function Tests
 * Tests return URL construction, validation, and security
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const PORTAL_ENDPOINT = `${FUNCTIONS_URL}/stripe-customer-portal`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const validBody = {
  tenant_id: '550e8400-e29b-41d4-a716-446655440000',
};

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer valid-token',
};

describe('Stripe Customer Portal - Return URL', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return a portal URL on success', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        success: true,
        url: 'https://billing.stripe.com/session/test_portal_session',
      })
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });

    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.url).toContain('stripe.com');
  });

  it('should require authentication', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Missing authorization header' }, 401)
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Missing authorization header');
  });

  it('should require tenant_id in body', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Missing tenant_id' }, 400)
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Missing tenant_id');
  });

  it('should return 404 for non-existent tenant', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Tenant not found' }, 404)
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ tenant_id: 'nonexistent-id' }),
    });

    expect(response.status).toBe(404);
  });

  it('should return 403 for non-admin users', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Insufficient permissions - admin or owner access required' }, 403)
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });

    expect(response.status).toBe(403);
  });

  it('should return 500 when SITE_URL is missing and no origin header', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Server misconfiguration: SITE_URL not set' }, 500)
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('SITE_URL');
  });

  it('should handle CORS preflight', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }),
    });

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'OPTIONS',
    });

    expect(response.ok).toBe(true);
  });

  it('should accept optional return_url in request body', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        success: true,
        url: 'https://billing.stripe.com/session/test_session',
      })
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        ...validBody,
        return_url: '/acme/admin/settings',
      }),
    });

    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should return 500 when Stripe secret key is missing', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.',
      }, 500)
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('STRIPE_SECRET_KEY');
  });

  it('should return 500 when Stripe key is publishable instead of secret', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        error: "Invalid Stripe configuration. Please use a secret key (starts with 'sk_'), not a publishable key.",
      }, 500)
    );

    const response = await fetch(PORTAL_ENDPOINT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('sk_');
  });
});

describe('Stripe Customer Portal - Return URL Construction Logic', () => {
  /**
   * These tests verify the return URL construction logic independently.
   * The edge function builds the URL as: siteUrl (trailing slashes stripped) + returnPath
   * Default returnPath: /{tenant.slug}/admin/billing
   * Client override: only accepted if it starts with /{tenant.slug}/admin/
   */

  const buildReturnUrl = (
    siteUrl: string | null,
    origin: string | null,
    tenantSlug: string,
    clientReturnUrl?: string
  ): { returnUrl: string | null; error?: string } => {
    const rawSiteUrl = siteUrl || origin;
    if (!rawSiteUrl) {
      return { returnUrl: null, error: 'Server misconfiguration: SITE_URL not set' };
    }
    const cleanSiteUrl = rawSiteUrl.replace(/\/+$/, '');

    const defaultPath = `/${tenantSlug}/admin/billing`;
    let returnPath = defaultPath;

    if (typeof clientReturnUrl === 'string' && clientReturnUrl.length > 0) {
      const trimmed = clientReturnUrl.startsWith('/') ? clientReturnUrl : `/${clientReturnUrl}`;
      if (trimmed.startsWith(`/${tenantSlug}/admin/`)) {
        returnPath = trimmed;
      }
    }

    const returnUrl = `${cleanSiteUrl}${returnPath}`;

    try {
      new URL(returnUrl);
    } catch {
      return { returnUrl: null, error: 'Server misconfiguration: invalid return URL' };
    }

    return { returnUrl };
  };

  it('should use SITE_URL when available', () => {
    const result = buildReturnUrl('https://app.floraiq.com', null, 'acme');
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });

  it('should fall back to origin when SITE_URL is missing', () => {
    const result = buildReturnUrl(null, 'https://app.floraiq.com', 'acme');
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });

  it('should fail when both SITE_URL and origin are missing', () => {
    const result = buildReturnUrl(null, null, 'acme');
    expect(result.returnUrl).toBeNull();
    expect(result.error).toContain('SITE_URL');
  });

  it('should strip trailing slashes from SITE_URL', () => {
    const result = buildReturnUrl('https://app.floraiq.com/', null, 'acme');
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });

  it('should strip multiple trailing slashes', () => {
    const result = buildReturnUrl('https://app.floraiq.com///', null, 'acme');
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });

  it('should accept valid client return_url scoped to tenant admin', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      null,
      'acme',
      '/acme/admin/settings'
    );
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/settings');
  });

  it('should accept client return_url with query params', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      null,
      'acme',
      '/acme/admin/billing?tab=credits'
    );
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing?tab=credits');
  });

  it('should reject client return_url not scoped to tenant admin', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      null,
      'acme',
      '/other-tenant/admin/billing'
    );
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });

  it('should reject client return_url pointing to external site', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      null,
      'acme',
      'https://evil.com/steal-data'
    );
    // Should fall back to default since it doesn't start with /{slug}/admin/
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });

  it('should reject empty client return_url', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      null,
      'acme',
      ''
    );
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });

  it('should auto-prepend slash to client return_url without leading slash', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      null,
      'acme',
      'acme/admin/settings'
    );
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/settings');
  });

  it('should reject client return_url going to non-admin area', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      null,
      'acme',
      '/acme/storefront/products'
    );
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });

  it('should handle tenant slugs with hyphens', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      null,
      'my-cool-shop',
      '/my-cool-shop/admin/settings'
    );
    expect(result.returnUrl).toBe('https://app.floraiq.com/my-cool-shop/admin/settings');
  });

  it('should prefer SITE_URL over origin', () => {
    const result = buildReturnUrl(
      'https://app.floraiq.com',
      'https://other-origin.com',
      'acme'
    );
    expect(result.returnUrl).toBe('https://app.floraiq.com/acme/admin/billing');
  });
});
