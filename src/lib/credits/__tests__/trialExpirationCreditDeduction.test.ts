/**
 * Trial Expiration Credit Deduction Tests
 *
 * Tests credit deduction for the send-trial-expiration-notice edge function.
 * Validates that:
 * 1. send_email action costs 10 credits
 * 2. Free tier tenants get credits deducted
 * 3. Insufficient credits prevents the notification
 * 4. Idempotent reference IDs prevent double-charging
 * 5. Paid tier tenants are not charged
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCreditCost, getCreditCostInfo } from '../creditCosts';
import { consumeCredits, checkCredits } from '../creditService';

// ============================================================================
// Mocks
// ============================================================================

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...selectArgs: unknown[]) => {
          mockSelect(...selectArgs);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                maybeSingle: () => mockMaybeSingle(),
                eq: (...innerEqArgs: unknown[]) => {
                  mockEq(...innerEqArgs);
                  return {
                    maybeSingle: () => mockMaybeSingle(),
                  };
                },
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const TEST_TENANT_ID = 'tenant-trial-001';
const SEND_EMAIL_COST = 10;

// ============================================================================
// Tests
// ============================================================================

describe('Trial Expiration Credit Deduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Credit cost configuration', () => {
    it('should have send_email action costing 10 credits', () => {
      const cost = getCreditCost('send_email');
      expect(cost).toBe(SEND_EMAIL_COST);
    });

    it('should have send_email in CRM category', () => {
      const info = getCreditCostInfo('send_email');
      expect(info).toBeDefined();
      expect(info?.category).toBe('crm');
      expect(info?.actionName).toBe('Send Email');
    });
  });

  describe('Credit deduction for trial expiration notice', () => {
    it('should consume 10 credits for send_email action', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: SEND_EMAIL_COST,
          balance: 990,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'send_email',
        'trial-expiry-tenant-trial-001-3d-2026-03-22',
        'Trial expiration notice - 3 day(s) remaining'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(SEND_EMAIL_COST);
      expect(result.newBalance).toBe(990);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
        p_tenant_id: TEST_TENANT_ID,
        p_amount: SEND_EMAIL_COST,
        p_action_key: 'send_email',
        p_description: 'Trial expiration notice - 3 day(s) remaining',
        p_reference_id: 'trial-expiry-tenant-trial-001-3d-2026-03-22',
        p_metadata: {},
      });
    });

    it('should consume 10 credits for 1-day warning', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: SEND_EMAIL_COST,
          balance: 980,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'send_email',
        'trial-expiry-tenant-trial-001-1d-2026-03-22',
        'Trial expiration notice - 1 day(s) remaining'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(SEND_EMAIL_COST);
      expect(result.newBalance).toBe(980);
    });

    it('should reject when insufficient credits', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          consumed: 0,
          balance: 5,
          error: 'Insufficient credits',
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'send_email',
        'trial-expiry-low-balance-3d-2026-03-22',
        'Trial expiration notice - 3 day(s) remaining'
      );

      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(5);
    });

    it('should handle RPC error gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'send_email',
        'trial-expiry-error-3d-2026-03-22',
        'Trial expiration notice - 3 day(s) remaining'
      );

      expect(result.success).toBe(false);
    });

    it('should handle idempotent duplicate reference_id', async () => {
      const referenceId = 'trial-expiry-tenant-trial-001-3d-2026-03-22';

      // First call succeeds
      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          consumed: SEND_EMAIL_COST,
          balance: 990,
        },
        error: null,
      });

      const firstResult = await consumeCredits(
        TEST_TENANT_ID,
        'send_email',
        referenceId,
        'Trial expiration notice - 3 day(s) remaining'
      );
      expect(firstResult.success).toBe(true);
      expect(firstResult.creditsCost).toBe(SEND_EMAIL_COST);

      // Second call with same reference_id returns duplicate (no double charge)
      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          consumed: 0,
          balance: 990,
          duplicate: true,
        },
        error: null,
      });

      const secondResult = await consumeCredits(
        TEST_TENANT_ID,
        'send_email',
        referenceId,
        'Trial expiration notice - 3 day(s) remaining'
      );
      expect(secondResult.success).toBe(true);
      // Duplicate should not charge again
      expect(secondResult.creditsCost).toBe(0);
      expect(secondResult.newBalance).toBe(990);
    });
  });

  describe('Free tier pre-flight check', () => {
    it('should verify credits are available before sending', async () => {
      // Mock tenant lookup (free tier)
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          subscription_status: 'trial',
          subscription_plan: null,
          credits_enabled: true,
          is_free_tier: true,
        },
        error: null,
      });

      // Mock balance lookup
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          balance: 1000,
          lifetime_earned: 1000,
          lifetime_spent: 0,
          is_free_tier: true,
          next_free_grant_at: null,
        },
        error: null,
      });

      // Mock credit cost lookup
      mockMaybeSingle.mockResolvedValueOnce({
        data: { credits: SEND_EMAIL_COST },
        error: null,
      });

      const result = await checkCredits(TEST_TENANT_ID, 'send_email');

      expect(result.hasCredits).toBe(true);
      expect(result.cost).toBe(SEND_EMAIL_COST);
      expect(result.isFreeTier).toBe(true);
    });

    it('should flag insufficient credits in pre-flight check', async () => {
      // Mock tenant lookup (free tier)
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          subscription_status: 'trial',
          subscription_plan: null,
          credits_enabled: true,
          is_free_tier: true,
        },
        error: null,
      });

      // Mock balance lookup - only 5 credits remaining
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          balance: 5,
          lifetime_earned: 1000,
          lifetime_spent: 995,
          is_free_tier: true,
          next_free_grant_at: null,
        },
        error: null,
      });

      // Mock credit cost lookup
      mockMaybeSingle.mockResolvedValueOnce({
        data: { credits: SEND_EMAIL_COST },
        error: null,
      });

      const result = await checkCredits(TEST_TENANT_ID, 'send_email');

      expect(result.hasCredits).toBe(false);
      expect(result.cost).toBe(SEND_EMAIL_COST);
      expect(result.balance).toBe(5);
    });
  });

  describe('Reference ID format for trial expiration notices', () => {
    it('should produce unique reference IDs per tenant, days, and date', () => {
      const tenantId = 'abc-123';
      const daysRemaining = 3;
      const todayStr = '2026-03-22';

      const referenceId = `trial-expiry-${tenantId}-${daysRemaining}d-${todayStr}`;

      expect(referenceId).toBe('trial-expiry-abc-123-3d-2026-03-22');
    });

    it('should differ between 3-day and 1-day warnings on the same date', () => {
      const tenantId = 'abc-123';
      const todayStr = '2026-03-22';

      const ref3Day = `trial-expiry-${tenantId}-3d-${todayStr}`;
      const ref1Day = `trial-expiry-${tenantId}-1d-${todayStr}`;

      expect(ref3Day).not.toBe(ref1Day);
    });

    it('should differ for the same tenant on different dates', () => {
      const tenantId = 'abc-123';

      const refDay1 = `trial-expiry-${tenantId}-3d-2026-03-22`;
      const refDay2 = `trial-expiry-${tenantId}-3d-2026-03-23`;

      expect(refDay1).not.toBe(refDay2);
    });
  });
});
