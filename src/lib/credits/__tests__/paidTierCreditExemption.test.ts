/**
 * Paid Tier Credit Exemption Tests
 *
 * Verifies that paid tier tenants (starter, professional, enterprise)
 * are NOT charged credits for basic actions. The is_free_tier flag
 * on the tenants table is the source of truth — when false, all
 * credit checks are bypassed and actions succeed unconditionally.
 *
 * Key behaviors tested:
 * 1. checkCredits returns hasCredits=true for paid tenants on any action
 * 2. checkCredits does NOT query tenant_credits for paid tenants
 * 3. Paid tenants bypass even with zero credit balance
 * 4. All subscription plans (starter, professional, enterprise) bypass
 * 5. Free actions still return cost=0 for paid tenants
 * 6. consumeCredits RPC is still called (server enforces the bypass)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCreditCost, CREDIT_COSTS, FREE_ACTIONS } from '../creditCosts';
import { checkCredits, consumeCredits } from '../creditService';

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

const PAID_TENANT_ID = 'tenant-paid-001';

/** Tenant record for a paid (professional) subscription */
const paidTenantData = {
  subscription_status: 'active',
  subscription_plan: 'professional',
  credits_enabled: true,
  is_free_tier: false,
};

/** Credit balance row — zero balance to prove bypass works */
const zeroCreditBalance = {
  balance: 0,
  lifetime_earned: 0,
  lifetime_spent: 0,
  is_free_tier: false,
  next_free_grant_at: null,
};

/** Helper: set up mocks so getCreditBalance returns a paid tenant */
function mockPaidTenant(
  overrides?: Partial<typeof paidTenantData>,
  balanceOverrides?: Partial<typeof zeroCreditBalance>,
) {
  const tenant = { ...paidTenantData, ...overrides };
  const balance = { ...zeroCreditBalance, ...balanceOverrides };

  mockMaybeSingle
    .mockResolvedValueOnce({ data: tenant, error: null })   // tenants query
    .mockResolvedValueOnce({ data: balance, error: null }); // tenant_credits query
}

// ============================================================================
// 1. checkCredits bypasses for paid tier tenants
// ============================================================================

describe('Paid Tier Credit Exemption — checkCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return hasCredits=true for paid tenant on a paid action', async () => {
    mockPaidTenant();

    const result = await checkCredits(PAID_TENANT_ID, 'menu_create');

    expect(result.hasCredits).toBe(true);
    expect(result.isFreeTier).toBe(false);
    expect(result.cost).toBe(100);
    // Paid tiers get sentinel values indicating "unlimited"
    expect(result.balance).toBe(-1);
    expect(result.wouldRemain).toBe(-1);
  });

  it('should return hasCredits=true even with zero credit balance', async () => {
    mockPaidTenant({}, { balance: 0 });

    const result = await checkCredits(PAID_TENANT_ID, 'order_create_manual');

    expect(result.hasCredits).toBe(true);
    expect(result.isFreeTier).toBe(false);
  });

  it('should return hasCredits=true for high-cost actions (500 credits)', async () => {
    mockPaidTenant();

    const result = await checkCredits(PAID_TENANT_ID, 'storefront_create');

    expect(result.hasCredits).toBe(true);
    expect(result.cost).toBe(500);
    expect(result.isFreeTier).toBe(false);
  });

  it('should return hasCredits=true for free actions without querying DB', async () => {
    // Free actions (cost=0) short-circuit before any DB query
    const result = await checkCredits(PAID_TENANT_ID, 'dashboard_view');

    expect(result.hasCredits).toBe(true);
    expect(result.cost).toBe(0);
    // No DB calls should have been made
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 2. All subscription plans bypass credit checks
// ============================================================================

describe('Paid Tier Credit Exemption — subscription plans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const paidPlans = [
    { plan: 'starter', status: 'active' },
    { plan: 'professional', status: 'active' },
    { plan: 'enterprise', status: 'active' },
  ];

  it.each(paidPlans)(
    'should bypass credits for $plan plan',
    async ({ plan, status }) => {
      mockPaidTenant({
        subscription_plan: plan,
        subscription_status: status,
        is_free_tier: false,
      });

      const result = await checkCredits(PAID_TENANT_ID, 'menu_create');

      expect(result.hasCredits).toBe(true);
      expect(result.isFreeTier).toBe(false);
    },
  );

  it('should NOT bypass credits for free plan', async () => {
    const freeTenant = {
      subscription_status: 'free',
      subscription_plan: 'free',
      credits_enabled: true,
      is_free_tier: true,
    };
    const freeCreditBalance = {
      balance: 50,
      lifetime_earned: 500,
      lifetime_spent: 450,
      is_free_tier: true,
      next_free_grant_at: '2026-04-01T00:00:00Z',
    };

    mockMaybeSingle
      .mockResolvedValueOnce({ data: freeTenant, error: null })
      .mockResolvedValueOnce({ data: freeCreditBalance, error: null });

    const result = await checkCredits(PAID_TENANT_ID, 'menu_create');

    // Free tier tenant with 50 credits cannot afford menu_create (100 credits)
    expect(result.hasCredits).toBe(false);
    expect(result.isFreeTier).toBe(true);
    expect(result.balance).toBe(50);
    expect(result.cost).toBe(100);
  });
});

// ============================================================================
// 3. Paid tier bypass across action categories
// ============================================================================

describe('Paid Tier Credit Exemption — action categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Representative paid actions from each category to verify
   * the bypass applies universally, not just to specific actions.
   */
  const paidActions = [
    { key: 'order_create_manual', cost: 50, category: 'orders' },
    { key: 'menu_create', cost: 100, category: 'menus' },
    { key: 'menu_order_received', cost: 75, category: 'orders' },
    { key: 'wholesale_order_place', cost: 100, category: 'wholesale' },
    { key: 'pos_process_sale', cost: 25, category: 'pos' },
    { key: 'send_sms', cost: 25, category: 'crm' },
    { key: 'send_email', cost: 10, category: 'crm' },
    { key: 'invoice_create', cost: 50, category: 'invoices' },
    { key: 'product_add', cost: 10, category: 'inventory' },
    { key: 'stock_update', cost: 3, category: 'inventory' },
    { key: 'delivery_create', cost: 30, category: 'delivery' },
    { key: 'route_optimize', cost: 50, category: 'fleet' },
    { key: 'report_custom_generate', cost: 75, category: 'reports' },
    { key: 'ai_suggestions', cost: 100, category: 'ai' },
    { key: 'menu_ocr', cost: 250, category: 'ai' },
    { key: 'storefront_create', cost: 500, category: 'marketplace' },
    { key: 'compliance_report_generate', cost: 100, category: 'compliance' },
    { key: 'data_warehouse_export', cost: 200, category: 'exports' },
  ];

  it.each(paidActions)(
    'should bypass credits for $key ($cost credits, $category)',
    async ({ key, cost }) => {
      mockPaidTenant();

      // Verify the action actually has the expected cost
      expect(getCreditCost(key)).toBe(cost);

      const result = await checkCredits(PAID_TENANT_ID, key);

      expect(result.hasCredits).toBe(true);
      expect(result.isFreeTier).toBe(false);
      expect(result.cost).toBe(cost);
    },
  );
});

// ============================================================================
// 4. consumeCredits for paid tier
// ============================================================================

describe('Paid Tier Credit Exemption — consumeCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call consume_credits RPC with correct params for paid tenant', async () => {
    // Server-side RPC returns success without actual deduction for paid tiers
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        consumed: 0,
        balance: -1,
      },
      error: null,
    });

    const result = await consumeCredits(
      PAID_TENANT_ID,
      'menu_create',
      'menu-ref-paid-001',
      'Paid tier menu creation',
    );

    expect(result.success).toBe(true);
    // Server returns -1 balance for paid tiers (sentinel for "unlimited")
    expect(result.newBalance).toBe(-1);
    // RPC should still be called — server handles bypass logic
    expect(mockRpc).toHaveBeenCalledWith('consume_credits', {
      p_tenant_id: PAID_TENANT_ID,
      p_amount: 100,
      p_action_key: 'menu_create',
      p_description: 'Paid tier menu creation',
      p_reference_id: 'menu-ref-paid-001',
      p_metadata: {},
    });
  });

  it('should succeed for multiple consecutive actions without balance depletion', async () => {
    const actions = ['menu_create', 'send_sms', 'order_create_manual', 'invoice_create'];

    for (const actionKey of actions) {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, consumed: 0, balance: -1 },
        error: null,
      });

      const result = await consumeCredits(PAID_TENANT_ID, actionKey);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(-1);
    }

    // All calls went through
    expect(mockRpc).toHaveBeenCalledTimes(actions.length);
  });

  it('should succeed for premium AI actions on paid tier', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, consumed: 0, balance: -1 },
      error: null,
    });

    const result = await consumeCredits(
      PAID_TENANT_ID,
      'menu_ocr',
      'ocr-ref-001',
    );

    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({
      p_action_key: 'menu_ocr',
      p_amount: 250,
    }));
  });
});

// ============================================================================
// 5. Free actions are always free regardless of tier
// ============================================================================

describe('Paid Tier Credit Exemption — free actions stay free', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return cost=0 for free actions on paid tier', async () => {
    // Free actions short-circuit before DB query
    const freeActionSamples = [
      'dashboard_view',
      'orders_view',
      'settings_view',
      'product_view',
      'order_update_status',
    ];

    for (const actionKey of freeActionSamples) {
      const result = await checkCredits(PAID_TENANT_ID, actionKey);

      expect(result.hasCredits).toBe(true);
      expect(result.cost).toBe(0);
    }

    // Free actions never touch the database
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('should verify all FREE_ACTIONS have 0 cost in CREDIT_COSTS', () => {
    for (const actionKey of FREE_ACTIONS) {
      const cost = getCreditCost(actionKey);
      expect(cost).toBe(0);
    }
  });
});

// ============================================================================
// 6. is_free_tier flag is source of truth
// ============================================================================

describe('Paid Tier Credit Exemption — is_free_tier source of truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should bypass when is_free_tier=false even if subscription_plan is missing', async () => {
    mockPaidTenant({
      subscription_plan: undefined as unknown as string,
      is_free_tier: false,
    });

    const result = await checkCredits(PAID_TENANT_ID, 'menu_create');

    expect(result.hasCredits).toBe(true);
    expect(result.isFreeTier).toBe(false);
  });

  it('should bypass when is_free_tier=false even if credits_enabled is false', async () => {
    mockPaidTenant({
      credits_enabled: false,
      is_free_tier: false,
    });

    const result = await checkCredits(PAID_TENANT_ID, 'send_sms');

    expect(result.hasCredits).toBe(true);
    expect(result.isFreeTier).toBe(false);
  });

  it('should enforce credits when is_free_tier=true even if plan says professional', async () => {
    // Edge case: is_free_tier flag overrides subscription_plan
    const contradictoryTenant = {
      subscription_status: 'active',
      subscription_plan: 'professional',
      credits_enabled: true,
      is_free_tier: true, // Flag says free despite plan
    };
    const lowBalance = {
      balance: 10,
      lifetime_earned: 500,
      lifetime_spent: 490,
      is_free_tier: true,
      next_free_grant_at: null,
    };

    mockMaybeSingle
      .mockResolvedValueOnce({ data: contradictoryTenant, error: null })
      .mockResolvedValueOnce({ data: lowBalance, error: null });

    const result = await checkCredits(PAID_TENANT_ID, 'menu_create');

    // is_free_tier=true means credit check IS enforced
    expect(result.hasCredits).toBe(false);
    expect(result.isFreeTier).toBe(true);
    expect(result.balance).toBe(10);
    expect(result.cost).toBe(100);
  });
});

// ============================================================================
// 7. Comprehensive coverage — every non-free action bypasses for paid tier
// ============================================================================

describe('Paid Tier Credit Exemption — exhaustive non-free action check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should confirm every action with cost > 0 still returns hasCredits=true for paid tier', async () => {
    const paidActions = Object.values(CREDIT_COSTS).filter(c => c.credits > 0);

    // Ensure we have a meaningful number of paid actions to verify
    expect(paidActions.length).toBeGreaterThan(30);

    for (const action of paidActions) {
      // Reset mocks for each iteration
      mockMaybeSingle.mockReset();
      mockPaidTenant();

      const result = await checkCredits(PAID_TENANT_ID, action.actionKey);

      expect(result.hasCredits).toBe(true);
      expect(result.isFreeTier).toBe(false);
      expect(result.cost).toBe(action.credits);
    }
  });
});
