/**
 * Notify Order Ready — Credit Gate Integration Tests
 *
 * Validates that the notify-order-ready edge function correctly uses
 * the send_sms action key (25 credits) for credit gating.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCreditCost, getCreditCostInfo } from '../creditCosts';
import { consumeCredits, checkCredits } from '../creditService';

// ============================================================================
// Mocks
// ============================================================================

const mockRpc = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockMaybeSingle(),
          eq: () => ({
            maybeSingle: () => mockMaybeSingle(),
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

const TEST_TENANT_ID = 'tenant-notify-ready-001';
const SEND_SMS_ACTION_KEY = 'send_sms';
const EXPECTED_SMS_COST = 25;

// ============================================================================
// Tests
// ============================================================================

describe('Notify Order Ready — Credit Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Action key and cost configuration', () => {
    it('should use send_sms action key with cost of 25 credits', () => {
      const cost = getCreditCost(SEND_SMS_ACTION_KEY);
      expect(cost).toBe(EXPECTED_SMS_COST);
    });

    it('should have correct cost info for send_sms', () => {
      const info = getCreditCostInfo(SEND_SMS_ACTION_KEY);
      expect(info).not.toBeNull();
      expect(info?.credits).toBe(25);
      expect(info?.actionKey).toBe('send_sms');
      expect(info?.actionName).toBe('Send SMS');
    });

    it('should categorize send_sms under crm', () => {
      const info = getCreditCostInfo(SEND_SMS_ACTION_KEY);
      expect(info?.category).toBe('crm');
    });
  });

  describe('Credit consumption for order ready notification', () => {
    it('should consume 25 credits when sending order ready SMS', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: EXPECTED_SMS_COST,
          balance: 475,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SEND_SMS_ACTION_KEY,
        'order-ready-001',
        'Order ready SMS notification',
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(EXPECTED_SMS_COST);
      expect(result.newBalance).toBe(475);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_tenant_id: TEST_TENANT_ID,
        p_action_key: SEND_SMS_ACTION_KEY,
        p_amount: EXPECTED_SMS_COST,
        p_reference_id: 'order-ready-001',
        p_description: 'Order ready SMS notification',
      }));
    });

    it('should block notification when insufficient credits', async () => {
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
        SEND_SMS_ACTION_KEY,
        'order-ready-blocked',
        'Order ready SMS notification',
      );

      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(10);
    });

    it('should handle RPC errors gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database unavailable' },
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SEND_SMS_ACTION_KEY,
        'order-ready-error',
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Database unavailable');
    });
  });

  describe('Pre-flight credit check for SMS notification', () => {
    it('should allow SMS when balance is sufficient', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { balance: 500, lifetime_earned: 1000, lifetime_spent: 500, is_free_tier: true, next_free_grant_at: null },
          error: null,
        });

      const result = await checkCredits(TEST_TENANT_ID, SEND_SMS_ACTION_KEY);

      expect(result.hasCredits).toBe(true);
      expect(result.cost).toBe(EXPECTED_SMS_COST);
      expect(result.wouldRemain).toBe(475); // 500 - 25
    });

    it('should block SMS when balance is below cost', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { balance: 20, lifetime_earned: 500, lifetime_spent: 480, is_free_tier: true, next_free_grant_at: null },
          error: null,
        });

      const result = await checkCredits(TEST_TENANT_ID, SEND_SMS_ACTION_KEY);

      expect(result.hasCredits).toBe(false);
      expect(result.cost).toBe(EXPECTED_SMS_COST);
      expect(result.wouldRemain).toBe(-5); // 20 - 25
    });

    it('should bypass credit check for paid tier tenants', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { subscription_status: 'active', is_free_tier: false, credits_enabled: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { balance: 0, lifetime_earned: 0, lifetime_spent: 0, is_free_tier: false, next_free_grant_at: null },
          error: null,
        });

      const result = await checkCredits(TEST_TENANT_ID, SEND_SMS_ACTION_KEY);

      expect(result.hasCredits).toBe(true);
      expect(result.isFreeTier).toBe(false);
    });
  });
});
