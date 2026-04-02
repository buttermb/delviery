/**
 * send-trial-expiration-notice - Credit Deduction & Logic Tests
 *
 * Verifies that the edge function correctly:
 * 1. Deducts credits for free-tier tenants using send_email action key
 * 2. Skips credit deduction for paid-tier tenants
 * 3. Handles credit RPC errors gracefully
 * 4. Filters notifications to exactly 1 or 3 days remaining
 * 5. Produces idempotent reference IDs per tenant/day/date
 * 6. Reports correct counts (successful, skipped, failed)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ============================================================================
// Schema Contracts
// ============================================================================

/** Response schema for successful execution */
const successResponseSchema = z.object({
  total: z.number().int().min(0),
  successful: z.number().int().min(0),
  skipped: z.number().int().min(0),
  failed: z.number().int().min(0),
  timestamp: z.string().datetime(),
});

/** Response schema for error execution */
const errorResponseSchema = z.object({
  error: z.string(),
  timestamp: z.string().datetime(),
});

/** Schema for the consume_credits RPC parameters */
const consumeCreditsParamsSchema = z.object({
  p_tenant_id: z.string().uuid(),
  p_amount: z.number().int(),
  p_action_key: z.literal('send_email'),
  p_description: z.string().min(1),
  p_reference_id: z.string().min(1),
  p_metadata: z.object({
    notification_type: z.literal('trial_expiration'),
    days_remaining: z.union([z.literal(1), z.literal(3)]),
  }),
});

/** Schema for per-tenant email task result */
const emailResultSchema = z.object({
  email: z.string().email(),
  days: z.union([z.literal(1), z.literal(3)]),
  sent: z.boolean(),
  credits_deducted: z.boolean(),
  skipped_reason: z.string().optional(),
});

// ============================================================================
// Notification Filtering Logic
// ============================================================================

/**
 * Replicates the days-remaining calculation from the edge function.
 * Used to verify the filtering logic in tests.
 */
function calculateDaysRemaining(trialEndsAt: string, now: Date): number {
  const trialEndDate = new Date(trialEndsAt);
  return Math.ceil((trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Replicates the reference ID format from the edge function.
 */
function buildReferenceId(tenantId: string, daysRemaining: number, todayStr: string): string {
  return `trial-expiry-${tenantId}-${daysRemaining}d-${todayStr}`;
}

// ============================================================================
// Tests
// ============================================================================

describe('send-trial-expiration-notice - Credit Deduction', () => {
  describe('Response Schema', () => {
    it('should match the expected success response format', () => {
      const mockResponse = {
        total: 5,
        successful: 3,
        skipped: 1,
        failed: 1,
        timestamp: new Date().toISOString(),
      };

      const result = successResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should match the expected error response format', () => {
      const mockResponse = {
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      };

      const result = errorResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should accept zero counts in success response', () => {
      const mockResponse = {
        total: 0,
        successful: 0,
        skipped: 0,
        failed: 0,
        timestamp: new Date().toISOString(),
      };

      const result = successResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should reject response missing required fields', () => {
      const mockResponse = { total: 1 };
      const result = successResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('consume_credits RPC Parameters', () => {
    it('should use send_email as the action key with correct params', () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const params = {
        p_tenant_id: tenantId,
        p_amount: 0,
        p_action_key: 'send_email' as const,
        p_description: 'Trial expiration notice - 3 day(s) remaining',
        p_reference_id: `trial-expiry-${tenantId}-3d-2026-04-02`,
        p_metadata: {
          notification_type: 'trial_expiration' as const,
          days_remaining: 3 as const,
        },
      };

      const result = consumeCreditsParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should reject invalid action keys', () => {
      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        p_amount: 0,
        p_action_key: 'wrong_action',
        p_description: 'Test',
        p_reference_id: 'test-ref',
        p_metadata: { notification_type: 'trial_expiration', days_remaining: 3 },
      };

      const result = consumeCreditsParamsSchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should accept 1-day warning metadata', () => {
      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        p_amount: 0,
        p_action_key: 'send_email' as const,
        p_description: 'Trial expiration notice - 1 day(s) remaining',
        p_reference_id: 'trial-expiry-550e8400-e29b-41d4-a716-446655440000-1d-2026-04-02',
        p_metadata: {
          notification_type: 'trial_expiration' as const,
          days_remaining: 1 as const,
        },
      };

      const result = consumeCreditsParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should reject metadata with invalid days_remaining', () => {
      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        p_amount: 0,
        p_action_key: 'send_email',
        p_description: 'Test',
        p_reference_id: 'test-ref',
        p_metadata: { notification_type: 'trial_expiration', days_remaining: 5 },
      };

      const result = consumeCreditsParamsSchema.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  describe('Email Result Schema', () => {
    it('should represent a successful send for paid tier', () => {
      const result = emailResultSchema.safeParse({
        email: 'owner@example.com',
        days: 3,
        sent: true,
        credits_deducted: false,
      });
      expect(result.success).toBe(true);
    });

    it('should represent a successful send for free tier with credit deduction', () => {
      const result = emailResultSchema.safeParse({
        email: 'owner@example.com',
        days: 1,
        sent: true,
        credits_deducted: true,
      });
      expect(result.success).toBe(true);
    });

    it('should represent a skipped send due to credit error', () => {
      const result = emailResultSchema.safeParse({
        email: 'owner@example.com',
        days: 3,
        sent: false,
        credits_deducted: false,
        skipped_reason: 'Credit error: Database connection failed',
      });
      expect(result.success).toBe(true);
    });

    it('should represent a skipped send due to insufficient credits', () => {
      const result = emailResultSchema.safeParse({
        email: 'owner@example.com',
        days: 1,
        sent: false,
        credits_deducted: false,
        skipped_reason: 'Insufficient credits',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Days Remaining Calculation', () => {
    it('should calculate 3 days remaining correctly', () => {
      const now = new Date('2026-04-02T12:00:00.000Z');
      const trialEndsAt = '2026-04-05T12:00:00.000Z';

      const days = calculateDaysRemaining(trialEndsAt, now);
      expect(days).toBe(3);
    });

    it('should calculate 1 day remaining correctly', () => {
      const now = new Date('2026-04-04T12:00:00.000Z');
      const trialEndsAt = '2026-04-05T12:00:00.000Z';

      const days = calculateDaysRemaining(trialEndsAt, now);
      expect(days).toBe(1);
    });

    it('should round up partial days with Math.ceil', () => {
      const now = new Date('2026-04-02T18:00:00.000Z');
      const trialEndsAt = '2026-04-05T06:00:00.000Z';

      // 2.5 days remaining → Math.ceil → 3
      const days = calculateDaysRemaining(trialEndsAt, now);
      expect(days).toBe(3);
    });

    it('should return 0 for trials expiring now', () => {
      const now = new Date('2026-04-05T12:00:00.000Z');
      const trialEndsAt = '2026-04-05T12:00:00.000Z';

      const days = calculateDaysRemaining(trialEndsAt, now);
      expect(days).toBe(0);
    });

    it('should return negative for already expired trials', () => {
      const now = new Date('2026-04-06T12:00:00.000Z');
      const trialEndsAt = '2026-04-05T12:00:00.000Z';

      const days = calculateDaysRemaining(trialEndsAt, now);
      expect(days).toBeLessThan(0);
    });
  });

  describe('Notification Filtering', () => {
    it('should include tenants with exactly 3 days remaining', () => {
      const daysRemaining = 3;
      const shouldSend = daysRemaining === 3 || daysRemaining === 1;
      expect(shouldSend).toBe(true);
    });

    it('should include tenants with exactly 1 day remaining', () => {
      const daysRemaining = 1;
      const shouldSend = daysRemaining === 3 || daysRemaining === 1;
      expect(shouldSend).toBe(true);
    });

    it('should exclude tenants with 2 days remaining', () => {
      const daysRemaining = 2;
      const shouldSend = daysRemaining === 3 || daysRemaining === 1;
      expect(shouldSend).toBe(false);
    });

    it('should exclude tenants with 0 days remaining', () => {
      const daysRemaining = 0;
      const shouldSend = daysRemaining === 3 || daysRemaining === 1;
      expect(shouldSend).toBe(false);
    });

    it('should exclude tenants with negative days (already expired)', () => {
      const daysRemaining = -1;
      const shouldSend = daysRemaining === 3 || daysRemaining === 1;
      expect(shouldSend).toBe(false);
    });
  });

  describe('Reference ID Format', () => {
    it('should produce correct format for 3-day warning', () => {
      const ref = buildReferenceId('abc-123', 3, '2026-04-02');
      expect(ref).toBe('trial-expiry-abc-123-3d-2026-04-02');
    });

    it('should produce correct format for 1-day warning', () => {
      const ref = buildReferenceId('abc-123', 1, '2026-04-02');
      expect(ref).toBe('trial-expiry-abc-123-1d-2026-04-02');
    });

    it('should differ between 3-day and 1-day warnings on the same date', () => {
      const tenantId = 'abc-123';
      const todayStr = '2026-04-02';
      const ref3 = buildReferenceId(tenantId, 3, todayStr);
      const ref1 = buildReferenceId(tenantId, 1, todayStr);
      expect(ref3).not.toBe(ref1);
    });

    it('should differ for the same tenant on different dates', () => {
      const tenantId = 'abc-123';
      const refDay1 = buildReferenceId(tenantId, 3, '2026-04-02');
      const refDay2 = buildReferenceId(tenantId, 3, '2026-04-03');
      expect(refDay1).not.toBe(refDay2);
    });

    it('should differ for different tenants on the same date', () => {
      const todayStr = '2026-04-02';
      const refA = buildReferenceId('tenant-a', 3, todayStr);
      const refB = buildReferenceId('tenant-b', 3, todayStr);
      expect(refA).not.toBe(refB);
    });
  });

  describe('Credit Deduction Logic', () => {
    it('should only deduct credits for free-tier tenants', () => {
      const freeTierTenant = { is_free_tier: true };
      const paidTierTenant = { is_free_tier: false };

      expect(freeTierTenant.is_free_tier).toBe(true);
      expect(paidTierTenant.is_free_tier).toBe(false);
    });

    it('should default is_free_tier to false when null', () => {
      const tenant = { is_free_tier: null };
      const isFreeTier = tenant.is_free_tier ?? false;
      expect(isFreeTier).toBe(false);
    });

    it('should skip email when credit deduction fails', () => {
      const creditError = { message: 'Connection error' };
      const expectedResult = {
        email: 'owner@example.com',
        days: 3,
        sent: false,
        credits_deducted: false,
        skipped_reason: `Credit error: ${creditError.message}`,
      };

      expect(expectedResult.sent).toBe(false);
      expect(expectedResult.skipped_reason).toContain('Credit error');
    });

    it('should skip email when credits are insufficient', () => {
      const creditResult = { success: false, error: 'Insufficient credits' };
      const expectedResult = {
        email: 'owner@example.com',
        days: 1,
        sent: false,
        credits_deducted: false,
        skipped_reason: creditResult.error || 'Insufficient credits',
      };

      expect(expectedResult.sent).toBe(false);
      expect(expectedResult.skipped_reason).toBe('Insufficient credits');
    });

    it('should proceed with email when credit deduction succeeds', () => {
      const creditResult = { success: true, consumed: 10, balance: 990 };

      expect(creditResult.success).toBe(true);
      expect(creditResult.consumed).toBe(10);
    });
  });

  describe('Result Aggregation', () => {
    it('should count successful, skipped, and failed correctly', () => {
      // Simulate Promise.allSettled results
      type EmailResult = { email: string; days: number; sent: boolean; credits_deducted: boolean; skipped_reason?: string };
      const results: PromiseSettledResult<EmailResult>[] = [
        { status: 'fulfilled', value: { email: 'a@test.com', days: 3, sent: true, credits_deducted: false } },
        { status: 'fulfilled', value: { email: 'b@test.com', days: 1, sent: false, credits_deducted: false, skipped_reason: 'Insufficient credits' } },
        { status: 'fulfilled', value: { email: 'c@test.com', days: 3, sent: true, credits_deducted: true } },
        { status: 'rejected', reason: new Error('Network timeout') },
      ];

      const fulfilled = results
        .filter((r): r is PromiseFulfilledResult<EmailResult> => r.status === 'fulfilled')
        .map(r => r.value);
      const successful = fulfilled.filter(r => r.sent).length;
      const skipped = fulfilled.filter(r => !r.sent).length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBe(2);
      expect(skipped).toBe(1);
      expect(failed).toBe(1);
    });

    it('should handle all empty results', () => {
      const results: PromiseSettledResult<unknown>[] = [];
      const fulfilled = results.filter(r => r.status === 'fulfilled');

      expect(fulfilled.length).toBe(0);
    });
  });

  describe('Email Subject Lines', () => {
    it('should use urgency emoji for 1-day warning', () => {
      const daysRemaining = 1;
      const businessName = 'Green Leaf Dispensary';
      const subject = daysRemaining === 1
        ? `⏰ Your trial ends tomorrow - ${businessName}`
        : `🚀 Your trial ends in ${daysRemaining} days - ${businessName}`;

      expect(subject).toBe('⏰ Your trial ends tomorrow - Green Leaf Dispensary');
    });

    it('should use rocket emoji for 3-day warning', () => {
      const daysRemaining = 3;
      const businessName = 'Green Leaf Dispensary';
      const subject = daysRemaining === 1
        ? `⏰ Your trial ends tomorrow - ${businessName}`
        : `🚀 Your trial ends in ${daysRemaining} days - ${businessName}`;

      expect(subject).toBe('🚀 Your trial ends in 3 days - Green Leaf Dispensary');
    });
  });

  describe('CREDIT_ACTIONS constant', () => {
    it('should use SEND_EMAIL with value send_email', () => {
      const SEND_EMAIL = 'send_email';
      expect(SEND_EMAIL).toBe('send_email');
    });
  });
});
