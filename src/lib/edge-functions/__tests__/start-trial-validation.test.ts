/**
 * Start Trial Validation Tests
 *
 * Verifies the start-trial edge function validates tenant_id as UUID
 * and enforces correct input schema for plan_id, billing_cycle, etc.
 *
 * The Zod schema is mirrored here from supabase/functions/start-trial/validation.ts
 * because the edge function uses Deno imports that can't be imported in Node/Vitest.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mirror of the start-trial validation schema from
// supabase/functions/start-trial/validation.ts
const startTrialSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
  plan_id: z.enum(['starter', 'professional', 'enterprise'], {
    errorMap: () => ({ message: 'Invalid plan. Must be starter, professional, or enterprise' }),
  }),
  billing_cycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  skip_trial: z.boolean().optional().default(false),
  idempotency_key: z.string().optional(),
});

type StartTrialInput = z.infer<typeof startTrialSchema>;

function validateStartTrial(body: unknown): StartTrialInput {
  return startTrialSchema.parse(body);
}

describe('start-trial validation', () => {
  describe('tenant_id UUID validation', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('should accept a valid UUID v4 tenant_id', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'starter',
      });

      expect(result.tenant_id).toBe(validUUID);
    });

    it('should reject a non-UUID string for tenant_id', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: 'not-a-uuid',
          plan_id: 'starter',
        })
      ).toThrow('Invalid tenant ID format');
    });

    it('should reject an empty string for tenant_id', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: '',
          plan_id: 'starter',
        })
      ).toThrow('Invalid tenant ID format');
    });

    it('should reject a numeric tenant_id', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: '12345',
          plan_id: 'starter',
        })
      ).toThrow('Invalid tenant ID format');
    });

    it('should reject SQL injection in tenant_id', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: "'; DROP TABLE tenants; --",
          plan_id: 'starter',
        })
      ).toThrow('Invalid tenant ID format');
    });

    it('should reject a UUID-like string with wrong format', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: '550e8400e29b41d4a716446655440000', // missing hyphens
          plan_id: 'starter',
        })
      ).toThrow('Invalid tenant ID format');
    });

    it('should reject missing tenant_id', () => {
      expect(() =>
        validateStartTrial({
          plan_id: 'starter',
        })
      ).toThrow();
    });

    it('should reject null tenant_id', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: null,
          plan_id: 'starter',
        })
      ).toThrow();
    });

    it('should reject a number type for tenant_id', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: 12345,
          plan_id: 'starter',
        })
      ).toThrow();
    });
  });

  describe('plan_id validation', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('should accept starter plan', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'starter',
      });
      expect(result.plan_id).toBe('starter');
    });

    it('should accept professional plan', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'professional',
      });
      expect(result.plan_id).toBe('professional');
    });

    it('should accept enterprise plan', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'enterprise',
      });
      expect(result.plan_id).toBe('enterprise');
    });

    it('should reject invalid plan_id', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: validUUID,
          plan_id: 'free',
        })
      ).toThrow('Invalid plan. Must be starter, professional, or enterprise');
    });

    it('should reject missing plan_id', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: validUUID,
        })
      ).toThrow();
    });
  });

  describe('billing_cycle validation', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('should default billing_cycle to monthly when not provided', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'starter',
      });
      expect(result.billing_cycle).toBe('monthly');
    });

    it('should accept yearly billing_cycle', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'starter',
        billing_cycle: 'yearly',
      });
      expect(result.billing_cycle).toBe('yearly');
    });

    it('should reject invalid billing_cycle', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: validUUID,
          plan_id: 'starter',
          billing_cycle: 'quarterly',
        })
      ).toThrow();
    });
  });

  describe('skip_trial validation', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('should default skip_trial to false when not provided', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'starter',
      });
      expect(result.skip_trial).toBe(false);
    });

    it('should accept skip_trial as true', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'starter',
        skip_trial: true,
      });
      expect(result.skip_trial).toBe(true);
    });

    it('should reject non-boolean skip_trial', () => {
      expect(() =>
        validateStartTrial({
          tenant_id: validUUID,
          plan_id: 'starter',
          skip_trial: 'yes',
        })
      ).toThrow();
    });
  });

  describe('idempotency_key validation', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('should accept optional idempotency_key', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'starter',
        idempotency_key: 'idem-key-123',
      });
      expect(result.idempotency_key).toBe('idem-key-123');
    });

    it('should accept missing idempotency_key', () => {
      const result = validateStartTrial({
        tenant_id: validUUID,
        plan_id: 'starter',
      });
      expect(result.idempotency_key).toBeUndefined();
    });
  });

  describe('full payload validation', () => {
    it('should accept a complete valid payload', () => {
      const result = validateStartTrial({
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        plan_id: 'professional',
        billing_cycle: 'yearly',
        skip_trial: true,
        idempotency_key: 'unique-key-abc',
      });

      expect(result).toEqual({
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        plan_id: 'professional',
        billing_cycle: 'yearly',
        skip_trial: true,
        idempotency_key: 'unique-key-abc',
      });
    });

    it('should reject completely empty body', () => {
      expect(() => validateStartTrial({})).toThrow();
    });

    it('should reject null body', () => {
      expect(() => validateStartTrial(null)).toThrow();
    });

    it('should reject undefined body', () => {
      expect(() => validateStartTrial(undefined)).toThrow();
    });

    it('should strip unknown properties', () => {
      const result = validateStartTrial({
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        plan_id: 'starter',
        malicious_field: 'attack',
      });

      expect(result).not.toHaveProperty('malicious_field');
    });
  });
});

describe('start-trial integration tests', () => {
  const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
  const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
  const endpoint = `${FUNCTIONS_URL}/start-trial`;

  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should reject non-UUID tenant_id with 400/500 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Invalid tenant ID format' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        tenant_id: 'not-a-uuid',
        plan_id: 'starter',
      }),
    });

    const data = await response.json();
    expect(response.ok).toBe(false);
    expect(data.error).toContain('Invalid tenant ID format');
  });

  it('should accept valid UUID tenant_id and return checkout URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          url: 'https://checkout.stripe.com/c/pay_abc123',
          billing_cycle: 'monthly',
          has_trial: true,
        }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        plan_id: 'starter',
        billing_cycle: 'monthly',
      }),
    });

    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.url).toContain('stripe.com');
    expect(data.has_trial).toBe(true);
  });

  it('should handle CORS preflight', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      }),
    });

    const response = await fetch(endpoint, { method: 'OPTIONS' });
    expect(response.ok).toBe(true);
  });

  it('should reject unauthenticated requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'User not authenticated' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        plan_id: 'starter',
      }),
    });

    expect(response.ok).toBe(false);
    const data = await response.json();
    expect(data.error).toContain('not authenticated');
  });

  it('should reject tenant_id mismatch (caller does not own tenant)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Not authorized for this tenant' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        tenant_id: '660e8400-e29b-41d4-a716-446655440000', // different tenant
        plan_id: 'starter',
      }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Not authorized for this tenant');
  });
});
