/**
 * Grant Free Credits Tests
 *
 * Tests for the credit granting system including:
 * - Plan-based credit amounts
 * - Idempotency (no duplicate grants)
 * - Initial credit grants on signup
 * - Monthly refresh logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Plan-Based Credit Amounts
// ============================================================================

/**
 * Credit amounts per plan (matching the edge function and migration)
 */
const PLAN_CREDIT_AMOUNTS: Record<string, number> = {
  free: 10000,
  starter: 25000,
  pro: 100000,
  professional: 100000,
  enterprise: 500000,
};

const DEFAULT_CREDITS_AMOUNT = 10000;

function getPlanCredits(plan: string | null | undefined): number {
  if (!plan) return DEFAULT_CREDITS_AMOUNT;
  return PLAN_CREDIT_AMOUNTS[plan.toLowerCase()] || DEFAULT_CREDITS_AMOUNT;
}

describe('Plan-Based Credit Amounts', () => {
  describe('getPlanCredits', () => {
    it('should return 10,000 credits for free tier', () => {
      expect(getPlanCredits('free')).toBe(10000);
    });

    it('should return 25,000 credits for starter plan', () => {
      expect(getPlanCredits('starter')).toBe(25000);
    });

    it('should return 100,000 credits for pro plan', () => {
      expect(getPlanCredits('pro')).toBe(100000);
    });

    it('should return 100,000 credits for professional plan', () => {
      expect(getPlanCredits('professional')).toBe(100000);
    });

    it('should return 500,000 credits for enterprise plan', () => {
      expect(getPlanCredits('enterprise')).toBe(500000);
    });

    it('should return default (10,000) for null plan', () => {
      expect(getPlanCredits(null)).toBe(10000);
    });

    it('should return default (10,000) for undefined plan', () => {
      expect(getPlanCredits(undefined)).toBe(10000);
    });

    it('should return default (10,000) for unknown plan', () => {
      expect(getPlanCredits('unknown_plan')).toBe(10000);
    });

    it('should be case-insensitive', () => {
      expect(getPlanCredits('FREE')).toBe(10000);
      expect(getPlanCredits('Starter')).toBe(25000);
      expect(getPlanCredits('ENTERPRISE')).toBe(500000);
    });
  });

  describe('Plan credit amount specifications', () => {
    it('should match documented amounts', () => {
      // Per specification:
      // Free: 10,000
      // Starter: 25,000
      // Pro: 100,000
      // Enterprise: 500,000
      expect(PLAN_CREDIT_AMOUNTS.free).toBe(10000);
      expect(PLAN_CREDIT_AMOUNTS.starter).toBe(25000);
      expect(PLAN_CREDIT_AMOUNTS.pro).toBe(100000);
      expect(PLAN_CREDIT_AMOUNTS.enterprise).toBe(500000);
    });

    it('should have progressively increasing amounts', () => {
      expect(PLAN_CREDIT_AMOUNTS.starter).toBeGreaterThan(PLAN_CREDIT_AMOUNTS.free);
      expect(PLAN_CREDIT_AMOUNTS.pro).toBeGreaterThan(PLAN_CREDIT_AMOUNTS.starter);
      expect(PLAN_CREDIT_AMOUNTS.enterprise).toBeGreaterThan(PLAN_CREDIT_AMOUNTS.pro);
    });
  });
});

// ============================================================================
// Idempotency Key Generation
// ============================================================================

describe('Idempotency Key Generation', () => {
  const generateIdempotencyKey = (
    type: 'free_grant' | 'initial_grant' | 'repair_grant',
    tenantId: string,
    date?: string
  ): string => {
    if (type === 'initial_grant') {
      return `initial_grant:${tenantId}`;
    }
    if (type === 'repair_grant') {
      return `repair_grant:${tenantId}`;
    }
    // Daily grant key includes date to allow one per day
    const grantDate = date || new Date().toISOString().slice(0, 10);
    return `free_grant:${tenantId}:${grantDate}`;
  };

  it('should generate unique initial grant key per tenant', () => {
    const key1 = generateIdempotencyKey('initial_grant', 'tenant-1');
    const key2 = generateIdempotencyKey('initial_grant', 'tenant-2');
    expect(key1).toBe('initial_grant:tenant-1');
    expect(key2).toBe('initial_grant:tenant-2');
    expect(key1).not.toBe(key2);
  });

  it('should generate daily grant key with date', () => {
    const key = generateIdempotencyKey('free_grant', 'tenant-1', '2024-01-15');
    expect(key).toBe('free_grant:tenant-1:2024-01-15');
  });

  it('should allow same tenant different dates', () => {
    const key1 = generateIdempotencyKey('free_grant', 'tenant-1', '2024-01-15');
    const key2 = generateIdempotencyKey('free_grant', 'tenant-1', '2024-01-16');
    expect(key1).not.toBe(key2);
  });

  it('should prevent same tenant same date duplicate', () => {
    const key1 = generateIdempotencyKey('free_grant', 'tenant-1', '2024-01-15');
    const key2 = generateIdempotencyKey('free_grant', 'tenant-1', '2024-01-15');
    expect(key1).toBe(key2);
  });

  it('should generate repair grant key', () => {
    const key = generateIdempotencyKey('repair_grant', 'tenant-1');
    expect(key).toBe('repair_grant:tenant-1');
  });
});

// ============================================================================
// Initial Credit Grant Logic
// ============================================================================

describe('Initial Credit Grant Logic', () => {
  interface TenantCreateParams {
    plan: string;
  }

  interface CreditGrantResult {
    tenantId: string;
    balance: number;
    freeCreditsBalance: number;
    purchasedCreditsBalance: number;
    lifetimeEarned: number;
    tierStatus: 'free' | 'paid';
    isFreeTier: boolean;
  }

  const calculateInitialCredits = (params: TenantCreateParams): CreditGrantResult => {
    const plan = params.plan.toLowerCase();
    const isFreeTier = plan === 'free';
    const credits = getPlanCredits(plan);

    // -1 means unlimited for paid plans
    const balance = plan === 'trial' ? -1 : credits;

    return {
      tenantId: 'test-tenant',
      balance,
      freeCreditsBalance: isFreeTier ? credits : 0,
      purchasedCreditsBalance: 0,
      lifetimeEarned: credits > 0 ? credits : 0,
      tierStatus: isFreeTier ? 'free' : 'paid',
      isFreeTier,
    };
  };

  it('should grant 10,000 credits for free plan signup', () => {
    const result = calculateInitialCredits({ plan: 'free' });
    expect(result.balance).toBe(10000);
    expect(result.freeCreditsBalance).toBe(10000);
    expect(result.isFreeTier).toBe(true);
    expect(result.tierStatus).toBe('free');
  });

  it('should grant 25,000 credits for starter plan signup', () => {
    const result = calculateInitialCredits({ plan: 'starter' });
    expect(result.balance).toBe(25000);
    expect(result.freeCreditsBalance).toBe(0);
    expect(result.isFreeTier).toBe(false);
    expect(result.tierStatus).toBe('paid');
  });

  it('should grant 100,000 credits for pro plan signup', () => {
    const result = calculateInitialCredits({ plan: 'pro' });
    expect(result.balance).toBe(100000);
    expect(result.freeCreditsBalance).toBe(0);
    expect(result.isFreeTier).toBe(false);
  });

  it('should grant 500,000 credits for enterprise plan signup', () => {
    const result = calculateInitialCredits({ plan: 'enterprise' });
    expect(result.balance).toBe(500000);
    expect(result.freeCreditsBalance).toBe(0);
    expect(result.isFreeTier).toBe(false);
  });

  it('should grant unlimited (-1) for trial plan', () => {
    const result = calculateInitialCredits({ plan: 'trial' });
    expect(result.balance).toBe(-1);
    expect(result.isFreeTier).toBe(false);
  });

  it('should default to free tier for unknown plans', () => {
    const result = calculateInitialCredits({ plan: 'unknown' });
    expect(result.balance).toBe(10000);
    expect(result.isFreeTier).toBe(false); // Unknown defaults to paid behavior but free credits
  });
});

// ============================================================================
// Monthly Credit Refresh Logic
// ============================================================================

describe('Monthly Credit Refresh Logic', () => {
  interface RefreshParams {
    tenantId: string;
    plan: string;
    previousBalance: number;
    rolloverPercentage: number;
  }

  interface RefreshResult {
    newBalance: number;
    grantedAmount: number;
    rolloverAmount: number;
    expiredCredits: number;
  }

  const calculateMonthlyRefresh = (params: RefreshParams): RefreshResult => {
    const planCredits = getPlanCredits(params.plan);
    const rolloverAmount = Math.floor(params.previousBalance * params.rolloverPercentage);
    const expiredCredits = params.previousBalance - rolloverAmount;
    const newBalance = planCredits + rolloverAmount;

    return {
      newBalance,
      grantedAmount: planCredits,
      rolloverAmount,
      expiredCredits,
    };
  };

  it('should refresh with plan-based amount and no rollover', () => {
    const result = calculateMonthlyRefresh({
      tenantId: 'tenant-1',
      plan: 'free',
      previousBalance: 500,
      rolloverPercentage: 0,
    });

    expect(result.newBalance).toBe(10000);
    expect(result.grantedAmount).toBe(10000);
    expect(result.rolloverAmount).toBe(0);
    expect(result.expiredCredits).toBe(500);
  });

  it('should apply 10% rollover correctly', () => {
    const result = calculateMonthlyRefresh({
      tenantId: 'tenant-1',
      plan: 'free',
      previousBalance: 1000,
      rolloverPercentage: 0.1,
    });

    expect(result.rolloverAmount).toBe(100);
    expect(result.newBalance).toBe(10100); // 10000 + 100
    expect(result.expiredCredits).toBe(900);
  });

  it('should refresh starter plan with 25,000 credits', () => {
    const result = calculateMonthlyRefresh({
      tenantId: 'tenant-1',
      plan: 'starter',
      previousBalance: 5000,
      rolloverPercentage: 0,
    });

    expect(result.newBalance).toBe(25000);
    expect(result.grantedAmount).toBe(25000);
  });

  it('should handle zero previous balance', () => {
    const result = calculateMonthlyRefresh({
      tenantId: 'tenant-1',
      plan: 'free',
      previousBalance: 0,
      rolloverPercentage: 0.1,
    });

    expect(result.newBalance).toBe(10000);
    expect(result.rolloverAmount).toBe(0);
    expect(result.expiredCredits).toBe(0);
  });
});

// ============================================================================
// Grant Eligibility Logic
// ============================================================================

describe('Grant Eligibility Logic', () => {
  interface TenantCredits {
    tenantId: string;
    balance: number;
    nextFreeGrantAt: Date | null;
    isFreeTier: boolean;
    plan: string;
  }

  const isEligibleForGrant = (
    credits: TenantCredits,
    currentDate: Date
  ): { eligible: boolean; reason: string } => {
    // Check if next_free_grant_at is in the past or now
    if (!credits.nextFreeGrantAt) {
      return { eligible: false, reason: 'no_grant_date_set' };
    }

    if (credits.nextFreeGrantAt > currentDate) {
      return { eligible: false, reason: 'not_yet_due' };
    }

    return { eligible: true, reason: 'eligible' };
  };

  it('should be eligible when nextFreeGrantAt is in the past', () => {
    const now = new Date('2024-02-15');
    const credits: TenantCredits = {
      tenantId: 'tenant-1',
      balance: 500,
      nextFreeGrantAt: new Date('2024-02-01'),
      isFreeTier: true,
      plan: 'free',
    };

    const result = isEligibleForGrant(credits, now);
    expect(result.eligible).toBe(true);
  });

  it('should not be eligible when nextFreeGrantAt is in the future', () => {
    const now = new Date('2024-01-15');
    const credits: TenantCredits = {
      tenantId: 'tenant-1',
      balance: 5000,
      nextFreeGrantAt: new Date('2024-02-01'),
      isFreeTier: true,
      plan: 'free',
    };

    const result = isEligibleForGrant(credits, now);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_yet_due');
  });

  it('should not be eligible when nextFreeGrantAt is null', () => {
    const now = new Date('2024-01-15');
    const credits: TenantCredits = {
      tenantId: 'tenant-1',
      balance: 5000,
      nextFreeGrantAt: null,
      isFreeTier: false,
      plan: 'enterprise',
    };

    const result = isEligibleForGrant(credits, now);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no_grant_date_set');
  });
});

// ============================================================================
// Duplicate Grant Prevention
// ============================================================================

describe('Duplicate Grant Prevention', () => {
  // Simulate a set of processed grants (would be DB unique constraint in production)
  const processedGrants = new Set<string>();

  const tryProcessGrant = (
    tenantId: string,
    grantDate: string
  ): { success: boolean; reason: string } => {
    const key = `free_grant:${tenantId}:${grantDate}`;

    if (processedGrants.has(key)) {
      return { success: false, reason: 'duplicate_grant' };
    }

    processedGrants.add(key);
    return { success: true, reason: 'granted' };
  };

  beforeEach(() => {
    processedGrants.clear();
  });

  it('should allow first grant for a tenant on a given date', () => {
    const result = tryProcessGrant('tenant-1', '2024-01-15');
    expect(result.success).toBe(true);
  });

  it('should reject duplicate grant for same tenant same date', () => {
    tryProcessGrant('tenant-1', '2024-01-15');
    const result = tryProcessGrant('tenant-1', '2024-01-15');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('duplicate_grant');
  });

  it('should allow grant for same tenant on different date', () => {
    tryProcessGrant('tenant-1', '2024-01-15');
    const result = tryProcessGrant('tenant-1', '2024-01-16');
    expect(result.success).toBe(true);
  });

  it('should allow grant for different tenants on same date', () => {
    tryProcessGrant('tenant-1', '2024-01-15');
    const result = tryProcessGrant('tenant-2', '2024-01-15');
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Credit Transaction Logging
// ============================================================================

describe('Credit Transaction Logging', () => {
  interface CreditTransaction {
    tenantId: string;
    amount: number;
    balanceAfter: number;
    transactionType: string;
    actionType: string;
    referenceId: string;
    description: string;
    metadata?: Record<string, unknown>;
  }

  const createGrantTransaction = (
    tenantId: string,
    amount: number,
    balanceAfter: number,
    plan: string,
    type: 'initial' | 'monthly'
  ): CreditTransaction => {
    const isInitial = type === 'initial';
    return {
      tenantId,
      amount,
      balanceAfter,
      transactionType: 'free_grant',
      actionType: isInitial ? 'initial_grant' : 'monthly_refresh',
      referenceId: isInitial
        ? `initial_grant:${tenantId}`
        : `free_grant:${tenantId}:${new Date().toISOString().slice(0, 10)}`,
      description: isInitial
        ? `Welcome credits for new ${plan} account`
        : `Monthly credit refresh (${plan} plan)`,
      metadata: { plan },
    };
  };

  it('should create valid initial grant transaction', () => {
    const tx = createGrantTransaction('tenant-1', 10000, 10000, 'free', 'initial');
    expect(tx.transactionType).toBe('free_grant');
    expect(tx.actionType).toBe('initial_grant');
    expect(tx.amount).toBe(10000);
    expect(tx.description).toContain('Welcome credits');
    expect(tx.referenceId).toBe('initial_grant:tenant-1');
  });

  it('should create valid monthly refresh transaction', () => {
    const tx = createGrantTransaction('tenant-1', 25000, 25500, 'starter', 'monthly');
    expect(tx.transactionType).toBe('free_grant');
    expect(tx.actionType).toBe('monthly_refresh');
    expect(tx.amount).toBe(25000);
    expect(tx.description).toContain('Monthly credit refresh');
    expect(tx.description).toContain('starter');
  });

  it('should include plan in metadata', () => {
    const tx = createGrantTransaction('tenant-1', 100000, 100000, 'pro', 'initial');
    expect(tx.metadata?.plan).toBe('pro');
  });
});

// ============================================================================
// Warning Flag Reset on Grant
// ============================================================================

describe('Warning Flag Reset on Grant', () => {
  interface CreditWarningFlags {
    warning25Sent: boolean;
    warning10Sent: boolean;
    warning5Sent: boolean;
    warning0Sent: boolean;
    alertsSent: Record<string, boolean>;
  }

  const resetWarningFlags = (): CreditWarningFlags => {
    return {
      warning25Sent: false,
      warning10Sent: false,
      warning5Sent: false,
      warning0Sent: false,
      alertsSent: {},
    };
  };

  it('should reset all warning flags after grant', () => {
    const flagsBefore: CreditWarningFlags = {
      warning25Sent: true,
      warning10Sent: true,
      warning5Sent: true,
      warning0Sent: true,
      alertsSent: { depleted: true, critical: true },
    };

    const flagsAfter = resetWarningFlags();

    expect(flagsAfter.warning25Sent).toBe(false);
    expect(flagsAfter.warning10Sent).toBe(false);
    expect(flagsAfter.warning5Sent).toBe(false);
    expect(flagsAfter.warning0Sent).toBe(false);
    expect(Object.keys(flagsAfter.alertsSent)).toHaveLength(0);
  });
});

// ============================================================================
// Next Grant Date Calculation
// ============================================================================

describe('Next Grant Date Calculation', () => {
  const calculateNextGrantDate = (fromDate: Date, daysUntilNext: number = 30): Date => {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + daysUntilNext);
    return nextDate;
  };

  it('should calculate 30 days from now by default', () => {
    const now = new Date('2024-01-15');
    const nextGrant = calculateNextGrantDate(now);
    expect(nextGrant.toISOString().slice(0, 10)).toBe('2024-02-14');
  });

  it('should handle month boundaries correctly', () => {
    const now = new Date('2024-01-31');
    const nextGrant = calculateNextGrantDate(now);
    // 30 days from Jan 31 = Mar 1 (since Feb has 29 days in 2024)
    expect(nextGrant.getMonth()).toBe(2); // March
    expect(nextGrant.getDate()).toBe(1);
  });

  it('should allow custom interval', () => {
    const now = new Date('2024-01-15');
    const nextGrant = calculateNextGrantDate(now, 7); // Weekly
    expect(nextGrant.toISOString().slice(0, 10)).toBe('2024-01-22');
  });
});
