/**
 * Menu OCR Credit Check Verification Tests
 *
 * Verifies that the menu_ocr action is correctly configured
 * with 250 credits in the credit system. This test validates:
 * 1. The action key exists in CREDIT_COSTS
 * 2. The cost is exactly 250 credits
 * 3. The action is categorized under 'ai'
 * 4. The credit check/consumption flow works for menu_ocr
 * 5. Insufficient credits are correctly detected for 250-credit actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCreditCost,
  getCreditCostInfo,
  getCreditCostsByCategory,
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
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const TEST_TENANT_ID = 'tenant-menu-ocr-001';
const MENU_OCR_ACTION_KEY = 'menu_ocr';
const EXPECTED_MENU_OCR_COST = 250;

// ============================================================================
// 1. Credit Cost Configuration
// ============================================================================

describe('Menu OCR Credit Cost Configuration', () => {
  it('should have menu_ocr action defined in CREDIT_COSTS', () => {
    expect(CREDIT_COSTS[MENU_OCR_ACTION_KEY]).toBeDefined();
  });

  it('should cost exactly 250 credits', () => {
    const cost = getCreditCost(MENU_OCR_ACTION_KEY);
    expect(cost).toBe(EXPECTED_MENU_OCR_COST);
  });

  it('should have correct action metadata', () => {
    const info = getCreditCostInfo(MENU_OCR_ACTION_KEY);
    expect(info).not.toBeNull();
    expect(info?.actionKey).toBe('menu_ocr');
    expect(info?.actionName).toBe('Menu OCR Scan');
    expect(info?.credits).toBe(250);
    expect(info?.category).toBe('ai');
    expect(info?.description).toBe('AI-powered menu scanning');
  });

  it('should be categorized as an AI feature', () => {
    const aiActions = getCreditCostsByCategory('ai');
    const menuOcr = aiActions.find(a => a.actionKey === MENU_OCR_ACTION_KEY);
    expect(menuOcr).toBeDefined();
    expect(menuOcr?.credits).toBe(EXPECTED_MENU_OCR_COST);
  });

  it('should not be a free action', () => {
    const cost = getCreditCost(MENU_OCR_ACTION_KEY);
    expect(cost).toBeGreaterThan(0);
  });

  it('should be the most expensive menu-related action', () => {
    const menuCreate = getCreditCost('menu_create');
    const menuOcr = getCreditCost(MENU_OCR_ACTION_KEY);
    expect(menuOcr).toBeGreaterThan(menuCreate);
  });
});

// ============================================================================
// 2. Credit Check Flow for menu_ocr
// ============================================================================

describe('Menu OCR Credit Check Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow menu_ocr when balance is sufficient (>= 250)', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 500, lifetime_earned: 1000, lifetime_spent: 500, is_free_tier: true, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, MENU_OCR_ACTION_KEY);

    expect(result.hasCredits).toBe(true);
    expect(result.cost).toBe(250);
    expect(result.wouldRemain).toBe(250); // 500 - 250
    expect(result.isFreeTier).toBe(true);
  });

  it('should allow menu_ocr when balance exactly equals cost (250)', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 250, lifetime_earned: 500, lifetime_spent: 250, is_free_tier: true, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, MENU_OCR_ACTION_KEY);

    expect(result.hasCredits).toBe(true);
    expect(result.cost).toBe(250);
    expect(result.wouldRemain).toBe(0);
  });

  it('should block menu_ocr when balance is insufficient (< 250)', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 100, lifetime_earned: 500, lifetime_spent: 400, is_free_tier: true, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, MENU_OCR_ACTION_KEY);

    expect(result.hasCredits).toBe(false);
    expect(result.cost).toBe(250);
    expect(result.balance).toBe(100);
    expect(result.wouldRemain).toBe(-150); // 100 - 250
  });

  it('should block menu_ocr when balance is zero', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'free', is_free_tier: true, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 0, lifetime_earned: 500, lifetime_spent: 500, is_free_tier: true, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, MENU_OCR_ACTION_KEY);

    expect(result.hasCredits).toBe(false);
    expect(result.cost).toBe(250);
    expect(result.wouldRemain).toBe(-250);
  });

  it('should allow menu_ocr for paid tier users regardless of balance', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: { subscription_status: 'active', is_free_tier: false, credits_enabled: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { balance: 0, lifetime_earned: 0, lifetime_spent: 0, is_free_tier: false, next_free_grant_at: null },
        error: null,
      });

    const result = await checkCredits(TEST_TENANT_ID, MENU_OCR_ACTION_KEY);

    expect(result.hasCredits).toBe(true);
    expect(result.isFreeTier).toBe(false);
  });
});

// ============================================================================
// 3. Credit Consumption for menu_ocr
// ============================================================================

describe('Menu OCR Credit Consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should consume exactly 250 credits for menu_ocr', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        consumed: 250,
        balance: 750,
      },
      error: null,
    });

    const result = await consumeCredits(
      TEST_TENANT_ID,
      MENU_OCR_ACTION_KEY,
      'ocr-scan-001',
      'OCR scan - extracted 15 products'
    );

    expect(result.success).toBe(true);
    expect(result.creditsCost).toBe(250);
    expect(result.newBalance).toBe(750);
    expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
      p_tenant_id: TEST_TENANT_ID,
      p_amount: 250,
      p_action_key: MENU_OCR_ACTION_KEY,
      p_description: 'OCR scan - extracted 15 products',
      p_reference_id: 'ocr-scan-001',
      p_metadata: {},
    });
  });

  it('should reject consumption when server reports insufficient credits', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'Insufficient credits: need 250, have 100',
        consumed: 0,
        balance: 100,
      },
      error: null,
    });

    const result = await consumeCredits(
      TEST_TENANT_ID,
      MENU_OCR_ACTION_KEY,
      'ocr-scan-blocked'
    );

    expect(result.success).toBe(false);
    expect(result.newBalance).toBe(100);
  });

  it('should handle RPC errors during menu_ocr consumption', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const result = await consumeCredits(
      TEST_TENANT_ID,
      MENU_OCR_ACTION_KEY,
      'ocr-scan-error'
    );

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Database connection failed');
  });
});
