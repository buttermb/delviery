/**
 * Send SMS Credit Deduction Tests
 *
 * Validates the credit deduction contract for SMS verification:
 * - send_sms action_key costs 25 credits
 * - Credit consumption works for send_sms action
 * - Best-effort pattern: credit failures don't block SMS delivery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCreditCost, getCreditCostInfo } from '../creditCosts';
import { consumeCredits } from '../creditService';

// ============================================================================
// Mocks
// ============================================================================

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: null, error: null }),
          eq: () => ({
            maybeSingle: () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
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
// Constants
// ============================================================================

const TEST_TENANT_ID = 'tenant-sms-test-001';
const SMS_ACTION_KEY = 'send_sms';
const SMS_CREDIT_COST = 25;

// ============================================================================
// Tests
// ============================================================================

describe('Send SMS Credit Deduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Credit cost configuration', () => {
    it('should define send_sms action with 25 credits', () => {
      const cost = getCreditCost(SMS_ACTION_KEY);
      expect(cost).toBe(SMS_CREDIT_COST);
    });

    it('should return correct cost info for send_sms', () => {
      const info = getCreditCostInfo(SMS_ACTION_KEY);
      expect(info).not.toBeNull();
      expect(info?.actionKey).toBe('send_sms');
      expect(info?.actionName).toBe('Send SMS');
      expect(info?.credits).toBe(25);
      expect(info?.category).toBe('crm');
    });
  });

  describe('Credit consumption for SMS verification', () => {
    it('should consume 25 credits for send_sms action', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 25, balance: 475 },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SMS_ACTION_KEY,
        'verification-001',
        'SMS verification code'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(25);
      expect(result.newBalance).toBe(475);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
        p_tenant_id: TEST_TENANT_ID,
        p_amount: 25,
        p_action_key: 'send_sms',
        p_description: 'SMS verification code',
        p_reference_id: 'verification-001',
        p_metadata: {},
      });
    });

    it('should include phone_verification metadata when provided', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 25, balance: 975 },
        error: null,
      });

      await consumeCredits(
        TEST_TENANT_ID,
        SMS_ACTION_KEY,
        'verification-002',
        'SMS verification code',
        { type: 'phone_verification' }
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_action_key: 'send_sms',
        p_metadata: { type: 'phone_verification' },
        p_reference_id: 'verification-002',
      }));
    });

    it('should handle insufficient credits gracefully (best-effort pattern)', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient credits: need 25, have 10',
          consumed: 0,
          balance: 10,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SMS_ACTION_KEY,
        'verification-003',
        'SMS verification code'
      );

      // Credit failure should return gracefully, not throw
      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(10);
    });

    it('should handle RPC errors gracefully (best-effort pattern)', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SMS_ACTION_KEY,
        'verification-004',
        'SMS verification code'
      );

      // Should return error result, not throw
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Database connection failed');
    });

    it('should handle network exceptions gracefully (best-effort pattern)', async () => {
      mockRpc.mockRejectedValue(new Error('Network timeout'));

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SMS_ACTION_KEY,
        'verification-005',
        'SMS verification code'
      );

      // Should catch and return error, not throw
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network timeout');
    });
  });
});
