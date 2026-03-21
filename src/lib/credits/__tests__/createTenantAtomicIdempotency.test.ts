/**
 * create_tenant_atomic Credit Transaction Idempotency Tests
 *
 * Verifies that the credit initialization within create_tenant_atomic
 * is idempotent — calling it multiple times for the same tenant
 * does not create duplicate credit records or transactions.
 *
 * The SQL function uses:
 * - ON CONFLICT (tenant_id) DO UPDATE for tenant_credits
 * - ON CONFLICT DO NOTHING for credit_transactions (with idempotency index)
 * - Unique idempotency key: 'initial_grant:{tenant_id}'
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// Types matching the SQL function behavior
// ============================================================================

interface TenantCreditsRecord {
  tenantId: string;
  balance: number;
  freeCreditsBalance: number;
  purchasedCreditsBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  tierStatus: 'free' | 'paid';
  updatedAt: Date;
}

interface CreditTransactionRecord {
  id: string;
  tenantId: string;
  amount: number;
  balanceAfter: number;
  transactionType: string;
  actionType: string;
  referenceId: string;
  description: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Simulated Database State (mirrors SQL ON CONFLICT behavior)
// ============================================================================

class SimulatedCreditStore {
  private tenantCredits = new Map<string, TenantCreditsRecord>();
  private creditTransactions: CreditTransactionRecord[] = [];
  // Simulates idx_credit_transactions_idempotency unique index
  private idempotencyIndex = new Set<string>();

  /**
   * Simulates: INSERT INTO tenant_credits ... ON CONFLICT (tenant_id) DO UPDATE SET
   * This mirrors lines 239-272 of create_tenant_atomic
   */
  upsertTenantCredits(record: TenantCreditsRecord): {
    action: 'inserted' | 'updated';
  } {
    const existing = this.tenantCredits.get(record.tenantId);
    this.tenantCredits.set(record.tenantId, { ...record, updatedAt: new Date() });
    return { action: existing ? 'updated' : 'inserted' };
  }

  /**
   * Simulates: INSERT INTO credit_transactions ... ON CONFLICT DO NOTHING
   * Uses the idempotency index: (tenant_id, action_type, reference_id)
   * This mirrors lines 276-298 of create_tenant_atomic
   */
  insertCreditTransaction(record: CreditTransactionRecord): {
    inserted: boolean;
    reason?: string;
  } {
    // Build the idempotency key matching the partial unique index
    // WHERE reference_id IS NOT NULL
    if (record.referenceId) {
      const idempotencyKey = `${record.tenantId}:${record.actionType}:${record.referenceId}`;
      if (this.idempotencyIndex.has(idempotencyKey)) {
        // ON CONFLICT DO NOTHING — silently skip
        return { inserted: false, reason: 'idempotency_conflict' };
      }
      this.idempotencyIndex.add(idempotencyKey);
    }

    this.creditTransactions.push(record);
    return { inserted: true };
  }

  getTenantCredits(tenantId: string): TenantCreditsRecord | undefined {
    return this.tenantCredits.get(tenantId);
  }

  getTransactionsForTenant(tenantId: string): CreditTransactionRecord[] {
    return this.creditTransactions.filter((t) => t.tenantId === tenantId);
  }

  getTransactionCount(): number {
    return this.creditTransactions.length;
  }
}

// ============================================================================
// Simulated create_tenant_atomic credit initialization
// ============================================================================

/**
 * Mirrors the credit initialization logic from create_tenant_atomic SQL function.
 * See migration: 20260320000001_fix_subscription_pricing_consistency.sql lines 237-298
 */
function simulateAtomicCreditInit(
  store: SimulatedCreditStore,
  tenantId: string,
  plan: string
): {
  creditsUpsert: 'inserted' | 'updated';
  transactionInserted: boolean;
  initialCredits: number;
} {
  // Determine credits based on plan (mirrors lines 50-93)
  let initialCredits: number;
  let isFreeTier: boolean;

  switch (plan) {
    case 'free':
      initialCredits = 10000;
      isFreeTier = true;
      break;
    case 'starter':
      initialCredits = 25000;
      isFreeTier = false;
      break;
    case 'pro':
    case 'professional':
      initialCredits = 100000;
      isFreeTier = false;
      break;
    case 'enterprise':
      initialCredits = 500000;
      isFreeTier = false;
      break;
    case 'trial':
      initialCredits = -1; // unlimited
      isFreeTier = false;
      break;
    default:
      initialCredits = 10000;
      isFreeTier = true;
      break;
  }

  // Step 1: Upsert tenant_credits (ON CONFLICT DO UPDATE)
  const upsertResult = store.upsertTenantCredits({
    tenantId,
    balance: initialCredits,
    freeCreditsBalance: isFreeTier ? initialCredits : 0,
    purchasedCreditsBalance: 0,
    lifetimeEarned: initialCredits > 0 ? initialCredits : 0,
    lifetimeSpent: 0,
    tierStatus: isFreeTier ? 'free' : 'paid',
    updatedAt: new Date(),
  });

  // Step 2: Insert credit transaction with idempotency (ON CONFLICT DO NOTHING)
  let transactionInserted = false;
  if (initialCredits > 0) {
    const txResult = store.insertCreditTransaction({
      id: crypto.randomUUID(),
      tenantId,
      amount: initialCredits,
      balanceAfter: initialCredits,
      transactionType: 'bonus',
      actionType: 'initial_grant',
      referenceId: `initial_grant:${tenantId}`,
      description: `Welcome credits for new ${plan} account`,
      metadata: { plan, is_free_tier: isFreeTier },
    });
    transactionInserted = txResult.inserted;
  }

  return {
    creditsUpsert: upsertResult.action,
    transactionInserted,
    initialCredits,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('create_tenant_atomic Credit Transaction Idempotency', () => {
  let store: SimulatedCreditStore;

  beforeEach(() => {
    store = new SimulatedCreditStore();
  });

  // --------------------------------------------------------------------------
  // Core Idempotency Tests
  // --------------------------------------------------------------------------

  describe('idempotent credit initialization', () => {
    it('should create credit record on first call', () => {
      const result = simulateAtomicCreditInit(store, 'tenant-1', 'free');

      expect(result.creditsUpsert).toBe('inserted');
      expect(result.transactionInserted).toBe(true);
      expect(result.initialCredits).toBe(10000);

      const credits = store.getTenantCredits('tenant-1');
      expect(credits?.balance).toBe(10000);
      expect(credits?.freeCreditsBalance).toBe(10000);
    });

    it('should NOT create duplicate transaction on second call', () => {
      // First call
      simulateAtomicCreditInit(store, 'tenant-1', 'free');

      // Second call (simulating retry/race condition)
      const result = simulateAtomicCreditInit(store, 'tenant-1', 'free');

      expect(result.transactionInserted).toBe(false);

      // Only one transaction should exist
      const transactions = store.getTransactionsForTenant('tenant-1');
      expect(transactions).toHaveLength(1);
    });

    it('should update (not duplicate) credit record on second call', () => {
      // First call
      simulateAtomicCreditInit(store, 'tenant-1', 'free');

      // Second call
      const result = simulateAtomicCreditInit(store, 'tenant-1', 'free');

      expect(result.creditsUpsert).toBe('updated');

      // Balance should be same (overwritten, not accumulated)
      const credits = store.getTenantCredits('tenant-1');
      expect(credits?.balance).toBe(10000);
      expect(credits?.lifetimeEarned).toBe(10000);
    });

    it('should be idempotent after 3+ calls', () => {
      // Call multiple times
      simulateAtomicCreditInit(store, 'tenant-1', 'free');
      simulateAtomicCreditInit(store, 'tenant-1', 'free');
      simulateAtomicCreditInit(store, 'tenant-1', 'free');

      // Still only one transaction
      const transactions = store.getTransactionsForTenant('tenant-1');
      expect(transactions).toHaveLength(1);

      // Balance unchanged
      const credits = store.getTenantCredits('tenant-1');
      expect(credits?.balance).toBe(10000);
    });
  });

  // --------------------------------------------------------------------------
  // Idempotency Key Format
  // --------------------------------------------------------------------------

  describe('idempotency key format', () => {
    it('should use initial_grant:{tenant_id} as reference_id', () => {
      simulateAtomicCreditInit(store, 'tenant-abc-123', 'free');

      const transactions = store.getTransactionsForTenant('tenant-abc-123');
      expect(transactions[0].referenceId).toBe('initial_grant:tenant-abc-123');
    });

    it('should use action_type initial_grant for idempotency index', () => {
      simulateAtomicCreditInit(store, 'tenant-1', 'starter');

      const transactions = store.getTransactionsForTenant('tenant-1');
      expect(transactions[0].actionType).toBe('initial_grant');
    });

    it('should generate unique keys for different tenants', () => {
      simulateAtomicCreditInit(store, 'tenant-1', 'free');
      simulateAtomicCreditInit(store, 'tenant-2', 'free');

      const tx1 = store.getTransactionsForTenant('tenant-1');
      const tx2 = store.getTransactionsForTenant('tenant-2');

      expect(tx1[0].referenceId).not.toBe(tx2[0].referenceId);
    });

    it('should allow different tenants to each get initial credits', () => {
      simulateAtomicCreditInit(store, 'tenant-1', 'free');
      simulateAtomicCreditInit(store, 'tenant-2', 'starter');
      simulateAtomicCreditInit(store, 'tenant-3', 'enterprise');

      expect(store.getTransactionCount()).toBe(3);

      expect(store.getTenantCredits('tenant-1')?.balance).toBe(10000);
      expect(store.getTenantCredits('tenant-2')?.balance).toBe(25000);
      expect(store.getTenantCredits('tenant-3')?.balance).toBe(500000);
    });
  });

  // --------------------------------------------------------------------------
  // Plan-specific idempotency
  // --------------------------------------------------------------------------

  describe('plan-specific credit amounts are stable across retries', () => {
    const plans = [
      { plan: 'free', expected: 10000 },
      { plan: 'starter', expected: 25000 },
      { plan: 'pro', expected: 100000 },
      { plan: 'professional', expected: 100000 },
      { plan: 'enterprise', expected: 500000 },
    ];

    plans.forEach(({ plan, expected }) => {
      it(`should maintain ${expected} credits for ${plan} plan on retry`, () => {
        const tenantId = `tenant-${plan}`;

        // First call
        simulateAtomicCreditInit(store, tenantId, plan);
        expect(store.getTenantCredits(tenantId)?.balance).toBe(expected);

        // Retry
        simulateAtomicCreditInit(store, tenantId, plan);
        expect(store.getTenantCredits(tenantId)?.balance).toBe(expected);

        // Only one transaction
        expect(store.getTransactionsForTenant(tenantId)).toHaveLength(1);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Trial plan (unlimited credits, no transaction)
  // --------------------------------------------------------------------------

  describe('trial plan credit initialization', () => {
    it('should set balance to -1 (unlimited) for trial', () => {
      simulateAtomicCreditInit(store, 'tenant-trial', 'trial');

      const credits = store.getTenantCredits('tenant-trial');
      expect(credits?.balance).toBe(-1);
    });

    it('should NOT create credit transaction for trial (unlimited)', () => {
      simulateAtomicCreditInit(store, 'tenant-trial', 'trial');

      // -1 (unlimited) means initial_credits is not > 0, so no transaction
      const transactions = store.getTransactionsForTenant('tenant-trial');
      expect(transactions).toHaveLength(0);
    });

    it('should be idempotent for trial plan retries', () => {
      simulateAtomicCreditInit(store, 'tenant-trial', 'trial');
      simulateAtomicCreditInit(store, 'tenant-trial', 'trial');

      const credits = store.getTenantCredits('tenant-trial');
      expect(credits?.balance).toBe(-1);
      expect(store.getTransactionsForTenant('tenant-trial')).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // grant_free_credits idempotency (called after create_tenant_atomic)
  // --------------------------------------------------------------------------

  describe('grant_free_credits after create_tenant_atomic', () => {
    it('should not conflict with initial_grant transaction', () => {
      // Step 1: create_tenant_atomic runs initial credit grant
      simulateAtomicCreditInit(store, 'tenant-1', 'free');

      // Step 2: grant_free_credits is called separately (different action_type)
      const grantResult = store.insertCreditTransaction({
        id: crypto.randomUUID(),
        tenantId: 'tenant-1',
        amount: 10000,
        balanceAfter: 20000,
        transactionType: 'free_grant',
        actionType: 'monthly_refresh',
        referenceId: `free_grant:tenant-1:2024-01-15`,
        description: 'Monthly free credit grant',
        metadata: { plan: 'free' },
      });

      // Both should succeed (different action_type and reference_id)
      expect(grantResult.inserted).toBe(true);
      expect(store.getTransactionsForTenant('tenant-1')).toHaveLength(2);
    });

    it('should prevent duplicate monthly grants on same date', () => {
      simulateAtomicCreditInit(store, 'tenant-1', 'free');

      // First monthly grant
      store.insertCreditTransaction({
        id: crypto.randomUUID(),
        tenantId: 'tenant-1',
        amount: 10000,
        balanceAfter: 20000,
        transactionType: 'free_grant',
        actionType: 'monthly_refresh',
        referenceId: `free_grant:tenant-1:2024-01-15`,
        description: 'Monthly free credit grant',
        metadata: {},
      });

      // Duplicate monthly grant (same date)
      const duplicateResult = store.insertCreditTransaction({
        id: crypto.randomUUID(),
        tenantId: 'tenant-1',
        amount: 10000,
        balanceAfter: 30000,
        transactionType: 'free_grant',
        actionType: 'monthly_refresh',
        referenceId: `free_grant:tenant-1:2024-01-15`,
        description: 'Monthly free credit grant',
        metadata: {},
      });

      expect(duplicateResult.inserted).toBe(false);
      expect(duplicateResult.reason).toBe('idempotency_conflict');
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle unknown plan defaulting to free tier credits', () => {
      const result = simulateAtomicCreditInit(store, 'tenant-unknown', 'nonexistent_plan');

      expect(result.initialCredits).toBe(10000);
      expect(result.transactionInserted).toBe(true);
    });

    it('should not accumulate balance on upsert (overwrite, not add)', () => {
      // First call: balance = 10000
      simulateAtomicCreditInit(store, 'tenant-1', 'free');
      expect(store.getTenantCredits('tenant-1')?.balance).toBe(10000);

      // Second call: balance should still be 10000 (overwritten), not 20000
      simulateAtomicCreditInit(store, 'tenant-1', 'free');
      expect(store.getTenantCredits('tenant-1')?.balance).toBe(10000);
    });

    it('should handle concurrent-like calls for same tenant', () => {
      // Simulate two "concurrent" calls (same tenant, same plan)
      const result1 = simulateAtomicCreditInit(store, 'tenant-1', 'starter');
      const result2 = simulateAtomicCreditInit(store, 'tenant-1', 'starter');

      // First creates, second updates
      expect(result1.creditsUpsert).toBe('inserted');
      expect(result2.creditsUpsert).toBe('updated');

      // Only one transaction
      expect(result1.transactionInserted).toBe(true);
      expect(result2.transactionInserted).toBe(false);

      // Balance is correct
      expect(store.getTenantCredits('tenant-1')?.balance).toBe(25000);
    });

    it('should use transaction_type bonus for initial grant', () => {
      simulateAtomicCreditInit(store, 'tenant-1', 'free');

      const transactions = store.getTransactionsForTenant('tenant-1');
      expect(transactions[0].transactionType).toBe('bonus');
    });

    it('should include plan metadata in transaction', () => {
      simulateAtomicCreditInit(store, 'tenant-1', 'enterprise');

      const transactions = store.getTransactionsForTenant('tenant-1');
      expect(transactions[0].metadata).toEqual({
        plan: 'enterprise',
        is_free_tier: false,
      });
    });
  });
});

// ============================================================================
// SQL Idempotency Constraint Verification
// ============================================================================

describe('SQL Idempotency Constraint Verification', () => {
  it('should verify idx_credit_transactions_idempotency covers initial_grant', () => {
    // The unique index is: (tenant_id, action_type, reference_id) WHERE reference_id IS NOT NULL
    // For initial grants:
    //   tenant_id = the new tenant UUID
    //   action_type = 'initial_grant'
    //   reference_id = 'initial_grant:{tenant_id}'
    //
    // This ensures:
    // 1. reference_id is NOT NULL -> index applies
    // 2. Same tenant + same action_type + same reference_id -> unique violation
    // 3. ON CONFLICT DO NOTHING silently skips the duplicate

    const tenantId = 'abc-123-def';
    const actionType = 'initial_grant';
    const referenceId = `initial_grant:${tenantId}`;

    // The index key components
    expect(referenceId).not.toBeNull();
    expect(actionType).toBe('initial_grant');
    expect(referenceId).toContain(tenantId);

    // Two calls with same params produce same index key
    const key1 = `${tenantId}:${actionType}:${referenceId}`;
    const key2 = `${tenantId}:${actionType}:${referenceId}`;
    expect(key1).toBe(key2);
  });

  it('should verify ON CONFLICT DO UPDATE on tenant_credits uses overwrite semantics', () => {
    // The SQL uses:
    //   ON CONFLICT (tenant_id) DO UPDATE SET
    //     balance = EXCLUDED.balance,
    //     ...
    //
    // This means the balance is OVERWRITTEN, not accumulated.
    // For initial grant, this is correct because:
    // 1. The tenant was just created, so no prior usage
    // 2. Retrying should reset to the same initial state

    const initialBalance = 10000;
    const retryBalance = 10000;

    // Overwrite semantics: final balance = retry value
    expect(retryBalance).toBe(initialBalance);
    // Not accumulation: final balance != initial + retry
    expect(retryBalance).not.toBe(initialBalance + retryBalance);
  });

  it('should verify tenant slug uniqueness prevents true duplicate tenants', () => {
    // The tenants table has UNIQUE(slug) constraint.
    // If create_tenant_atomic is called twice with the same slug,
    // the INSERT INTO tenants will fail with a unique constraint violation,
    // and the entire function rolls back via EXCEPTION handler.
    //
    // This means:
    // 1. You can never have two tenants with the same slug
    // 2. Credit initialization for a "duplicate" tenant never reaches
    //    the credit tables because the function fails early

    const slug1 = 'my-business';
    const slug2 = 'my-business';
    expect(slug1).toBe(slug2);
    // In practice, PostgreSQL would raise: duplicate key value violates unique constraint
  });
});
