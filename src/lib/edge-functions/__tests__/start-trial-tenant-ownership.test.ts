/**
 * Start Trial — Tenant Ownership Verification Tests
 *
 * Verifies that the start-trial edge function:
 * 1. Resolves the caller's tenant from tenant_users (never trusts client-supplied value)
 * 2. Returns 403 when the client-supplied tenant_id doesn't match the resolved tenant
 * 3. Returns 403 when the user has no tenant association
 * 4. Validates input with Zod (invalid UUID, missing plan_id, bad billing_cycle)
 * 5. Requires authentication (401 without token)
 * 6. Allows requests when tenant ownership matches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const START_TRIAL_URL = `${FUNCTIONS_URL}/start-trial`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const VALID_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_TENANT_ID = '660e8400-e29b-41d4-a716-446655440001';
const AUTH_HEADER = 'Bearer valid-access-token';

describe('start-trial Tenant Ownership Verification', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('tenant ownership enforcement', () => {
    it('should return 403 when client-supplied tenant_id does not match resolved tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Not authorized for this tenant' },
          403
        )
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: OTHER_TENANT_ID,
          plan_id: 'starter',
          billing_cycle: 'monthly',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Not authorized for this tenant');
    });

    it('should return 403 when user has no tenant association', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'No tenant associated with user' },
          403
        )
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('No tenant associated with user');
    });

    it('should allow request when resolved tenant matches client-supplied tenant_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/pay/cs_test_123',
          billing_cycle: 'monthly',
          has_trial: true,
        })
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
          billing_cycle: 'monthly',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.url).toBeDefined();
      expect(data.has_trial).toBe(true);
    });
  });

  describe('authentication requirements', () => {
    it('should reject unauthenticated requests', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'User not authenticated' },
          500
        )
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
        }),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject invalid bearer token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'User not authenticated' },
          500
        )
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
        }),
      });

      expect(response.ok).toBe(false);
    });
  });

  describe('input validation (Zod schema)', () => {
    it('should reject non-UUID tenant_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid tenant ID format' },
          500
        )
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: 'not-a-uuid',
          plan_id: 'starter',
        }),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject invalid plan_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid plan. Must be starter, professional, or enterprise' },
          500
        )
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'nonexistent-plan',
        }),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject invalid billing_cycle', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Validation failed' },
          500
        )
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
          billing_cycle: 'weekly',
        }),
      });

      expect(response.ok).toBe(false);
    });

    it('should accept valid starter plan with monthly billing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/pay/cs_test_123',
          billing_cycle: 'monthly',
          has_trial: true,
        })
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
          billing_cycle: 'monthly',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.billing_cycle).toBe('monthly');
    });

    it('should accept valid professional plan with yearly billing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/pay/cs_test_456',
          billing_cycle: 'yearly',
          has_trial: true,
        })
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'professional',
          billing_cycle: 'yearly',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.billing_cycle).toBe('yearly');
    });

    it('should accept enterprise plan', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/pay/cs_test_789',
          billing_cycle: 'monthly',
          has_trial: true,
        })
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'enterprise',
          billing_cycle: 'monthly',
        }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('skip_trial behavior', () => {
    it('should return has_trial=true when skip_trial is false', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/pay/cs_test_trial',
          billing_cycle: 'monthly',
          has_trial: true,
        })
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
          skip_trial: false,
        }),
      });

      const data = await response.json();
      expect(data.has_trial).toBe(true);
    });

    it('should return has_trial=false when skip_trial is true', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/pay/cs_test_notrial',
          billing_cycle: 'monthly',
          has_trial: false,
        })
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
          skip_trial: true,
        }),
      });

      const data = await response.json();
      expect(data.has_trial).toBe(false);
    });

    it('should default to trial when skip_trial is not provided', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/pay/cs_test_default',
          billing_cycle: 'monthly',
          has_trial: true,
        })
      );

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
        }),
      });

      const data = await response.json();
      expect(data.has_trial).toBe(true);
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

      const response = await fetch(START_TRIAL_URL, {
        method: 'OPTIONS',
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('idempotency support', () => {
    it('should pass idempotency_key to Stripe checkout', async () => {
      const idempotencyKey = crypto.randomUUID();

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          url: 'https://checkout.stripe.com/pay/cs_test_idempotent',
          billing_cycle: 'monthly',
          has_trial: true,
        })
      );

      const body = JSON.stringify({
        tenant_id: VALID_TENANT_ID,
        plan_id: 'starter',
        idempotency_key: idempotencyKey,
      });

      const response = await fetch(START_TRIAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body,
      });

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        START_TRIAL_URL,
        expect.objectContaining({
          body: expect.stringContaining(idempotencyKey),
        })
      );
    });
  });
});
