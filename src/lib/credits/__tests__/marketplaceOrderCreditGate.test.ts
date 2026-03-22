/**
 * Marketplace Order Credit Gate Tests
 *
 * Verifies that marketplace_order_created action is properly configured
 * with 100 credits and integrates with the credit consumption flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCreditCost,
  getCreditCostInfo,
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
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const TEST_TENANT_ID = 'tenant-marketplace-001';

// ============================================================================
// Tests
// ============================================================================

describe('Marketplace Order Credit Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Credit cost configuration', () => {
    it('should cost exactly 100 credits for marketplace_order_created', () => {
      const cost = getCreditCost('marketplace_order_created');
      expect(cost).toBe(100);
    });

    it('should have correct cost info metadata', () => {
      const info = getCreditCostInfo('marketplace_order_created');
      expect(info).not.toBeNull();
      expect(info?.credits).toBe(100);
      expect(info?.actionKey).toBe('marketplace_order_created');
      expect(info?.actionName).toBe('Marketplace Order Received');
      expect(info?.category).toBe('marketplace');
    });
  });

  describe('Credit consumption for marketplace orders', () => {
    it('should consume 100 credits when marketplace order is created', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: 100,
          balance: 900,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'marketplace_order_created',
        'marketplace-order-001',
        'Marketplace order placed'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(100);
      expect(result.newBalance).toBe(900);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
        p_tenant_id: TEST_TENANT_ID,
        p_amount: 100,
        p_action_key: 'marketplace_order_created',
        p_description: 'Marketplace order placed',
        p_reference_id: 'marketplace-order-001',
        p_metadata: {},
      });
    });

    it('should block marketplace order when insufficient credits', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient credits: need 100, have 50',
          consumed: 0,
          balance: 50,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'marketplace_order_created',
        'marketplace-order-blocked'
      );

      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(50);
    });
  });

  describe('Pre-flight credit check for marketplace orders', () => {
    it('should detect sufficient credits for marketplace order', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { balance: 500, lifetime_earned: 1000, lifetime_spent: 500, is_free_tier: true, next_free_grant_at: null },
          error: null,
        });

      const result = await checkCredits(TEST_TENANT_ID, 'marketplace_order_created');

      expect(result.hasCredits).toBe(true);
      expect(result.cost).toBe(100);
      expect(result.wouldRemain).toBe(400);
    });

    it('should detect insufficient credits for marketplace order', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({
          data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { balance: 50, lifetime_earned: 200, lifetime_spent: 150, is_free_tier: true, next_free_grant_at: null },
          error: null,
        });

      const result = await checkCredits(TEST_TENANT_ID, 'marketplace_order_created');

      expect(result.hasCredits).toBe(false);
      expect(result.cost).toBe(100);
      expect(result.wouldRemain).toBe(-50);
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

      const result = await checkCredits(TEST_TENANT_ID, 'marketplace_order_created');

      expect(result.hasCredits).toBe(true);
      expect(result.isFreeTier).toBe(false);
    });
  });
});
