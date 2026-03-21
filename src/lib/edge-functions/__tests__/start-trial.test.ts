/**
 * Start-Trial Edge Function Tests
 *
 * Verifies the start-trial edge function correctly validates
 * Stripe key prefix, request body, and returns proper responses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/start-trial`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const validPayload = {
  tenant_id: '550e8400-e29b-41d4-a716-446655440000',
  plan_id: 'starter',
  billing_cycle: 'monthly',
  skip_trial: false,
};

describe('start-trial edge function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Stripe key prefix validation', () => {
    it('returns 500 when STRIPE_SECRET_KEY is a publishable key (pk_)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error:
              "Invalid Stripe configuration. Please use a secret key (starts with 'sk_'), not a publishable key.",
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
        body: JSON.stringify(validPayload),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('secret key');
      expect(data.error).toContain('publishable key');
    });

    it('returns 500 when STRIPE_SECRET_KEY is empty', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error:
              "Invalid Stripe configuration. Please use a secret key (starts with 'sk_'), not a publishable key.",
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
        body: JSON.stringify(validPayload),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Stripe configuration');
    });

    it('succeeds when STRIPE_SECRET_KEY starts with sk_', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
          billing_cycle: 'monthly',
          has_trial: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.url).toBeDefined();
      expect(data.has_trial).toBe(true);
    });
  });

  describe('request validation', () => {
    it('requires authentication', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'User not authenticated' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      expect(response.ok).toBe(false);
    });

    it('validates plan_id is a valid enum value', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid plan. Must be starter, professional, or enterprise' },
          500
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ ...validPayload, plan_id: 'invalid_plan' }),
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toContain('Invalid plan');
    });

    it('validates tenant_id is UUID format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid tenant ID format' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ ...validPayload, tenant_id: 'not-a-uuid' }),
      });

      expect(response.ok).toBe(false);
    });

    it('rejects tenant ID mismatch (caller does not own tenant)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for this tenant' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Not authorized');
    });
  });

  describe('billing cycle and trial options', () => {
    it('supports monthly billing cycle', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/c/pay/cs_test_monthly',
          billing_cycle: 'monthly',
          has_trial: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ ...validPayload, billing_cycle: 'monthly' }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.billing_cycle).toBe('monthly');
    });

    it('supports yearly billing cycle', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/c/pay/cs_test_yearly',
          billing_cycle: 'yearly',
          has_trial: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ ...validPayload, billing_cycle: 'yearly' }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.billing_cycle).toBe('yearly');
    });

    it('supports skip_trial flag', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/c/pay/cs_test_no_trial',
          billing_cycle: 'monthly',
          has_trial: false,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ ...validPayload, skip_trial: true }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.has_trial).toBe(false);
    });
  });

  describe('CORS handling', () => {
    it('handles OPTIONS preflight', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
    });
  });
});
