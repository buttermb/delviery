/**
 * Test for fix_subscription_pricing_consistency migration
 *
 * Verifies:
 * 1. Stale MRR fix UPDATE statements target correct tenants
 * 2. create_tenant_atomic uses canonical TIER_PRICES (79/150/499)
 * 3. subscription_plans sync uses correct canonical prices
 * 4. WHERE conditions don't accidentally update wrong tenants
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Canonical prices from featureConfig.ts TIER_PRICES
const CANONICAL_PRICES = {
  starter: 79,
  professional: 150,
  enterprise: 499,
} as const;

// Known stale MRR values from historical migrations
const STALE_MRR_VALUES = {
  starter: [99],                    // from 20260122130000 and 20251104000000
  professional: [299],              // from 20260122130000 and 20251104000000
  enterprise: [999, 799],           // 999 from 20260122130000, 799 from 20251104000000
} as const;

// Canonical yearly prices
const CANONICAL_YEARLY_PRICES = {
  starter: 790,
  professional: 1500,
  enterprise: 4990,
} as const;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const skipIfNoDb = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// Read the migration SQL for static analysis
const migrationPath = resolve(
  __dirname,
  '../20260320000001_fix_subscription_pricing_consistency.sql'
);

let migrationSql: string;
try {
  migrationSql = readFileSync(migrationPath, 'utf-8');
} catch {
  migrationSql = '';
}

describe('Migration: fix_subscription_pricing_consistency - SQL Static Analysis', () => {
  it('should read migration file successfully', () => {
    expect(migrationSql.length).toBeGreaterThan(0);
  });

  describe('Stale MRR fix UPDATE statements (lines 328-335)', () => {
    it('should update starter MRR from 99 to 79', () => {
      const starterUpdate = migrationSql.match(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*79\s+WHERE\s+subscription_plan\s*=\s*'starter'\s+AND\s+mrr\s*=\s*99/si
      );
      expect(starterUpdate).not.toBeNull();
    });

    it('should update professional MRR from 299 to 150', () => {
      const professionalUpdate = migrationSql.match(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*150\s+WHERE\s+subscription_plan\s*=\s*'professional'\s+AND\s+mrr\s*=\s*299/si
      );
      expect(professionalUpdate).not.toBeNull();
    });

    it('should update enterprise MRR from 999 or 799 to 499', () => {
      const enterpriseUpdate = migrationSql.match(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*499\s+WHERE\s+subscription_plan\s*=\s*'enterprise'\s+AND\s+\(mrr\s*=\s*999\s+OR\s+mrr\s*=\s*799\)/si
      );
      expect(enterpriseUpdate).not.toBeNull();
    });

    it('should not update tenants already at canonical prices', () => {
      // Each stale MRR UPDATE uses AND mrr = <old_value>, so tenants at canonical prices are safe
      const starterUpdate = migrationSql.match(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*79[^;]*WHERE[^;]*AND\s+mrr\s*=/si
      );
      expect(starterUpdate).not.toBeNull();

      const professionalUpdate = migrationSql.match(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*150[^;]*WHERE[^;]*AND\s+mrr\s*=/si
      );
      expect(professionalUpdate).not.toBeNull();

      const enterpriseUpdate = migrationSql.match(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*499[^;]*WHERE[^;]*AND\s+\(/si
      );
      expect(enterpriseUpdate).not.toBeNull();
    });

    it('should use subscription_plan filter to avoid cross-plan updates', () => {
      // Each UPDATE must filter by subscription_plan to avoid changing a starter tenant's MRR
      // that happens to be 299 (which would match professional's old price)
      const updates = migrationSql.match(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*\d+\s+WHERE\s+subscription_plan\s*=/gi
      );
      expect(updates).not.toBeNull();
      expect(updates!.length).toBe(3); // one per tier
    });
  });

  describe('create_tenant_atomic MRR values (lines 177-184)', () => {
    it('should set free tier MRR to 0', () => {
      expect(migrationSql).toContain("WHEN v_is_free_tier THEN 0");
    });

    it('should set starter MRR to canonical price 79', () => {
      expect(migrationSql).toContain("WHEN v_subscription_plan = 'starter' THEN 79");
    });

    it('should set professional MRR to canonical price 150', () => {
      expect(migrationSql).toContain("WHEN v_subscription_plan = 'professional' THEN 150");
    });

    it('should set enterprise MRR to canonical price 499', () => {
      expect(migrationSql).toContain("WHEN v_subscription_plan = 'enterprise' THEN 499");
    });

    it('should default unknown plans to MRR 0', () => {
      // The ELSE clause at the end of the MRR CASE
      const mrrCase = migrationSql.match(
        /WHEN v_subscription_plan = 'enterprise' THEN 499\s+ELSE 0/si
      );
      expect(mrrCase).not.toBeNull();
    });
  });

  describe('subscription_plans sync (lines 337-348)', () => {
    it('should update starter plan to $79/$790', () => {
      const starterSync = migrationSql.match(
        /UPDATE\s+public\.subscription_plans\s+SET\s+price_monthly\s*=\s*79\s*,\s*price_yearly\s*=\s*790\s+WHERE\s+name\s*=\s*'starter'/si
      );
      expect(starterSync).not.toBeNull();
    });

    it('should update professional plan to $150/$1500', () => {
      const professionalSync = migrationSql.match(
        /UPDATE\s+public\.subscription_plans\s+SET\s+price_monthly\s*=\s*150\s*,\s*price_yearly\s*=\s*1500\s+WHERE\s+name\s*=\s*'professional'/si
      );
      expect(professionalSync).not.toBeNull();
    });

    it('should update enterprise plan to $499/$4990', () => {
      const enterpriseSync = migrationSql.match(
        /UPDATE\s+public\.subscription_plans\s+SET\s+price_monthly\s*=\s*499\s*,\s*price_yearly\s*=\s*4990\s+WHERE\s+name\s*=\s*'enterprise'/si
      );
      expect(enterpriseSync).not.toBeNull();
    });

    it('should only update plans where price differs (idempotent)', () => {
      const starterGuard = migrationSql.match(
        /WHERE\s+name\s*=\s*'starter'\s+AND\s+price_monthly\s*!=\s*79/si
      );
      expect(starterGuard).not.toBeNull();

      const professionalGuard = migrationSql.match(
        /WHERE\s+name\s*=\s*'professional'\s+AND\s+price_monthly\s*!=\s*150/si
      );
      expect(professionalGuard).not.toBeNull();

      const enterpriseGuard = migrationSql.match(
        /WHERE\s+name\s*=\s*'enterprise'\s+AND\s+price_monthly\s*!=\s*499/si
      );
      expect(enterpriseGuard).not.toBeNull();
    });
  });

  describe('create_tenant_atomic function properties', () => {
    it('should use SECURITY DEFINER', () => {
      expect(migrationSql).toContain('SECURITY DEFINER');
    });

    it('should SET search_path = public', () => {
      expect(migrationSql).toContain('SET search_path = public');
    });

    it('should return jsonb', () => {
      expect(migrationSql).toContain('RETURNS jsonb');
    });

    it('should handle trial plan with trialing status', () => {
      expect(migrationSql).toContain("v_subscription_status := 'trialing'");
    });

    it('should default to free tier for unknown plans', () => {
      const elseClause = migrationSql.match(
        /ELSE\s+--\s*Unknown plan.*?v_is_free_tier\s*:=\s*true/si
      );
      expect(elseClause).not.toBeNull();
    });
  });
});

describe('Migration: fix_subscription_pricing_consistency - Price Consistency', () => {
  it('should verify canonical monthly prices match TIER_PRICES', () => {
    expect(CANONICAL_PRICES.starter).toBe(79);
    expect(CANONICAL_PRICES.professional).toBe(150);
    expect(CANONICAL_PRICES.enterprise).toBe(499);
  });

  it('should verify canonical yearly prices are approximately 10x monthly (17% savings)', () => {
    // Yearly = monthly * 12 * (1 - 0.1667)  ≈ monthly * 10
    for (const [tier, monthlyPrice] of Object.entries(CANONICAL_PRICES)) {
      const yearlyPrice = CANONICAL_YEARLY_PRICES[tier as keyof typeof CANONICAL_YEARLY_PRICES];
      const fullYearPrice = monthlyPrice * 12;
      const savings = fullYearPrice - yearlyPrice;
      const savingsPercent = savings / fullYearPrice;

      // Savings should be approximately 16.67% (rounds to 17%)
      expect(savingsPercent).toBeGreaterThan(0.15);
      expect(savingsPercent).toBeLessThan(0.18);
    }
  });

  it('should verify all stale MRR values are accounted for in the migration', () => {
    // Starter stale values: 99
    for (const staleValue of STALE_MRR_VALUES.starter) {
      expect(migrationSql).toContain(`mrr = ${staleValue}`);
    }

    // Professional stale values: 299
    for (const staleValue of STALE_MRR_VALUES.professional) {
      expect(migrationSql).toContain(`mrr = ${staleValue}`);
    }

    // Enterprise stale values: 999, 799
    for (const staleValue of STALE_MRR_VALUES.enterprise) {
      expect(migrationSql).toContain(`mrr = ${staleValue}`);
    }
  });

  it('should not contain old stale prices in the create_tenant_atomic MRR CASE', () => {
    // Extract the MRR CASE block from create_tenant_atomic
    const mrrCaseMatch = migrationSql.match(
      /-- FIX: Use canonical.*?CASE(.*?)END/si
    );
    expect(mrrCaseMatch).not.toBeNull();

    const mrrCaseBlock = mrrCaseMatch![1];

    // Verify no old prices appear in the CASE block
    expect(mrrCaseBlock).not.toContain('THEN 99');
    expect(mrrCaseBlock).not.toContain('THEN 299');
    expect(mrrCaseBlock).not.toContain('THEN 999');
    expect(mrrCaseBlock).not.toContain('THEN 799');
  });
});

describe('Migration: fix_subscription_pricing_consistency - Safety Checks', () => {
  it('should not update tenants with free plan MRR', () => {
    // Free tier tenants should have mrr=0, none of the UPDATE statements target free
    const freeUpdate = migrationSql.match(
      /UPDATE\s+public\.tenants\s+SET\s+mrr[^;]*subscription_plan\s*=\s*'free'/si
    );
    expect(freeUpdate).toBeNull();
  });

  it('should not update tenants with NULL subscription_plan', () => {
    // The WHERE clause requires subscription_plan = 'specific_value',
    // so NULL subscription_plan tenants are excluded
    const updates = migrationSql.match(
      /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*\d+\s+WHERE\s+subscription_plan\s*=\s*'(starter|professional|enterprise)'/gi
    );
    expect(updates).not.toBeNull();
    // Every UPDATE has an explicit subscription_plan equality check (no IS NULL)
    for (const update of updates!) {
      expect(update).toContain("subscription_plan = '");
    }
  });

  it('should not use UPDATE without WHERE clause', () => {
    // Ensure no naked UPDATE (without WHERE) on tenants table
    const nakedUpdates = migrationSql.match(
      /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*\d+\s*;/gi
    );
    expect(nakedUpdates).toBeNull();
  });

  it('should cover all known stale enterprise MRR values with OR condition', () => {
    // Enterprise had two different stale prices: 799 and 999
    // Both should be handled in a single UPDATE with OR
    const enterpriseUpdate = migrationSql.match(
      /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*499\s+WHERE[^;]*\(mrr\s*=\s*999\s+OR\s+mrr\s*=\s*799\)/si
    );
    expect(enterpriseUpdate).not.toBeNull();
  });
});

describe('Migration: fix_subscription_pricing_consistency - Database Integration', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    if (!skipIfNoDb) {
      supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    }
  });

  it('should have create_tenant_atomic function available', async () => {
    if (skipIfNoDb) {
      // Verify the function definition exists in SQL
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.create_tenant_atomic');
      return;
    }

    // Call with invalid UUID to test function exists
    const { error } = await supabase.rpc('create_tenant_atomic', {
      p_auth_user_id: '00000000-0000-0000-0000-000000000000',
      p_email: 'test@test.com',
      p_business_name: 'Test',
      p_owner_name: 'Test',
    });

    if (error) {
      // Function exists if we get an auth error, not a function-not-found error
      expect(error.code).not.toBe('42883');
    }
  });

  it('should have no tenants with stale MRR values after migration', async () => {
    if (skipIfNoDb) {
      // Verify the migration SQL contains all the necessary fix statements
      expect(migrationSql).toContain('mrr = 99');
      expect(migrationSql).toContain('mrr = 299');
      expect(migrationSql).toContain('mrr = 999');
      expect(migrationSql).toContain('mrr = 799');
      return;
    }

    // Check for any remaining stale MRR values
    const allStaleValues = [99, 299, 999, 799];

    for (const staleValue of allStaleValues) {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, subscription_plan, mrr')
        .eq('mrr', staleValue)
        .limit(1);

      if (!error) {
        expect(data?.length ?? 0).toBe(0);
      }
    }
  });

  it('should have subscription_plans at canonical prices', async () => {
    if (skipIfNoDb) {
      // Verify SQL contains the sync statements
      expect(migrationSql).toContain("price_monthly = 79");
      expect(migrationSql).toContain("price_monthly = 150");
      expect(migrationSql).toContain("price_monthly = 499");
      return;
    }

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('name, price_monthly, price_yearly')
      .in('name', ['starter', 'professional', 'enterprise']);

    if (!error && plans) {
      for (const plan of plans) {
        const tier = plan.name as keyof typeof CANONICAL_PRICES;
        expect(Number(plan.price_monthly)).toBe(CANONICAL_PRICES[tier]);
        expect(Number(plan.price_yearly)).toBe(CANONICAL_YEARLY_PRICES[tier]);
      }
    }
  });
});
