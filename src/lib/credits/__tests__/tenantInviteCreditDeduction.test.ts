/**
 * Tenant Invite Credit Deduction Tests
 *
 * Verifies that tenant invitation (send_email action) correctly:
 * 1. Costs 10 credits as defined in creditCosts
 * 2. Pre-flight check blocks when insufficient credits
 * 3. Credits consumed on successful invitation
 * 4. Paid tier tenants bypass credit deduction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCreditCost,
  getCreditCostInfo,
  CREDIT_COSTS,
} from '../creditCosts';
import {
  consumeCredits,
  checkCredits,
} from '../creditService';

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
    debug: vi.fn(),
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const TEST_TENANT_ID = 'tenant-invite-test-001';
const SEND_EMAIL_ACTION = 'send_email';
const SEND_EMAIL_COST = 10;

// ============================================================================
// Tests
// ============================================================================

describe('Tenant Invite Credit Deduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('send_email action configuration', () => {
    it('should have send_email defined in credit costs with 10 credits', () => {
      const cost = getCreditCost(SEND_EMAIL_ACTION);
      expect(cost).toBe(SEND_EMAIL_COST);
    });

    it('should have correct metadata for send_email action', () => {
      const info = getCreditCostInfo(SEND_EMAIL_ACTION);
      expect(info).not.toBeNull();
      expect(info?.actionKey).toBe('send_email');
      expect(info?.actionName).toBe('Send Email');
      expect(info?.credits).toBe(10);
      expect(info?.category).toBe('crm');
    });

    it('should exist in the CREDIT_COSTS record', () => {
      expect(CREDIT_COSTS[SEND_EMAIL_ACTION]).toBeDefined();
      expect(CREDIT_COSTS[SEND_EMAIL_ACTION].credits).toBe(10);
    });
  });

  describe('pre-flight credit check for invitations', () => {
    it('should allow invitation when free tier has sufficient credits', async () => {
      const tenantCall = {
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      };
      const creditCall = {
        data: { balance: 500, lifetime_earned: 500, lifetime_spent: 0, is_free_tier: true, next_free_grant_at: null },
        error: null,
      };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const result = await checkCredits(TEST_TENANT_ID, SEND_EMAIL_ACTION);

      expect(result.hasCredits).toBe(true);
      expect(result.cost).toBe(SEND_EMAIL_COST);
      expect(result.balance).toBe(500);
      expect(result.wouldRemain).toBe(490); // 500 - 10
    });

    it('should block invitation when free tier has insufficient credits', async () => {
      const tenantCall = {
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      };
      const creditCall = {
        data: { balance: 5, lifetime_earned: 500, lifetime_spent: 495, is_free_tier: true, next_free_grant_at: null },
        error: null,
      };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const result = await checkCredits(TEST_TENANT_ID, SEND_EMAIL_ACTION);

      expect(result.hasCredits).toBe(false);
      expect(result.cost).toBe(SEND_EMAIL_COST);
      expect(result.balance).toBe(5);
      expect(result.wouldRemain).toBe(-5); // 5 - 10
    });

    it('should allow invitation when balance exactly equals cost', async () => {
      const tenantCall = {
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      };
      const creditCall = {
        data: { balance: 10, lifetime_earned: 500, lifetime_spent: 490, is_free_tier: true, next_free_grant_at: null },
        error: null,
      };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const result = await checkCredits(TEST_TENANT_ID, SEND_EMAIL_ACTION);

      expect(result.hasCredits).toBe(true);
      expect(result.wouldRemain).toBe(0);
    });

    it('should always allow invitation for paid tier tenants', async () => {
      const tenantCall = {
        data: { subscription_status: 'active', is_free_tier: false, credits_enabled: true },
        error: null,
      };
      const creditCall = {
        data: { balance: 0, lifetime_earned: 0, lifetime_spent: 0, is_free_tier: false, next_free_grant_at: null },
        error: null,
      };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const result = await checkCredits(TEST_TENANT_ID, SEND_EMAIL_ACTION);

      expect(result.hasCredits).toBe(true);
      expect(result.isFreeTier).toBe(false);
    });
  });

  describe('credit consumption for invitation email', () => {
    it('should consume 10 credits for send_email on successful invitation', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: SEND_EMAIL_COST,
          balance: 490,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SEND_EMAIL_ACTION,
        'invitation-uuid-001',
        'Invitation email sent to user@example.com'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(SEND_EMAIL_COST);
      expect(result.newBalance).toBe(490);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_tenant_id: TEST_TENANT_ID,
        p_action_key: SEND_EMAIL_ACTION,
        p_reference_id: 'invitation-uuid-001',
        p_description: 'Invitation email sent to user@example.com',
      }));
    });

    it('should include invitation reference in credit transaction', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 10, balance: 490 },
        error: null,
      });

      await consumeCredits(
        TEST_TENANT_ID,
        SEND_EMAIL_ACTION,
        'inv-ref-123',
        'Invitation email sent to team@example.com'
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_reference_id: 'inv-ref-123',
        p_description: 'Invitation email sent to team@example.com',
      }));
    });

    it('should handle consumption failure gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient credits',
          consumed: 0,
          balance: 5,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SEND_EMAIL_ACTION,
        'failed-invite-001'
      );

      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(5);
    });

    it('should handle RPC error during consumption', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' },
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        SEND_EMAIL_ACTION,
        'timeout-invite-001'
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Connection timeout');
    });
  });

  describe('edge function integration pattern', () => {
    it('should use correct action key constant (send_email)', () => {
      // Verify the action key matches what the edge function uses
      // CREDIT_ACTIONS.SEND_EMAIL = 'send_email' in creditGate.ts
      const actionKey = 'send_email';
      expect(getCreditCost(actionKey)).toBe(10);
    });

    it('should deduct exactly 10 credits for each invitation sent', async () => {
      // Simulate 3 invitations
      const invitations = [
        { email: 'user1@example.com', refId: 'inv-1' },
        { email: 'user2@example.com', refId: 'inv-2' },
        { email: 'user3@example.com', refId: 'inv-3' },
      ];

      let balance = 500;
      for (const inv of invitations) {
        balance -= SEND_EMAIL_COST;
        mockRpc.mockResolvedValueOnce({
          data: { success: true, consumed: SEND_EMAIL_COST, balance },
          error: null,
        });

        const result = await consumeCredits(
          TEST_TENANT_ID,
          SEND_EMAIL_ACTION,
          inv.refId,
          `Invitation email sent to ${inv.email}`
        );

        expect(result.success).toBe(true);
        expect(result.creditsCost).toBe(SEND_EMAIL_COST);
      }

      // Total deducted: 3 × 10 = 30 credits
      expect(balance).toBe(470);
      expect(mockRpc).toHaveBeenCalledTimes(3);
    });
  });
});
