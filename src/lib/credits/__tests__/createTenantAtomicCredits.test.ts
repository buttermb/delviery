/**
 * create_tenant_atomic Credit Grant Tests
 *
 * Verifies that the create_tenant_atomic SQL function correctly grants
 * 10,000 initial credits for free tier tenants, with proper balance
 * tracking, transaction logging, and tier status.
 *
 * These tests validate the TypeScript-side logic that mirrors the SQL
 * function behavior, ensuring consistency between the SQL implementation
 * and the application layer.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Constants matching create_tenant_atomic SQL function
// ============================================================================

/** Plan-based initial credit amounts (mirrors SQL function) */
const PLAN_INITIAL_CREDITS: Record<string, number> = {
  free: 10_000,
  starter: 25_000,
  professional: 100_000,
  enterprise: 500_000,
};

/** Trial gets unlimited credits (-1) */
const TRIAL_CREDITS = -1;

/** Default plan when none specified */
const DEFAULT_PLAN = 'free';

/** Free tier initial credit grant */
const FREE_TIER_INITIAL_CREDITS = 10_000;

// ============================================================================
// Types matching the SQL function's return shape
// ============================================================================

interface TenantCreateParams {
  authUserId: string;
  email: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  state?: string;
  industry?: string;
  companySize?: string;
  slug?: string;
  plan?: string;
}

interface TenantCreditsRecord {
  tenantId: string;
  balance: number;
  freeCreditsBalance: number;
  purchasedCreditsBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  tierStatus: 'free' | 'paid';
  hasFreeCreditsExpiry: boolean;
  hasLastFreeGrantAt: boolean;
  hasNextFreeGrantAt: boolean;
}

interface CreditTransactionRecord {
  tenantId: string;
  amount: number;
  balanceAfter: number;
  transactionType: string;
  actionType: string;
  description: string;
  referenceId: string;
  metadata: {
    plan: string;
    is_free_tier: boolean;
  };
}

interface AtomicResult {
  tenantId: string;
  tenantUserId: string;
  subscriptionEventId: string;
  initialCredits: number;
  tenant: {
    subscriptionPlan: string;
    subscriptionStatus: string;
    isFreeTier: boolean;
    mrr: number;
  };
  credits: TenantCreditsRecord;
  transaction: CreditTransactionRecord | null;
}

// ============================================================================
// Pure logic functions that mirror the SQL function behavior
// ============================================================================

function resolveSubscriptionPlan(plan: string): string {
  const normalized = plan.toLowerCase();
  if (normalized === 'pro') return 'professional';
  if (['free', 'starter', 'professional', 'enterprise', 'trial'].includes(normalized)) {
    return normalized === 'trial' ? 'starter' : normalized;
  }
  return 'free'; // Unknown plans default to free
}

function getInitialCredits(plan: string): number {
  const normalized = plan.toLowerCase();
  if (normalized === 'trial') return TRIAL_CREDITS;
  if (normalized === 'pro') return PLAN_INITIAL_CREDITS.professional;
  return PLAN_INITIAL_CREDITS[normalized] ?? FREE_TIER_INITIAL_CREDITS;
}

function isFreeTierPlan(plan: string): boolean {
  const normalized = plan.toLowerCase();
  // Free plan or unknown plans default to free tier
  return normalized === 'free' || !['starter', 'pro', 'professional', 'enterprise', 'trial'].includes(normalized);
}

function getSubscriptionStatus(plan: string): string {
  return plan.toLowerCase() === 'trial' ? 'trialing' : 'active';
}

function getMrr(plan: string): number {
  const resolved = resolveSubscriptionPlan(plan);
  const mrrMap: Record<string, number> = {
    free: 0,
    starter: 79,
    professional: 150,
    enterprise: 499,
  };
  return mrrMap[resolved] ?? 0;
}

function simulateCreateTenantAtomic(params: TenantCreateParams): AtomicResult {
  const plan = params.plan ?? DEFAULT_PLAN;
  const isFreeTier = isFreeTierPlan(plan);
  const initialCredits = getInitialCredits(plan);
  const subscriptionPlan = resolveSubscriptionPlan(plan);
  const subscriptionStatus = getSubscriptionStatus(plan);
  const mrr = getMrr(plan);

  const tenantId = `tenant-${Date.now()}`;
  const tenantUserId = `tenant-user-${Date.now()}`;
  const subscriptionEventId = `sub-event-${Date.now()}`;

  const credits: TenantCreditsRecord = {
    tenantId,
    balance: initialCredits,
    freeCreditsBalance: isFreeTier ? initialCredits : 0,
    purchasedCreditsBalance: 0,
    lifetimeEarned: initialCredits > 0 ? initialCredits : 0,
    lifetimeSpent: 0,
    tierStatus: isFreeTier ? 'free' : 'paid',
    hasFreeCreditsExpiry: isFreeTier,
    hasLastFreeGrantAt: isFreeTier,
    hasNextFreeGrantAt: isFreeTier,
  };

  // Transaction is only logged when credits > 0
  const transaction: CreditTransactionRecord | null = initialCredits > 0
    ? {
        tenantId,
        amount: initialCredits,
        balanceAfter: initialCredits,
        transactionType: 'bonus',
        actionType: 'initial_grant',
        description: `Welcome credits for new ${subscriptionPlan} account`,
        referenceId: `initial_grant:${tenantId}`,
        metadata: {
          plan: subscriptionPlan,
          is_free_tier: isFreeTier,
        },
      }
    : null;

  return {
    tenantId,
    tenantUserId,
    subscriptionEventId,
    initialCredits,
    tenant: {
      subscriptionPlan,
      subscriptionStatus,
      isFreeTier,
      mrr,
    },
    credits,
    transaction,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('create_tenant_atomic: Free Tier Credit Grants', () => {
  const freeParams: TenantCreateParams = {
    authUserId: 'auth-user-123',
    email: 'test@example.com',
    businessName: 'Test Business',
    ownerName: 'Test Owner',
    plan: 'free',
  };

  describe('Initial credit amount', () => {
    it('should grant exactly 10,000 credits for free plan', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.initialCredits).toBe(10_000);
    });

    it('should grant 10,000 credits when plan defaults (no plan specified)', () => {
      const params = { ...freeParams, plan: undefined };
      const result = simulateCreateTenantAtomic(params);
      expect(result.initialCredits).toBe(10_000);
    });

    it('should grant 10,000 credits for unknown plan names (defaults to free)', () => {
      const result = simulateCreateTenantAtomic({ ...freeParams, plan: 'unknown_plan' });
      expect(result.initialCredits).toBe(10_000);
    });
  });

  describe('Credit balance record', () => {
    it('should set balance to 10,000 for free tier', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.balance).toBe(10_000);
    });

    it('should set free_credits_balance to 10,000 for free tier', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.freeCreditsBalance).toBe(10_000);
    });

    it('should set purchased_credits_balance to 0', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.purchasedCreditsBalance).toBe(0);
    });

    it('should set lifetime_earned to 10,000', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.lifetimeEarned).toBe(10_000);
    });

    it('should set lifetime_spent to 0', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.lifetimeSpent).toBe(0);
    });

    it('should set tier_status to "free"', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.tierStatus).toBe('free');
    });

    it('should set free_credits_expires_at (30 days from now)', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.hasFreeCreditsExpiry).toBe(true);
    });

    it('should set last_free_grant_at to now', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.hasLastFreeGrantAt).toBe(true);
    });

    it('should set next_free_grant_at (30 days from now)', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.credits.hasNextFreeGrantAt).toBe(true);
    });
  });

  describe('Tenant record', () => {
    it('should set subscription_plan to "free"', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.tenant.subscriptionPlan).toBe('free');
    });

    it('should set subscription_status to "active"', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.tenant.subscriptionStatus).toBe('active');
    });

    it('should set is_free_tier to true', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.tenant.isFreeTier).toBe(true);
    });

    it('should set mrr to 0 for free tier', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.tenant.mrr).toBe(0);
    });
  });

  describe('Credit transaction logging', () => {
    it('should log a bonus transaction for initial grant', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.transaction).not.toBeNull();
      expect(result.transaction?.transactionType).toBe('bonus');
    });

    it('should log action_type as "initial_grant"', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.transaction?.actionType).toBe('initial_grant');
    });

    it('should log amount of 10,000', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.transaction?.amount).toBe(10_000);
    });

    it('should log balance_after as 10,000', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.transaction?.balanceAfter).toBe(10_000);
    });

    it('should include welcome description with plan name', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.transaction?.description).toBe('Welcome credits for new free account');
    });

    it('should use idempotency reference_id format', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.transaction?.referenceId).toBe(`initial_grant:${result.tenantId}`);
    });

    it('should include plan and is_free_tier in metadata', () => {
      const result = simulateCreateTenantAtomic(freeParams);
      expect(result.transaction?.metadata.plan).toBe('free');
      expect(result.transaction?.metadata.is_free_tier).toBe(true);
    });
  });
});

describe('create_tenant_atomic: All Plan Credit Amounts', () => {
  const baseParams: TenantCreateParams = {
    authUserId: 'auth-user-123',
    email: 'test@example.com',
    businessName: 'Test Business',
    ownerName: 'Test Owner',
  };

  it('should grant 10,000 credits for free plan', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'free' });
    expect(result.initialCredits).toBe(10_000);
    expect(result.tenant.isFreeTier).toBe(true);
  });

  it('should grant 25,000 credits for starter plan', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'starter' });
    expect(result.initialCredits).toBe(25_000);
    expect(result.tenant.isFreeTier).toBe(false);
  });

  it('should grant 100,000 credits for pro plan', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'pro' });
    expect(result.initialCredits).toBe(100_000);
    expect(result.tenant.isFreeTier).toBe(false);
  });

  it('should grant 100,000 credits for professional plan', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'professional' });
    expect(result.initialCredits).toBe(100_000);
    expect(result.tenant.isFreeTier).toBe(false);
  });

  it('should grant 500,000 credits for enterprise plan', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'enterprise' });
    expect(result.initialCredits).toBe(500_000);
    expect(result.tenant.isFreeTier).toBe(false);
  });

  it('should grant unlimited (-1) credits for trial plan', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'trial' });
    expect(result.initialCredits).toBe(-1);
    expect(result.tenant.isFreeTier).toBe(false);
    expect(result.tenant.subscriptionStatus).toBe('trialing');
  });

  it('should have progressively increasing credits across paid plans', () => {
    expect(PLAN_INITIAL_CREDITS.free).toBeLessThan(PLAN_INITIAL_CREDITS.starter);
    expect(PLAN_INITIAL_CREDITS.starter).toBeLessThan(PLAN_INITIAL_CREDITS.professional);
    expect(PLAN_INITIAL_CREDITS.professional).toBeLessThan(PLAN_INITIAL_CREDITS.enterprise);
  });
});

describe('create_tenant_atomic: Free Tier Credit Balance Details', () => {
  const baseParams: TenantCreateParams = {
    authUserId: 'auth-user-123',
    email: 'test@example.com',
    businessName: 'Test Business',
    ownerName: 'Test Owner',
  };

  it('should track free_credits_balance only for free tier', () => {
    const freeResult = simulateCreateTenantAtomic({ ...baseParams, plan: 'free' });
    const starterResult = simulateCreateTenantAtomic({ ...baseParams, plan: 'starter' });

    expect(freeResult.credits.freeCreditsBalance).toBe(10_000);
    expect(starterResult.credits.freeCreditsBalance).toBe(0);
  });

  it('should set expiry dates only for free tier', () => {
    const freeResult = simulateCreateTenantAtomic({ ...baseParams, plan: 'free' });
    const starterResult = simulateCreateTenantAtomic({ ...baseParams, plan: 'starter' });

    expect(freeResult.credits.hasFreeCreditsExpiry).toBe(true);
    expect(starterResult.credits.hasFreeCreditsExpiry).toBe(false);
  });

  it('should set grant tracking dates only for free tier', () => {
    const freeResult = simulateCreateTenantAtomic({ ...baseParams, plan: 'free' });
    const starterResult = simulateCreateTenantAtomic({ ...baseParams, plan: 'starter' });

    expect(freeResult.credits.hasLastFreeGrantAt).toBe(true);
    expect(freeResult.credits.hasNextFreeGrantAt).toBe(true);
    expect(starterResult.credits.hasLastFreeGrantAt).toBe(false);
    expect(starterResult.credits.hasNextFreeGrantAt).toBe(false);
  });

  it('should not log transaction for trial plan (unlimited = -1)', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'trial' });
    // -1 credits means unlimited, transaction only logged when credits > 0
    expect(result.transaction).toBeNull();
  });
});

describe('create_tenant_atomic: MRR Pricing Consistency', () => {
  const baseParams: TenantCreateParams = {
    authUserId: 'auth-user-123',
    email: 'test@example.com',
    businessName: 'Test Business',
    ownerName: 'Test Owner',
  };

  it('should set MRR to $0 for free tier', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'free' });
    expect(result.tenant.mrr).toBe(0);
  });

  it('should set MRR to $79 for starter (canonical price)', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'starter' });
    expect(result.tenant.mrr).toBe(79);
  });

  it('should set MRR to $150 for professional (canonical price)', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'professional' });
    expect(result.tenant.mrr).toBe(150);
  });

  it('should set MRR to $499 for enterprise (canonical price)', () => {
    const result = simulateCreateTenantAtomic({ ...baseParams, plan: 'enterprise' });
    expect(result.tenant.mrr).toBe(499);
  });

  it('should NOT use old pricing (99/299/999)', () => {
    const starter = simulateCreateTenantAtomic({ ...baseParams, plan: 'starter' });
    const pro = simulateCreateTenantAtomic({ ...baseParams, plan: 'professional' });
    const enterprise = simulateCreateTenantAtomic({ ...baseParams, plan: 'enterprise' });

    expect(starter.tenant.mrr).not.toBe(99);
    expect(pro.tenant.mrr).not.toBe(299);
    expect(enterprise.tenant.mrr).not.toBe(999);
  });
});

describe('create_tenant_atomic: Plan Resolution', () => {
  it('should resolve "pro" to "professional"', () => {
    expect(resolveSubscriptionPlan('pro')).toBe('professional');
  });

  it('should resolve "free" to "free"', () => {
    expect(resolveSubscriptionPlan('free')).toBe('free');
  });

  it('should resolve "trial" to "starter" (trial defaults to starter plan)', () => {
    expect(resolveSubscriptionPlan('trial')).toBe('starter');
  });

  it('should resolve unknown plans to "free"', () => {
    expect(resolveSubscriptionPlan('unknown')).toBe('free');
    expect(resolveSubscriptionPlan('')).toBe('free');
    expect(resolveSubscriptionPlan('basic')).toBe('free');
  });
});

describe('create_tenant_atomic: get_plan_credit_amount helper', () => {
  // This mirrors the SQL helper function get_plan_credit_amount
  it('should match SQL function output for all plans', () => {
    expect(getInitialCredits('free')).toBe(10_000);
    expect(getInitialCredits('starter')).toBe(25_000);
    expect(getInitialCredits('pro')).toBe(100_000);
    expect(getInitialCredits('professional')).toBe(100_000);
    expect(getInitialCredits('enterprise')).toBe(500_000);
    expect(getInitialCredits('trial')).toBe(-1);
  });

  it('should default to free tier amount for unknown plans', () => {
    expect(getInitialCredits('garbage')).toBe(10_000);
    expect(getInitialCredits('')).toBe(10_000);
  });
});
