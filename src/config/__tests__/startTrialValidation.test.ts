/**
 * Start-Trial Validation Tests
 * Verifies the Zod schema for start-trial edge function input
 * These tests run against a local copy of the validation schema
 * to catch regressions without needing Deno.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror of supabase/functions/start-trial/validation.ts schema
// Keep in sync — changes to the edge function schema must be reflected here.
const startTrialSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
  plan_id: z.enum(['starter', 'professional', 'enterprise'], {
    errorMap: () => ({ message: 'Invalid plan. Must be starter, professional, or enterprise' }),
  }),
  billing_cycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  skip_trial: z.boolean().optional().default(false),
  idempotency_key: z.string().optional(),
});

const VALID_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('Start-Trial Validation Schema', () => {
  describe('Valid Inputs', () => {
    it('accepts minimal valid input (defaults to monthly, no skip)', () => {
      const result = startTrialSchema.parse({
        tenant_id: VALID_TENANT_ID,
        plan_id: 'starter',
      });
      expect(result.billing_cycle).toBe('monthly');
      expect(result.skip_trial).toBe(false);
    });

    it('accepts yearly billing cycle', () => {
      const result = startTrialSchema.parse({
        tenant_id: VALID_TENANT_ID,
        plan_id: 'professional',
        billing_cycle: 'yearly',
      });
      expect(result.billing_cycle).toBe('yearly');
    });

    it('accepts skip_trial=true', () => {
      const result = startTrialSchema.parse({
        tenant_id: VALID_TENANT_ID,
        plan_id: 'enterprise',
        skip_trial: true,
      });
      expect(result.skip_trial).toBe(true);
    });

    it('accepts all three plan types', () => {
      for (const planId of ['starter', 'professional', 'enterprise']) {
        const result = startTrialSchema.parse({
          tenant_id: VALID_TENANT_ID,
          plan_id: planId,
        });
        expect(result.plan_id).toBe(planId);
      }
    });

    it('accepts optional idempotency_key', () => {
      const result = startTrialSchema.parse({
        tenant_id: VALID_TENANT_ID,
        plan_id: 'starter',
        idempotency_key: 'idem_abc123',
      });
      expect(result.idempotency_key).toBe('idem_abc123');
    });
  });

  describe('Invalid Inputs', () => {
    it('rejects non-UUID tenant_id', () => {
      expect(() =>
        startTrialSchema.parse({
          tenant_id: 'not-a-uuid',
          plan_id: 'starter',
        })
      ).toThrow('Invalid tenant ID format');
    });

    it('rejects free plan (not allowed for trial start)', () => {
      expect(() =>
        startTrialSchema.parse({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'free',
        })
      ).toThrow('Invalid plan');
    });

    it('rejects unknown plan IDs', () => {
      expect(() =>
        startTrialSchema.parse({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'premium',
        })
      ).toThrow('Invalid plan');
    });

    it('rejects invalid billing_cycle values', () => {
      expect(() =>
        startTrialSchema.parse({
          tenant_id: VALID_TENANT_ID,
          plan_id: 'starter',
          billing_cycle: 'quarterly',
        })
      ).toThrow();
    });

    it('rejects missing tenant_id', () => {
      expect(() =>
        startTrialSchema.parse({
          plan_id: 'starter',
        })
      ).toThrow();
    });

    it('rejects missing plan_id', () => {
      expect(() =>
        startTrialSchema.parse({
          tenant_id: VALID_TENANT_ID,
        })
      ).toThrow();
    });
  });

  describe('Billing Cycle Defaults', () => {
    it('defaults to monthly when billing_cycle is omitted', () => {
      const result = startTrialSchema.parse({
        tenant_id: VALID_TENANT_ID,
        plan_id: 'starter',
      });
      expect(result.billing_cycle).toBe('monthly');
    });

    it('defaults skip_trial to false when omitted', () => {
      const result = startTrialSchema.parse({
        tenant_id: VALID_TENANT_ID,
        plan_id: 'starter',
      });
      expect(result.skip_trial).toBe(false);
    });
  });
});
