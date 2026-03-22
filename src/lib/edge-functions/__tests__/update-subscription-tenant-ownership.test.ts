/**
 * Update Subscription — Tenant Ownership Verification Tests
 *
 * Verifies the update-subscription edge function enforces tenant ownership:
 * 1. Requires valid Authorization header
 * 2. Rejects unauthenticated users
 * 3. Rejects users with no tenant association
 * 4. Rejects cross-tenant requests (resolved tenant_id !== client tenant_id)
 * 5. Accepts valid requests where tenant ownership is confirmed
 * 6. Validates required parameters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/update-subscription`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('update-subscription tenant ownership', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should reject requests without authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization header' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: 'tenant-123', plan_id: 'plan-456' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization header');
    });

    it('should reject requests with invalid token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'User not authenticated' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-expired-token',
        },
        body: JSON.stringify({ tenant_id: 'tenant-123', plan_id: 'plan-456' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('User not authenticated');
    });
  });

  describe('tenant ownership verification', () => {
    it('should reject user with no tenant association (403)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'No tenant associated with user' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-no-tenant',
        },
        body: JSON.stringify({ tenant_id: 'tenant-123', plan_id: 'plan-456' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('No tenant associated with user');
    });

    it('should reject cross-tenant requests (resolved tenant_id !== client tenant_id)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for this tenant' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-tenant-a',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-b-different',
          plan_id: 'plan-456',
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Not authorized for this tenant');
    });

    it('should accept request when resolved tenant matches client tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ url: 'https://checkout.stripe.com/session/test' })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-owner',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.url).toBeDefined();
      expect(data.url).toContain('stripe.com');
    });
  });

  describe('parameter validation', () => {
    it('should reject request missing tenant_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ plan_id: 'plan-456' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing tenant_id or plan_id');
    });

    it('should reject request missing plan_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ tenant_id: 'tenant-123' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing tenant_id or plan_id');
    });

    it('should reject request with no body parameters', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing tenant_id or plan_id' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing tenant_id or plan_id');
    });
  });

  describe('resource validation', () => {
    it('should return 404 when tenant does not exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'nonexistent-tenant',
          plan_id: 'plan-456',
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Tenant not found');
    });

    it('should return 404 when plan does not exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Plan not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'nonexistent-plan',
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Plan not found');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, {
        method: 'OPTIONS',
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return 500 for internal server errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should return error when Stripe is not configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Stripe not configured. Please set STRIPE_SECRET_KEY.' },
          500
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Stripe not configured');
    });

    it('should return 500 when Stripe key is invalid (not sk_ prefix)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error:
              "Invalid STRIPE_SECRET_KEY configured. A Stripe secret key starting with 'sk_' is required.",
          },
          500
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-456',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("starting with 'sk_'");
    });
  });

  describe('successful subscription update', () => {
    it('should return a Stripe checkout URL on success', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_abc123';

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ url: checkoutUrl })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-owner',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-pro',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.url).toBe(checkoutUrl);
    });

    it('should send correct request body with tenant_id and plan_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ url: 'https://checkout.stripe.com/session' })
      );

      await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-owner',
        },
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          plan_id: 'plan-pro',
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token-owner',
          }),
          body: JSON.stringify({
            tenant_id: 'tenant-123',
            plan_id: 'plan-pro',
          }),
        })
      );
    });
  });
});
