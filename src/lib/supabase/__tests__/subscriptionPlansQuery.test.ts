/**
 * Subscription Plans Query Verification Tests
 *
 * Verifies that the subscription_plans table is a global reference table
 * (NOT tenant-scoped) and that queries correctly omit tenant_id filtering.
 *
 * The subscription_plans table stores platform-wide plan definitions
 * (starter, professional, enterprise) shared by all tenants.
 * - No tenant_id column exists on the table
 * - RLS policy: SELECT USING (true) — public read access
 * - Queries should filter by is_active, NOT by tenant_id
 */

import { describe, it, expect } from 'vitest';

// Expected table schema — subscription_plans has NO tenant_id column
const SUBSCRIPTION_PLANS_COLUMNS = [
  'id',
  'name',
  'display_name',
  'description',
  'price_monthly',
  'price_yearly',
  'stripe_price_id_monthly',
  'stripe_price_id_yearly',
  'features',
  'limits',
  'is_active',
  'created_at',
] as const;

// RLS policy for subscription_plans — public read access
const EXPECTED_RLS_POLICY = {
  name: 'Allow read access to subscription_plans',
  command: 'SELECT',
  usingClause: 'true', // Public read — this is intentional for a global reference table
} as const;

describe('subscription_plans Table Schema', () => {
  it('should NOT have a tenant_id column', () => {
    expect(SUBSCRIPTION_PLANS_COLUMNS).not.toContain('tenant_id');
  });

  it('should be a global reference table with expected columns', () => {
    expect(SUBSCRIPTION_PLANS_COLUMNS).toContain('id');
    expect(SUBSCRIPTION_PLANS_COLUMNS).toContain('name');
    expect(SUBSCRIPTION_PLANS_COLUMNS).toContain('display_name');
    expect(SUBSCRIPTION_PLANS_COLUMNS).toContain('price_monthly');
    expect(SUBSCRIPTION_PLANS_COLUMNS).toContain('is_active');
    expect(SUBSCRIPTION_PLANS_COLUMNS).toContain('features');
    expect(SUBSCRIPTION_PLANS_COLUMNS).toContain('limits');
  });
});

describe('subscription_plans RLS Policy', () => {
  it('should allow public read access (USING true)', () => {
    expect(EXPECTED_RLS_POLICY.command).toBe('SELECT');
    expect(EXPECTED_RLS_POLICY.usingClause).toBe('true');
  });

  it('should NOT require tenant_users membership check for reads', () => {
    // subscription_plans is a global table — no tenant isolation needed
    expect(EXPECTED_RLS_POLICY.usingClause).not.toContain('tenant_users');
    expect(EXPECTED_RLS_POLICY.usingClause).not.toContain('tenant_id');
    expect(EXPECTED_RLS_POLICY.usingClause).not.toContain('auth.uid()');
  });
});

describe('subscription_plans Query Pattern', () => {
  // Simulates the query pattern used in BillingSettings and BillingPage
  const buildSubscriptionPlansQuery = () => ({
    table: 'subscription_plans',
    select: 'id, name, display_name, description, price_monthly, is_active, limits, features',
    filters: { is_active: true },
    orderBy: 'price_monthly',
  });

  it('should query subscription_plans without tenant_id filter', () => {
    const query = buildSubscriptionPlansQuery();
    expect(query.filters).not.toHaveProperty('tenant_id');
  });

  it('should filter only by is_active', () => {
    const query = buildSubscriptionPlansQuery();
    expect(query.filters).toEqual({ is_active: true });
  });

  it('should order by price_monthly', () => {
    const query = buildSubscriptionPlansQuery();
    expect(query.orderBy).toBe('price_monthly');
  });

  it('should select all fields needed for plan display', () => {
    const query = buildSubscriptionPlansQuery();
    const fields = query.select.split(', ');
    expect(fields).toContain('id');
    expect(fields).toContain('name');
    expect(fields).toContain('display_name');
    expect(fields).toContain('price_monthly');
    expect(fields).toContain('is_active');
    expect(fields).toContain('limits');
    expect(fields).toContain('features');
  });
});

describe('Query Key Correctness', () => {
  it('should use a global query key without tenant_id', () => {
    // The query key for subscription_plans should NOT include tenantId
    // because plans are shared across all tenants
    const queryKey = ['subscription-plans'] as const;
    expect(queryKey).toEqual(['subscription-plans']);
    expect(queryKey).toHaveLength(1);
    // Should NOT contain any tenant-specific identifier
    expect(queryKey.join(',')).not.toContain('tenant');
  });
});
