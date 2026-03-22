/**
 * Purchase Order Send Credit Tests
 *
 * Verifies that the purchase_order_send action:
 * 1. Has correct credit cost (25 credits)
 * 2. Has proper metadata in the credit costs config
 * 3. Consumes credits correctly through the credit service
 * 4. Blocks when insufficient credits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCreditCost,
  getCreditCostInfo,
  getCreditCostsByCategory,
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
// Constants
// ============================================================================

const TEST_TENANT_ID = 'tenant-po-send-001';
const ACTION_KEY = 'purchase_order_send';
const EXPECTED_COST = 25;

// ============================================================================
// Tests
// ============================================================================

describe('purchase_order_send credit configuration', () => {
  it('should cost exactly 25 credits', () => {
    expect(getCreditCost(ACTION_KEY)).toBe(EXPECTED_COST);
  });

  it('should have complete credit cost info', () => {
    const info = getCreditCostInfo(ACTION_KEY);
    expect(info).not.toBeNull();
    expect(info?.actionKey).toBe('purchase_order_send');
    expect(info?.actionName).toBe('Send Purchase Order');
    expect(info?.credits).toBe(25);
    expect(info?.category).toBe('operations');
    expect(info?.description).toBe('Send purchase order (communication)');
  });

  it('should be in the operations category', () => {
    const operationsActions = getCreditCostsByCategory('operations');
    const poSend = operationsActions.find(
      (a) => a.actionKey === ACTION_KEY,
    );
    expect(poSend).toBeDefined();
    expect(poSend?.credits).toBe(25);
  });

  it('should cost same as other communication actions (send_sms)', () => {
    const smsCost = getCreditCost('send_sms');
    const poSendCost = getCreditCost(ACTION_KEY);
    expect(poSendCost).toBe(smsCost);
  });
});

describe('purchase_order_send credit consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should consume 25 credits when sending a PO', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        consumed: EXPECTED_COST,
        balance: 975,
      },
      error: null,
    });

    const result = await consumeCredits(
      TEST_TENANT_ID,
      ACTION_KEY,
      'po-ref-001',
      'Send purchase order to supplier',
    );

    expect(result.success).toBe(true);
    expect(result.creditsCost).toBe(EXPECTED_COST);
    expect(result.newBalance).toBe(975);
    expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
      p_tenant_id: TEST_TENANT_ID,
      p_amount: EXPECTED_COST,
      p_action_key: ACTION_KEY,
      p_description: 'Send purchase order to supplier',
      p_reference_id: 'po-ref-001',
      p_metadata: {},
    });
  });

  it('should block when insufficient credits for PO send', async () => {
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
      ACTION_KEY,
      'po-ref-blocked',
    );

    expect(result.success).toBe(false);
    expect(result.newBalance).toBe(10);
  });

  it('should handle RPC error gracefully', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const result = await consumeCredits(
      TEST_TENANT_ID,
      ACTION_KEY,
      'po-ref-error',
    );

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Database connection failed');
  });
});

describe('purchase_order_send credit check (pre-flight)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should confirm credits available when balance is sufficient', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 100, lifetime_earned: 500, lifetime_spent: 400, is_free_tier: true, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, ACTION_KEY);

    expect(result.hasCredits).toBe(true);
    expect(result.cost).toBe(EXPECTED_COST);
    expect(result.wouldRemain).toBe(75); // 100 - 25
  });

  it('should block when balance is below PO send cost', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 20, lifetime_earned: 500, lifetime_spent: 480, is_free_tier: true, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, ACTION_KEY);

    expect(result.hasCredits).toBe(false);
    expect(result.balance).toBe(20);
    expect(result.cost).toBe(EXPECTED_COST);
    expect(result.wouldRemain).toBe(-5); // 20 - 25
  });

  it('should allow PO send when balance exactly equals cost', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 25, lifetime_earned: 500, lifetime_spent: 475, is_free_tier: true, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, ACTION_KEY);

    expect(result.hasCredits).toBe(true);
    expect(result.wouldRemain).toBe(0);
  });

  it('should bypass credits for paid tier users', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'active', is_free_tier: false, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 0, lifetime_earned: 0, lifetime_spent: 0, is_free_tier: false, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, ACTION_KEY);

    expect(result.hasCredits).toBe(true);
    expect(result.isFreeTier).toBe(false);
  });
});
