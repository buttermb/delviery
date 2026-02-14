/**
 * Credit Consumption Flow Tests
 *
 * Tests the complete credit consumption lifecycle:
 * 1. Feature requiring credits triggers consumption
 * 2. Balance is decremented correctly
 * 3. Transaction is logged with reference
 * 4. Insufficient credits shows modal with purchase options
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCreditCost,
  getCreditCostInfo,
  CREDIT_PACKAGES,
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

const TEST_TENANT_ID = 'tenant-test-001';

const mockBalanceData = {
  balance: 1000,
  lifetime_earned: 2000,
  lifetime_spent: 1000,
  is_free_tier: true,
  next_free_grant_at: '2026-02-01T00:00:00Z',
};

const mockTenantData = {
  subscription_status: 'free',
  is_free_tier: true,
  credits_enabled: true,
};

// ============================================================================
// 1. Credit Consumption Flow - Feature Requiring Credits
// ============================================================================

describe('Credit Consumption Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Feature requiring credits triggers consumption', () => {
    it('should consume credits for menu_create action (100 credits)', async () => {
      const expectedCost = getCreditCost('menu_create');
      expect(expectedCost).toBe(100);

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
        'menu_create',
        'menu-ref-001',
        'Create disposable menu'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(100);
      expect(result.newBalance).toBe(900);
      expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
        p_tenant_id: TEST_TENANT_ID,
        p_amount: 100,
        p_action_key: 'menu_create',
        p_description: 'Create disposable menu',
        p_reference_id: 'menu-ref-001',
        p_metadata: {},
      });
    });

    it('should consume credits for order_create_manual action (50 credits)', async () => {
      const expectedCost = getCreditCost('order_create_manual');
      expect(expectedCost).toBe(50);

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
        'order_create_manual',
        'order-ref-001',
        'Create manual order'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(50);
      expect(result.newBalance).toBe(950);
    });

    it('should consume credits for send_sms action (25 credits)', async () => {
      const expectedCost = getCreditCost('send_sms');
      expect(expectedCost).toBe(25);

      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: 25,
          balance: 975,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'send_sms',
        'sms-ref-001',
        'Send customer notification'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(25);
      expect(result.newBalance).toBe(975);
    });

    it('should not consume credits for free actions (0 credits)', async () => {
      const cost = getCreditCost('dashboard_view');
      expect(cost).toBe(0);

      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: 0,
          balance: 1000,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'dashboard_view'
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(1000);
    });

    it('should pass metadata along with credit consumption', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: 100,
          balance: 900,
        },
        error: null,
      });

      const metadata = { source: 'admin_panel', feature: 'bulk_menu' };

      await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'menu-ref-002',
        'Bulk menu creation',
        metadata
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
        p_tenant_id: TEST_TENANT_ID,
        p_amount: 100,
        p_action_key: 'menu_create',
        p_description: 'Bulk menu creation',
        p_reference_id: 'menu-ref-002',
        p_metadata: metadata,
      });
    });

    it('should handle RPC errors gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'menu-ref-003'
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Database connection failed');
      expect(result.newBalance).toBe(0);
    });

    it('should handle null RPC response', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'menu_create'
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('No response from credit consumption');
    });

    it('should handle exceptions in consumption', async () => {
      mockRpc.mockRejectedValue(new Error('Network timeout'));

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'menu-ref-004'
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network timeout');
    });
  });

  // ==========================================================================
  // 2. Balance Decremented Correctly
  // ==========================================================================

  describe('Balance is decremented correctly', () => {
    it('should decrement balance by exact action cost', async () => {
      const initialBalance = 1000;
      const actionCost = getCreditCost('menu_create'); // 100
      const expectedBalance = initialBalance - actionCost;

      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: actionCost,
          balance: expectedBalance,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'menu-balance-test'
      );

      expect(result.newBalance).toBe(900);
      expect(result.creditsCost).toBe(100);
      expect(result.newBalance).toBe(initialBalance - actionCost);
    });

    it('should decrement to exactly zero when cost equals balance', async () => {
      const cost = getCreditCost('menu_create'); // 100

      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: cost,
          balance: 0,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'exact-zero-test'
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);
      expect(result.creditsCost).toBe(100);
    });

    it('should correctly track multi-step decrements', async () => {
      const actions = [
        { key: 'product_add', expectedCost: 10 },
        { key: 'pos_process_sale', expectedCost: 25 },
        { key: 'menu_create', expectedCost: 100 },
      ];

      let runningBalance = 500;

      for (const action of actions) {
        const cost = getCreditCost(action.key);
        expect(cost).toBe(action.expectedCost);

        runningBalance -= cost;

        mockRpc.mockResolvedValueOnce({
          data: {
            success: true,
            consumed: cost,
            balance: runningBalance,
          },
          error: null,
        });

        const result = await consumeCredits(
          TEST_TENANT_ID,
          action.key,
          `multi-step-${action.key}`
        );

        expect(result.success).toBe(true);
        expect(result.newBalance).toBe(runningBalance);
        expect(result.creditsCost).toBe(action.expectedCost);
      }

      // Final balance: 500 - 10 - 25 - 100 = 365
      expect(runningBalance).toBe(365);
    });

    it('should not decrement balance for actions with 0 cost', () => {
      const freeActions = [
        'dashboard_view',
        'orders_view',
        'product_view',
        'settings_view',
      ];

      for (const action of freeActions) {
        const cost = getCreditCost(action);
        expect(cost).toBe(0);
      }
    });

    it('should handle high-cost actions correctly', async () => {
      // storefront_create costs 500 credits
      const cost = getCreditCost('storefront_create');
      expect(cost).toBeGreaterThanOrEqual(100);

      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: cost,
          balance: 1000 - cost,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'storefront_create',
        'storefront-001'
      );

      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(cost);
      expect(result.newBalance).toBe(1000 - cost);
    });

    it('should verify balance check returns correct remaining credits', async () => {
      // Setup mock for getCreditBalance (called inside checkCredits)
      const tenantCall = { data: mockTenantData, error: null };
      const creditCall = { data: { ...mockBalanceData, balance: 750 }, error: null };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const checkResult = await checkCredits(TEST_TENANT_ID, 'menu_create');

      // menu_create costs 100, balance is 750
      expect(checkResult.hasCredits).toBe(true);
      expect(checkResult.cost).toBe(100);
      expect(checkResult.wouldRemain).toBe(650); // 750 - 100
    });
  });

  // ==========================================================================
  // 3. Transaction Logged with Reference
  // ==========================================================================

  describe('Transaction is logged with reference', () => {
    it('should pass reference_id to consume_credits RPC', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 100, balance: 900 },
        error: null,
      });

      await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'menu-ref-unique-123'
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_reference_id: 'menu-ref-unique-123',
      }));
    });

    it('should pass null reference_id when not provided', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 50, balance: 950 },
        error: null,
      });

      await consumeCredits(
        TEST_TENANT_ID,
        'order_create_manual'
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_reference_id: null,
      }));
    });

    it('should pass description for transaction logging', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 100, balance: 900 },
        error: null,
      });

      await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'menu-456',
        'Create menu for event'
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_description: 'Create menu for event',
        p_reference_id: 'menu-456',
      }));
    });

    it('should pass null description when not provided', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 25, balance: 975 },
        error: null,
      });

      await consumeCredits(
        TEST_TENANT_ID,
        'send_sms',
        'sms-789'
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_description: null,
        p_reference_id: 'sms-789',
      }));
    });

    it('should include action_key in the RPC call for transaction type', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 50, balance: 950 },
        error: null,
      });

      await consumeCredits(
        TEST_TENANT_ID,
        'order_create_manual',
        'order-001',
        'Manual order creation'
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_action_key: 'order_create_manual',
        p_tenant_id: TEST_TENANT_ID,
      }));
    });

    it('should include metadata in transaction for audit trail', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 100, balance: 900 },
        error: null,
      });

      const metadata = {
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'TestBrowser/1.0',
        sessionId: 'session-xyz',
      };

      await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'menu-audit-001',
        'Menu with audit metadata',
        metadata
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_metadata: metadata,
        p_reference_id: 'menu-audit-001',
        p_description: 'Menu with audit metadata',
      }));
    });

    it('should default metadata to empty object when not provided', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, consumed: 10, balance: 990 },
        error: null,
      });

      await consumeCredits(
        TEST_TENANT_ID,
        'product_add',
        'product-001'
      );

      expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
        p_metadata: {},
      }));
    });

    it('should map response fields correctly for transaction record', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          consumed: 75,
          balance: 425,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'menu_order_received',
        'order-ref-555',
        'Order received on menu'
      );

      // Verify the response is correctly mapped
      expect(result).toEqual({
        success: true,
        newBalance: 425,
        creditsCost: 75,
        errorMessage: undefined,
      });
    });

    it('should handle failed consumption with error details', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient credits',
          consumed: 0,
          balance: 50,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'menu-failed-001'
      );

      expect(result.success).toBe(false);
      // When consumed is 0, nullish coalescing returns 0 (not the action cost)
      expect(result.creditsCost).toBe(0);
      expect(result.newBalance).toBe(50);
    });
  });

  // ==========================================================================
  // 4. Insufficient Credits Detection and Blocking
  // ==========================================================================

  describe('Insufficient credits detection', () => {
    it('should detect insufficient credits via checkCredits', async () => {
      const tenantCall = { data: mockTenantData, error: null };
      const creditCall = { data: { ...mockBalanceData, balance: 50 }, error: null };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const result = await checkCredits(TEST_TENANT_ID, 'menu_create');

      expect(result.hasCredits).toBe(false);
      expect(result.balance).toBe(50);
      expect(result.cost).toBe(100);
      expect(result.wouldRemain).toBe(-50); // 50 - 100
      expect(result.isFreeTier).toBe(true);
    });

    it('should allow action when balance equals cost', async () => {
      const tenantCall = { data: mockTenantData, error: null };
      const creditCall = { data: { ...mockBalanceData, balance: 100 }, error: null };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const result = await checkCredits(TEST_TENANT_ID, 'menu_create');

      expect(result.hasCredits).toBe(true);
      expect(result.wouldRemain).toBe(0);
    });

    it('should always allow free actions regardless of balance', async () => {
      const result = await checkCredits(TEST_TENANT_ID, 'dashboard_view');

      expect(result.hasCredits).toBe(true);
      expect(result.cost).toBe(0);
      // Should not even query the database for free actions
      expect(mockMaybeSingle).not.toHaveBeenCalled();
    });

    it('should skip credit check for paid tier users', async () => {
      const tenantCall = {
        data: { ...mockTenantData, subscription_status: 'active', is_free_tier: false },
        error: null,
      };
      const creditCall = {
        data: { ...mockBalanceData, balance: 0, is_free_tier: false },
        error: null,
      };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const result = await checkCredits(TEST_TENANT_ID, 'menu_create');

      expect(result.hasCredits).toBe(true);
      expect(result.isFreeTier).toBe(false);
    });

    it('should block when balance is zero and action costs credits', async () => {
      const tenantCall = { data: mockTenantData, error: null };
      const creditCall = { data: { ...mockBalanceData, balance: 0 }, error: null };

      mockMaybeSingle
        .mockResolvedValueOnce(tenantCall)
        .mockResolvedValueOnce(creditCall);

      const result = await checkCredits(TEST_TENANT_ID, 'pos_process_sale');

      expect(result.hasCredits).toBe(false);
      expect(result.balance).toBe(0);
      expect(result.cost).toBe(25);
      expect(result.wouldRemain).toBe(-25);
    });

    it('should report server-side insufficient credits on consumption', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient credits',
          consumed: 0,
          balance: 30,
        },
        error: null,
      });

      const result = await consumeCredits(
        TEST_TENANT_ID,
        'menu_create',
        'blocked-menu-001'
      );

      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(30);
    });
  });
});

// ============================================================================
// Credit Packages - Purchase Options Verification
// ============================================================================

describe('Credit Purchase Options', () => {
  it('should have at least 4 purchase packages available', () => {
    expect(CREDIT_PACKAGES.length).toBeGreaterThanOrEqual(4);
  });

  it('should have packages with increasing credit amounts', () => {
    for (let i = 1; i < CREDIT_PACKAGES.length; i++) {
      expect(CREDIT_PACKAGES[i].credits).toBeGreaterThan(CREDIT_PACKAGES[i - 1].credits);
    }
  });

  it('should have all required fields for purchase display', () => {
    for (const pkg of CREDIT_PACKAGES) {
      expect(pkg.id).toBeDefined();
      expect(pkg.name).toBeDefined();
      expect(pkg.slug).toBeDefined();
      expect(pkg.credits).toBeGreaterThan(0);
      expect(pkg.priceCents).toBeGreaterThan(0);
    }
  });

  it('should include quick purchase amounts (5K and 15K)', () => {
    const creditAmounts = CREDIT_PACKAGES.map(p => p.credits);
    // At least one package should be around 5K and one around 15K
    const hasMediumPack = creditAmounts.some(c => c >= 1000 && c <= 5000);
    const hasLargePack = creditAmounts.some(c => c >= 10000 && c <= 20000);
    expect(hasMediumPack).toBe(true);
    expect(hasLargePack).toBe(true);
  });

  it('should offer better per-credit pricing for larger packages', () => {
    const pricePerCredit = CREDIT_PACKAGES.map(
      p => p.priceCents / p.credits
    );

    for (let i = 1; i < pricePerCredit.length; i++) {
      expect(pricePerCredit[i]).toBeLessThan(pricePerCredit[i - 1]);
    }
  });
});

// ============================================================================
// Credit Action Cost Verification
// ============================================================================

describe('Credit Action Cost Verification', () => {
  it('should return correct cost info for menu_create', () => {
    const info = getCreditCostInfo('menu_create');
    expect(info).not.toBeNull();
    expect(info?.credits).toBe(100);
    expect(info?.actionName).toBe('Create Menu');
    expect(info?.category).toBe('menus');
  });

  it('should return correct cost info for POS actions', () => {
    const info = getCreditCostInfo('pos_process_sale');
    expect(info).not.toBeNull();
    expect(info?.credits).toBe(25);
  });

  it('should return correct cost info for order actions', () => {
    const info = getCreditCostInfo('order_create_manual');
    expect(info).not.toBeNull();
    expect(info?.credits).toBe(50);
  });

  it('should return null for unknown actions', () => {
    const info = getCreditCostInfo('nonexistent_action');
    expect(info).toBeNull();
  });

  it('should distinguish between free and paid actions', () => {
    // Free actions should cost 0
    expect(getCreditCost('dashboard_view')).toBe(0);
    expect(getCreditCost('orders_view')).toBe(0);
    expect(getCreditCost('product_view')).toBe(0);

    // Paid actions should cost > 0
    expect(getCreditCost('menu_create')).toBeGreaterThan(0);
    expect(getCreditCost('send_sms')).toBeGreaterThan(0);
    expect(getCreditCost('pos_process_sale')).toBeGreaterThan(0);
  });
});

// ============================================================================
// End-to-End Consumption Scenarios
// ============================================================================

describe('End-to-End Consumption Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle sequential consumption reducing balance to warning threshold', async () => {
    let balance = 550; // Start above warning but will drop below

    // First action: product_add (10 credits)
    balance -= 10;
    mockRpc.mockResolvedValueOnce({
      data: { success: true, consumed: 10, balance },
      error: null,
    });

    const r1 = await consumeCredits(TEST_TENANT_ID, 'product_add', 'prod-1');
    expect(r1.success).toBe(true);
    expect(r1.newBalance).toBe(540);

    // Second action: order_create_manual (50 credits)
    balance -= 50;
    mockRpc.mockResolvedValueOnce({
      data: { success: true, consumed: 50, balance },
      error: null,
    });

    const r2 = await consumeCredits(TEST_TENANT_ID, 'order_create_manual', 'order-1');
    expect(r2.success).toBe(true);
    expect(r2.newBalance).toBe(490);
    // Balance is now below 500 (YELLOW_BADGE threshold)
    expect(r2.newBalance).toBeLessThan(500);
  });

  it('should block consumption when server reports insufficient', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'Insufficient credits: need 100, have 30',
        consumed: 0,
        balance: 30,
      },
      error: null,
    });

    const result = await consumeCredits(
      TEST_TENANT_ID,
      'menu_create',
      'blocked-menu'
    );

    expect(result.success).toBe(false);
    expect(result.newBalance).toBe(30);
    // When consumed is 0, nullish coalescing returns 0 (0 is not null/undefined)
    expect(result.creditsCost).toBe(0);
  });

  it('should handle concurrent consumption attempts gracefully', async () => {
    // Simulate two concurrent requests
    mockRpc
      .mockResolvedValueOnce({
        data: { success: true, consumed: 100, balance: 900 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, consumed: 50, balance: 850 },
        error: null,
      });

    const [result1, result2] = await Promise.all([
      consumeCredits(TEST_TENANT_ID, 'menu_create', 'concurrent-1'),
      consumeCredits(TEST_TENANT_ID, 'order_create_manual', 'concurrent-2'),
    ]);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    // Both calls should have gone through
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('should correctly identify that subscription tier users bypass credits', async () => {
    // Verify via checkCredits that paid users bypass
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

    const result = await checkCredits(TEST_TENANT_ID, 'menu_create');

    // Paid users always have credits
    expect(result.hasCredits).toBe(true);
    expect(result.isFreeTier).toBe(false);
  });
});
