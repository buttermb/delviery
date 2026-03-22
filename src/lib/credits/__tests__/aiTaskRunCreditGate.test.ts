/**
 * AI Task Run Credit Gate Tests
 *
 * Verifies that the ai_task_run action key (used by generate-product-images)
 * is properly configured with 50 credits and works through the credit system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
// Constants
// ============================================================================

const TEST_TENANT_ID = 'tenant-ai-test-001';
const AI_TASK_RUN_KEY = 'ai_task_run';
const AI_TASK_RUN_COST = 50;

// ============================================================================
// Tests
// ============================================================================

describe('ai_task_run credit action configuration', () => {
  it('should cost exactly 50 credits', () => {
    expect(getCreditCost(AI_TASK_RUN_KEY)).toBe(AI_TASK_RUN_COST);
  });

  it('should have correct cost info', () => {
    const info = getCreditCostInfo(AI_TASK_RUN_KEY);
    expect(info).not.toBeNull();
    expect(info?.credits).toBe(50);
    expect(info?.actionName).toBe('Run AI Task');
    expect(info?.category).toBe('ai');
  });

  it('should be a non-zero cost action', () => {
    expect(getCreditCost(AI_TASK_RUN_KEY)).toBeGreaterThan(0);
  });
});

describe('ai_task_run credit consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should consume 50 credits for AI image generation', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        consumed: 50,
        balance: 950,
      },
      error: null,
    });

    const result = await consumeCredits(
      TEST_TENANT_ID,
      AI_TASK_RUN_KEY,
      'product-img-001',
      'AI product image generation'
    );

    expect(result.success).toBe(true);
    expect(result.creditsCost).toBe(50);
    expect(result.newBalance).toBe(950);
    expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
      p_tenant_id: TEST_TENANT_ID,
      p_amount: 50,
      p_action_key: AI_TASK_RUN_KEY,
      p_description: 'AI product image generation',
      p_reference_id: 'product-img-001',
      p_metadata: {},
    });
  });

  it('should block when insufficient credits for AI task', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'Insufficient credits: need 50, have 30',
        consumed: 0,
        balance: 30,
      },
      error: null,
    });

    const result = await consumeCredits(
      TEST_TENANT_ID,
      AI_TASK_RUN_KEY,
      'product-img-blocked'
    );

    expect(result.success).toBe(false);
    expect(result.newBalance).toBe(30);
  });

  it('should detect insufficient credits via checkCredits', async () => {
    const tenantCall = {
      data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
      error: null,
    };
    const creditCall = {
      data: { balance: 30, lifetime_earned: 500, lifetime_spent: 470, is_free_tier: true, next_free_grant_at: null },
      error: null,
    };

    mockMaybeSingle
      .mockResolvedValueOnce(tenantCall)
      .mockResolvedValueOnce(creditCall);

    const result = await checkCredits(TEST_TENANT_ID, AI_TASK_RUN_KEY);

    expect(result.hasCredits).toBe(false);
    expect(result.balance).toBe(30);
    expect(result.cost).toBe(50);
    expect(result.wouldRemain).toBe(-20);
  });

  it('should allow AI task when balance exactly equals cost', async () => {
    const tenantCall = {
      data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
      error: null,
    };
    const creditCall = {
      data: { balance: 50, lifetime_earned: 500, lifetime_spent: 450, is_free_tier: true, next_free_grant_at: null },
      error: null,
    };

    mockMaybeSingle
      .mockResolvedValueOnce(tenantCall)
      .mockResolvedValueOnce(creditCall);

    const result = await checkCredits(TEST_TENANT_ID, AI_TASK_RUN_KEY);

    expect(result.hasCredits).toBe(true);
    expect(result.wouldRemain).toBe(0);
  });

  it('should bypass credit check for paid tier tenants', async () => {
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

    const result = await checkCredits(TEST_TENANT_ID, AI_TASK_RUN_KEY);

    expect(result.hasCredits).toBe(true);
    expect(result.isFreeTier).toBe(false);
  });
});
