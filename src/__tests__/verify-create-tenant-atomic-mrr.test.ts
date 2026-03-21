/**
 * Verify create_tenant_atomic MRR values match TIER_PRICES
 *
 * Ensures the SQL function's MRR CASE statement stays in sync
 * with the canonical TIER_PRICES defined in featureConfig.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { TIER_PRICES } from '@/lib/featureConfig';

/**
 * Finds the latest migration file that defines create_tenant_atomic.
 * Migrations are applied in filename order, so the last one wins.
 */
function findLatestCreateTenantAtomicMigration(): string {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(migrationsDir).sort();

  let latestFile = '';
  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const content = readFileSync(join(migrationsDir, file), 'utf-8');
    if (content.includes('CREATE OR REPLACE FUNCTION public.create_tenant_atomic')) {
      latestFile = file;
    }
  }

  if (!latestFile) {
    throw new Error('No migration found defining create_tenant_atomic');
  }

  return join(migrationsDir, latestFile);
}

/**
 * Extracts MRR values from the SQL CASE statement in create_tenant_atomic.
 * Looks for patterns like: WHEN v_subscription_plan = 'starter' THEN 79
 */
function extractMrrValues(sql: string): Record<string, number> {
  const values: Record<string, number> = {};

  // Match MRR CASE block: the CASE leading into the mrr column value
  // Pattern: WHEN v_subscription_plan = '<plan>' THEN <number>
  // Also handle: WHEN v_is_free_tier THEN <number>
  const planPattern = /WHEN\s+v_subscription_plan\s*=\s*'(\w+)'\s+THEN\s+(\d+)/g;
  const freePattern = /WHEN\s+v_is_free_tier\s+THEN\s+(\d+)/;

  let match;
  while ((match = planPattern.exec(sql)) !== null) {
    values[match[1]] = parseInt(match[2], 10);
  }

  const freeMatch = sql.match(freePattern);
  if (freeMatch) {
    values['free'] = parseInt(freeMatch[1], 10);
  }

  return values;
}

describe('create_tenant_atomic MRR values match TIER_PRICES', () => {
  const migrationPath = findLatestCreateTenantAtomicMigration();
  const migrationContent = readFileSync(migrationPath, 'utf-8');

  it('should define create_tenant_atomic function', () => {
    expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.create_tenant_atomic');
  });

  it('should have an MRR CASE statement', () => {
    expect(migrationContent).toMatch(/CASE[\s\S]*?WHEN.*THEN\s+\d+[\s\S]*?END/);
  });

  it('should set starter MRR to $79 (matching TIER_PRICES.starter)', () => {
    const mrrValues = extractMrrValues(migrationContent);
    expect(mrrValues.starter).toBe(TIER_PRICES.starter);
  });

  it('should set professional MRR to $150 (matching TIER_PRICES.professional)', () => {
    const mrrValues = extractMrrValues(migrationContent);
    expect(mrrValues.professional).toBe(TIER_PRICES.professional);
  });

  it('should set enterprise MRR to $499 (matching TIER_PRICES.enterprise)', () => {
    const mrrValues = extractMrrValues(migrationContent);
    expect(mrrValues.enterprise).toBe(TIER_PRICES.enterprise);
  });

  it('should set free tier MRR to 0', () => {
    const mrrValues = extractMrrValues(migrationContent);
    expect(mrrValues.free).toBe(0);
  });

  it('should not contain old/stale MRR values in the function body', () => {
    // Extract only the function body (between $$ markers)
    const functionBody = migrationContent.match(/\$\$[\s\S]*?\$\$/);
    expect(functionBody).toBeTruthy();

    if (functionBody) {
      const body = functionBody[0];
      // Old prices that should NOT appear as MRR values
      expect(body).not.toMatch(/THEN\s+99\b/);
      expect(body).not.toMatch(/THEN\s+299\b/);
      expect(body).not.toMatch(/THEN\s+999\b/);
      expect(body).not.toMatch(/THEN\s+799\b/);
    }
  });

  it('should cover all TIER_PRICES tiers', () => {
    const mrrValues = extractMrrValues(migrationContent);
    const tierPriceKeys = Object.keys(TIER_PRICES) as Array<keyof typeof TIER_PRICES>;

    for (const tier of tierPriceKeys) {
      expect(mrrValues).toHaveProperty(tier);
      expect(mrrValues[tier]).toBe(TIER_PRICES[tier]);
    }
  });

  it('should use SECURITY DEFINER with search_path = public', () => {
    expect(migrationContent).toMatch(/SECURITY\s+DEFINER/i);
    expect(migrationContent).toMatch(/SET\s+search_path\s*=\s*public/i);
  });
});
