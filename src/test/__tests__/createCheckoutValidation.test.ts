/**
 * Create Checkout Validation Tests
 * Tests for the create-checkout edge function's input validation schema.
 * Mirrors the Zod schema in supabase/functions/create-checkout/validation.ts
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the edge function's validation schema for testing
const createCheckoutSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
  plan_id: z.enum(['starter', 'professional', 'enterprise']),
  billing_cycle: z.enum(['monthly', 'yearly']).default('monthly'),
  skip_trial: z.boolean().default(false),
  idempotency_key: z.string().optional(),
});

function validateCreateCheckout(body: unknown) {
  return createCheckoutSchema.parse(body);
}

describe('Create Checkout Validation', () => {
  const validTenantId = '550e8400-e29b-41d4-a716-446655440000';

  describe('valid inputs', () => {
    it('should accept minimal valid input with defaults', () => {
      const result = validateCreateCheckout({
        tenant_id: validTenantId,
        plan_id: 'starter',
      });

      expect(result.tenant_id).toBe(validTenantId);
      expect(result.plan_id).toBe('starter');
      expect(result.billing_cycle).toBe('monthly');
      expect(result.skip_trial).toBe(false);
      expect(result.idempotency_key).toBeUndefined();
    });

    it('should accept yearly billing cycle', () => {
      const result = validateCreateCheckout({
        tenant_id: validTenantId,
        plan_id: 'professional',
        billing_cycle: 'yearly',
      });

      expect(result.billing_cycle).toBe('yearly');
    });

    it('should accept skip_trial true', () => {
      const result = validateCreateCheckout({
        tenant_id: validTenantId,
        plan_id: 'enterprise',
        skip_trial: true,
      });

      expect(result.skip_trial).toBe(true);
    });

    it('should accept idempotency key', () => {
      const key = 'abc-123-def-456';
      const result = validateCreateCheckout({
        tenant_id: validTenantId,
        plan_id: 'starter',
        idempotency_key: key,
      });

      expect(result.idempotency_key).toBe(key);
    });

    it('should accept all valid plan IDs', () => {
      for (const planId of ['starter', 'professional', 'enterprise']) {
        const result = validateCreateCheckout({
          tenant_id: validTenantId,
          plan_id: planId,
        });
        expect(result.plan_id).toBe(planId);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing tenant_id', () => {
      expect(() =>
        validateCreateCheckout({ plan_id: 'starter' })
      ).toThrow();
    });

    it('should reject non-UUID tenant_id', () => {
      expect(() =>
        validateCreateCheckout({
          tenant_id: 'not-a-uuid',
          plan_id: 'starter',
        })
      ).toThrow('Invalid tenant ID format');
    });

    it('should reject missing plan_id', () => {
      expect(() =>
        validateCreateCheckout({ tenant_id: validTenantId })
      ).toThrow();
    });

    it('should reject invalid plan_id', () => {
      expect(() =>
        validateCreateCheckout({
          tenant_id: validTenantId,
          plan_id: 'nonexistent',
        })
      ).toThrow();
    });

    it('should reject UUID as plan_id (old format)', () => {
      expect(() =>
        validateCreateCheckout({
          tenant_id: validTenantId,
          plan_id: '550e8400-e29b-41d4-a716-446655440000',
        })
      ).toThrow();
    });

    it('should reject free as plan_id', () => {
      expect(() =>
        validateCreateCheckout({
          tenant_id: validTenantId,
          plan_id: 'free',
        })
      ).toThrow();
    });

    it('should reject invalid billing_cycle', () => {
      expect(() =>
        validateCreateCheckout({
          tenant_id: validTenantId,
          plan_id: 'starter',
          billing_cycle: 'weekly',
        })
      ).toThrow();
    });

    it('should reject non-boolean skip_trial', () => {
      expect(() =>
        validateCreateCheckout({
          tenant_id: validTenantId,
          plan_id: 'starter',
          skip_trial: 'yes',
        })
      ).toThrow();
    });

    it('should reject empty body', () => {
      expect(() => validateCreateCheckout({})).toThrow();
    });

    it('should reject null body', () => {
      expect(() => validateCreateCheckout(null)).toThrow();
    });
  });
});
