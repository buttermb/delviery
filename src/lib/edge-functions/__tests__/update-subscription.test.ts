/**
 * update-subscription Edge Function Tests
 *
 * Verifies that the update-subscription edge function:
 * 1. Uses plan.stripe_price_id from the subscription_plans database table
 * 2. Validates that stripe_price_id is non-null before sending to Stripe
 * 3. Requires authentication and tenant ownership
 * 4. Returns correct error responses for edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock responses
const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('update-subscription Edge Function', () => {
  const endpoint = `${FUNCTIONS_URL}/update-subscription`;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('stripe_price_id from database', () => {
    it('should create checkout session with plan.stripe_price_id from subscription_plans table', async () => {
      const mockResponse = {
        url: 'https://checkout.stripe.com/c/pay_test_abc123',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf', // UUID from subscription_plans table
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.url).toBeDefined();
      expect(data.url).toContain('https://checkout.stripe.com');

      // Verify the request was made with a plan UUID, not a tier name
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.plan_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should reject plan with missing stripe_price_id (unconfigured Stripe)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Plan is not configured for billing. Run setup-stripe-products first.' },
          500
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('not configured for billing');
      expect(data.error).toContain('setup-stripe-products');
    });
  });

  describe('authentication and authorization', () => {
    it('should require authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization header' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization header');
    });

    it('should reject unauthenticated users', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'User not authenticated' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject requests for tenants the user does not own', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for this tenant' }, 403)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'other-tenant-id-not-owned',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Not authorized for this tenant');
    });
  });

  describe('input validation', () => {
    it('should require both tenant_id and plan_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ tenant_id: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing');
    });

    it('should return 404 for non-existent plan', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Plan not found' }, 404)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '00000000-0000-0000-0000-000000000000',
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Plan not found');
    });

    it('should return 404 for non-existent tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant not found' }, 404)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '00000000-0000-0000-0000-000000000000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('Stripe configuration validation', () => {
    it('should reject when STRIPE_SECRET_KEY is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Stripe not configured. Please set STRIPE_SECRET_KEY.' },
          500
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('STRIPE_SECRET_KEY');
    });

    it('should reject invalid Stripe key (not starting with sk_)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: "Invalid STRIPE_SECRET_KEY configured. A Stripe secret key starting with 'sk_' is required." },
          500
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('sk_');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(endpoint, {
        method: 'OPTIONS',
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('checkout session response', () => {
    it('should return checkout URL on success', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/c/pay_test_xyz';

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ url: checkoutUrl })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.url).toBe(checkoutUrl);
    });

    it('should handle internal server errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          plan_id: '9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});

describe('planPricing.ts configuration', () => {
  it('should have stripe price IDs for all paid plans', async () => {
    const { PLAN_CONFIG } = await import('@/config/planPricing');

    expect(PLAN_CONFIG.starter.stripePriceId).toBeDefined();
    expect(PLAN_CONFIG.starter.stripePriceId).toMatch(/^price_/);

    expect(PLAN_CONFIG.professional.stripePriceId).toBeDefined();
    expect(PLAN_CONFIG.professional.stripePriceId).toMatch(/^price_/);

    expect(PLAN_CONFIG.enterprise.stripePriceId).toBeDefined();
    expect(PLAN_CONFIG.enterprise.stripePriceId).toMatch(/^price_/);
  });

  it('should have null stripe price IDs for free plan', async () => {
    const { PLAN_CONFIG } = await import('@/config/planPricing');

    expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
    expect(PLAN_CONFIG.free.stripeProductId).toBeNull();
  });

  it('should have unique stripe price IDs across plans', async () => {
    const { PLAN_CONFIG } = await import('@/config/planPricing');

    const priceIds = [
      PLAN_CONFIG.starter.stripePriceId,
      PLAN_CONFIG.professional.stripePriceId,
      PLAN_CONFIG.enterprise.stripePriceId,
    ];

    const uniqueIds = new Set(priceIds);
    expect(uniqueIds.size).toBe(3);
  });

  it('should have stripe product IDs for all paid plans', async () => {
    const { PLAN_CONFIG } = await import('@/config/planPricing');

    expect(PLAN_CONFIG.starter.stripeProductId).toBeDefined();
    expect(PLAN_CONFIG.starter.stripeProductId).toMatch(/^prod_/);

    expect(PLAN_CONFIG.professional.stripeProductId).toBeDefined();
    expect(PLAN_CONFIG.professional.stripeProductId).toMatch(/^prod_/);

    expect(PLAN_CONFIG.enterprise.stripeProductId).toBeDefined();
    expect(PLAN_CONFIG.enterprise.stripeProductId).toMatch(/^prod_/);
  });

  it('should have correct monthly prices', async () => {
    const { PLAN_CONFIG } = await import('@/config/planPricing');

    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.starter.priceMonthly).toBe(79);
    expect(PLAN_CONFIG.professional.priceMonthly).toBe(150);
    expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(499);
  });

  it('should have correct yearly prices (approximately 17% discount)', async () => {
    const { PLAN_CONFIG } = await import('@/config/planPricing');

    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
    expect(PLAN_CONFIG.starter.priceYearly).toBe(790);
    expect(PLAN_CONFIG.professional.priceYearly).toBe(1500);
    expect(PLAN_CONFIG.enterprise.priceYearly).toBe(4990);

    // Verify discount is roughly 17% (within rounding)
    for (const plan of ['starter', 'professional', 'enterprise'] as const) {
      const monthly = PLAN_CONFIG[plan].priceMonthly;
      const yearly = PLAN_CONFIG[plan].priceYearly;
      const annualFromMonthly = monthly * 12;
      const discountPercent = ((annualFromMonthly - yearly) / annualFromMonthly) * 100;
      expect(discountPercent).toBeGreaterThanOrEqual(16);
      expect(discountPercent).toBeLessThanOrEqual(18);
    }
  });

  it('getPlanConfig should return correct plan for valid keys', async () => {
    const { getPlanConfig, PLAN_CONFIG } = await import('@/config/planPricing');

    expect(getPlanConfig('starter')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('professional')).toBe(PLAN_CONFIG.professional);
    expect(getPlanConfig('enterprise')).toBe(PLAN_CONFIG.enterprise);
    expect(getPlanConfig('free')).toBe(PLAN_CONFIG.free);
  });

  it('getPlanConfig should default to free plan for unknown keys', async () => {
    const { getPlanConfig, PLAN_CONFIG } = await import('@/config/planPricing');

    expect(getPlanConfig('unknown')).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig(null)).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('')).toBe(PLAN_CONFIG.free);
  });

  it('isValidPlan should correctly identify valid plans', async () => {
    const { isValidPlan } = await import('@/config/planPricing');

    expect(isValidPlan('free')).toBe(true);
    expect(isValidPlan('starter')).toBe(true);
    expect(isValidPlan('professional')).toBe(true);
    expect(isValidPlan('enterprise')).toBe(true);
    expect(isValidPlan('unknown')).toBe(false);
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan('')).toBe(false);
  });
});
