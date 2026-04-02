/**
 * credits-balance Edge Function Tests
 *
 * Since the edge function runs in Deno, these tests verify the source code
 * contract and response logic by reading the source file and testing
 * extracted business logic in a Node/vitest environment.
 *
 * Covers:
 * 1. Source code contract: imports, auth, tenant resolution, CORS
 * 2. Response format: camelCase shape matching frontend expectations
 * 3. isFreeTier determination: is_free_tier flag, fallback heuristics
 * 4. Default values when no credit row exists
 * 5. Error handling: missing auth, tenant errors, credits errors
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('credits-balance edge function', () => {
  const source = readSource();

  describe('shared deps import', () => {
    it('should import serve from shared deps', () => {
      expect(source).toContain("import { serve, createClient, corsHeaders } from '../_shared/deps.ts'");
    });

    it('should not define its own corsHeaders', () => {
      expect(source).not.toMatch(/const corsHeaders\s*=/);
    });
  });

  describe('CORS preflight', () => {
    it('should handle OPTIONS method for CORS preflight', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
      expect(source).toContain("headers: corsHeaders");
    });
  });

  describe('authentication', () => {
    it('should check for Authorization header', () => {
      expect(source).toContain("req.headers.get('Authorization')");
    });

    it('should return 401 when Authorization header is missing', () => {
      expect(source).toContain("'Missing authorization header'");
      expect(source).toContain('status: 401');
    });

    it('should validate JWT token via supabase.auth.getUser', () => {
      expect(source).toContain('supabase.auth.getUser(token)');
    });

    it('should return 401 for invalid token', () => {
      expect(source).toContain("JSON.stringify({ error: 'Unauthorized' })");
    });

    it('should extract Bearer token from Authorization header', () => {
      expect(source).toContain("authHeader.replace('Bearer ', '')");
    });
  });

  describe('service role client', () => {
    it('should use SUPABASE_URL env var', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_URL')");
    });

    it('should use SUPABASE_SERVICE_ROLE_KEY env var', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    });

    it('should use service role client to bypass RLS', () => {
      expect(source).toContain('createClient(');
      expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });
  });

  describe('tenant resolution', () => {
    it('should resolve tenant from tenant_users table', () => {
      expect(source).toContain(".from('tenant_users')");
    });

    it('should filter by user_id from validated JWT', () => {
      expect(source).toContain(".eq('user_id', user.id)");
    });

    it('should use maybeSingle for tenant lookup', () => {
      // Must use maybeSingle to gracefully handle missing tenant
      expect(source).toMatch(/tenant_users[\s\S]*?\.maybeSingle\(\)/);
    });

    it('should return 404 when no tenant found', () => {
      expect(source).toContain("'No tenant found for user'");
      expect(source).toContain('status: 404');
    });

    it('should return 500 when tenant lookup fails', () => {
      expect(source).toContain("'Failed to resolve tenant'");
    });
  });

  describe('tenant info fetch', () => {
    it('should fetch subscription info from tenants table', () => {
      expect(source).toContain(".from('tenants')");
    });

    it('should select required tenant fields', () => {
      expect(source).toContain('subscription_status');
      expect(source).toContain('subscription_plan');
      expect(source).toContain('credits_enabled');
      expect(source).toContain('is_free_tier');
    });

    it('should filter tenants by tenant id', () => {
      expect(source).toContain(".eq('id', tenantId)");
    });

    it('should use maybeSingle for tenant info', () => {
      // Second maybeSingle for the tenants table query
      const matches = source.match(/\.maybeSingle\(\)/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(3); // tenant_users, tenants, tenant_credits
    });

    it('should continue gracefully when tenant info fetch fails', () => {
      // tenantInfoError is non-fatal
      expect(source).toContain('Non-fatal: continue with default free tier assumption');
    });
  });

  describe('isFreeTier determination', () => {
    it('should check for professional plan', () => {
      expect(source).toContain("subscription_plan === 'professional'");
    });

    it('should check for enterprise plan', () => {
      expect(source).toContain("subscription_plan === 'enterprise'");
    });

    it('should check credits_enabled flag', () => {
      expect(source).toContain('credits_enabled === false');
    });

    it('should use is_free_tier as source of truth when non-null', () => {
      expect(source).toContain('is_free_tier != null');
      expect(source).toContain('is_free_tier === true');
    });

    it('should fallback to heuristic when is_free_tier is null', () => {
      // creditsDisabled ? false : !isPaidPlan
      expect(source).toContain('creditsDisabled ? false : !isPaidPlan');
    });
  });

  describe('credit balance fetch', () => {
    it('should query tenant_credits table', () => {
      expect(source).toContain(".from('tenant_credits')");
    });

    it('should filter by tenant_id', () => {
      expect(source).toContain(".eq('tenant_id', tenantId)");
    });

    it('should select all required credit fields', () => {
      const requiredFields = [
        'balance',
        'lifetime_earned',
        'lifetime_spent',
        'free_credits_balance',
        'purchased_credits_balance',
        'free_credits_expires_at',
        'last_free_grant_at',
        'next_free_grant_at',
        'created_at',
        'updated_at',
      ];
      for (const field of requiredFields) {
        expect(source).toContain(field);
      }
    });

    it('should return 500 on credit fetch error', () => {
      expect(source).toContain("'Failed to fetch credit balance'");
    });

    it('should use maybeSingle for credits (one row per tenant)', () => {
      expect(source).toMatch(/tenant_credits[\s\S]*?\.maybeSingle\(\)/);
    });
  });

  describe('zero-balance default', () => {
    it('should provide zero-balance default when no credits row exists', () => {
      expect(source).toContain('credits ?? {');
      expect(source).toContain('balance: 0');
      expect(source).toContain('lifetime_earned: 0');
      expect(source).toContain('lifetime_spent: 0');
      expect(source).toContain('free_credits_balance: 0');
      expect(source).toContain('purchased_credits_balance: 0');
    });
  });

  describe('pending transactions', () => {
    it('should query credit_transactions table', () => {
      expect(source).toContain(".from('credit_transactions')");
    });

    it('should filter for debit transactions only', () => {
      expect(source).toContain(".eq('transaction_type', 'debit')");
    });

    it('should order by created_at descending', () => {
      expect(source).toContain(".order('created_at', { ascending: false })");
    });

    it('should limit to 50 transactions', () => {
      expect(source).toContain('.limit(50)');
    });

    it('should handle pending transaction errors gracefully', () => {
      expect(source).toContain('Non-fatal: continue with empty pending list');
    });
  });

  describe('response format (camelCase)', () => {
    it('should define CreditsBalanceResponse interface', () => {
      expect(source).toContain('interface CreditsBalanceResponse');
    });

    it('should include balance field', () => {
      expect(source).toContain('balance: creditBalance.balance');
    });

    it('should include lifetimeStats with camelCase fields', () => {
      expect(source).toContain('lifetimeStats:');
      expect(source).toContain('earned: creditBalance.lifetime_earned');
      expect(source).toContain('spent: creditBalance.lifetime_spent');
      expect(source).toContain('purchased: creditBalance.purchased_credits_balance');
    });

    it('should include expired and refunded as zero (not yet tracked)', () => {
      expect(source).toContain('expired: 0');
      expect(source).toContain('refunded: 0');
    });

    it('should include subscription info', () => {
      expect(source).toContain('subscription: subscriptionResponse');
    });

    it('should include nextFreeGrantAt', () => {
      expect(source).toContain('nextFreeGrantAt: creditBalance.next_free_grant_at');
    });

    it('should include pendingTransactions count', () => {
      expect(source).toContain('pendingTransactions:');
      expect(source).toContain('.length');
    });

    it('should return 200 on success', () => {
      expect(source).toContain('status: 200');
    });

    it('should set Content-Type to application/json', () => {
      expect(source).toContain("'Content-Type': 'application/json'");
    });
  });

  describe('subscription response', () => {
    it('should define SubscriptionInfo interface', () => {
      expect(source).toContain('interface SubscriptionInfo');
    });

    it('should include standard subscription statuses', () => {
      expect(source).toContain("'active'");
      expect(source).toContain("'trial'");
      expect(source).toContain("'cancelled'");
      expect(source).toContain("'none'");
    });

    it('should include isFreeTier in subscription response', () => {
      expect(source).toContain('isFreeTier,');
    });

    it('should default subscription status to none', () => {
      expect(source).toContain("status: 'none'");
    });
  });

  describe('error handling', () => {
    it('should have outer try-catch for unhandled errors', () => {
      expect(source).toContain('} catch (error)');
      expect(source).toContain("'Internal server error'");
    });

    it('should return 500 for unhandled errors', () => {
      expect(source).toContain('status: 500');
    });

    it('should include error message when error is an Error instance', () => {
      expect(source).toContain('error instanceof Error ? error.message');
    });

    it('should include CORS headers in all error responses', () => {
      // Count corsHeaders usage - should appear in every response
      const corsUsages = source.match(/corsHeaders/g);
      expect(corsUsages).not.toBeNull();
      expect(corsUsages!.length).toBeGreaterThanOrEqual(6); // preflight + auth errors + tenant + credits + success + catch
    });
  });
});

describe('credits-balance isFreeTier logic', () => {
  /**
   * Extracted from edge function — must stay in sync.
   * Tests the exact branching logic used server-side.
   */
  function edgeFunctionIsFreeTier(tenantData: {
    subscription_plan?: string | null;
    credits_enabled?: boolean | null;
    is_free_tier?: boolean | null;
  } | null): boolean {
    const isPaidPlan =
      tenantData?.subscription_plan === 'professional' ||
      tenantData?.subscription_plan === 'enterprise';
    const creditsDisabled = tenantData?.credits_enabled === false;

    return tenantData?.is_free_tier != null
      ? tenantData.is_free_tier === true
      : creditsDisabled
        ? false
        : !isPaidPlan;
  }

  describe('when is_free_tier flag is set (source of truth)', () => {
    it('should return true when is_free_tier=true', () => {
      expect(edgeFunctionIsFreeTier({ is_free_tier: true })).toBe(true);
    });

    it('should return false when is_free_tier=false', () => {
      expect(edgeFunctionIsFreeTier({ is_free_tier: false })).toBe(false);
    });

    it('should ignore subscription_plan when is_free_tier is set', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: true,
          subscription_plan: 'enterprise',
        })
      ).toBe(true);
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: false,
          subscription_plan: 'free',
        })
      ).toBe(false);
    });

    it('should ignore credits_enabled when is_free_tier is set', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: true,
          credits_enabled: false,
        })
      ).toBe(true);
    });
  });

  describe('fallback when is_free_tier is null (legacy tenants)', () => {
    it('should return false when credits are disabled', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: null,
          credits_enabled: false,
          subscription_plan: 'free',
        })
      ).toBe(false);
    });

    it('should return false for professional plan', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: null,
          credits_enabled: true,
          subscription_plan: 'professional',
        })
      ).toBe(false);
    });

    it('should return false for enterprise plan', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: null,
          credits_enabled: true,
          subscription_plan: 'enterprise',
        })
      ).toBe(false);
    });

    it('should return true for free plan with credits enabled', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: null,
          credits_enabled: true,
          subscription_plan: 'free',
        })
      ).toBe(true);
    });

    it('should return true for starter plan with credits enabled', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: null,
          credits_enabled: true,
          subscription_plan: 'starter',
        })
      ).toBe(true);
    });

    it('should return true when subscription_plan is null', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: null,
          subscription_plan: null,
        })
      ).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return true for null tenantData', () => {
      expect(edgeFunctionIsFreeTier(null)).toBe(true);
    });

    it('should return true for empty object', () => {
      expect(edgeFunctionIsFreeTier({})).toBe(true);
    });

    it('should treat undefined credits_enabled as not disabled', () => {
      expect(
        edgeFunctionIsFreeTier({
          is_free_tier: null,
          subscription_plan: 'free',
        })
      ).toBe(true);
    });
  });
});

describe('credits-balance response defaults', () => {
  const DEFAULT_CREDIT_BALANCE = {
    balance: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
    free_credits_balance: 0,
    purchased_credits_balance: 0,
    free_credits_expires_at: null,
    last_free_grant_at: null,
    next_free_grant_at: null,
  };

  it('should default balance to 0', () => {
    expect(DEFAULT_CREDIT_BALANCE.balance).toBe(0);
  });

  it('should default all lifetime stats to 0', () => {
    expect(DEFAULT_CREDIT_BALANCE.lifetime_earned).toBe(0);
    expect(DEFAULT_CREDIT_BALANCE.lifetime_spent).toBe(0);
    expect(DEFAULT_CREDIT_BALANCE.free_credits_balance).toBe(0);
    expect(DEFAULT_CREDIT_BALANCE.purchased_credits_balance).toBe(0);
  });

  it('should default all date fields to null', () => {
    expect(DEFAULT_CREDIT_BALANCE.free_credits_expires_at).toBeNull();
    expect(DEFAULT_CREDIT_BALANCE.last_free_grant_at).toBeNull();
    expect(DEFAULT_CREDIT_BALANCE.next_free_grant_at).toBeNull();
  });

  describe('response shape matches frontend CreditsBalanceResponse', () => {
    interface CreditsBalanceResponse {
      balance: number;
      lifetimeStats: {
        earned: number;
        spent: number;
        purchased: number;
        expired: number;
        refunded: number;
      };
      subscription: {
        status: string;
        isFreeTier: boolean;
        creditsPerPeriod: number;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
      };
      nextFreeGrantAt: string | null;
      pendingTransactions: number;
    }

    function buildDefaultResponse(): CreditsBalanceResponse {
      return {
        balance: DEFAULT_CREDIT_BALANCE.balance,
        lifetimeStats: {
          earned: DEFAULT_CREDIT_BALANCE.lifetime_earned,
          spent: DEFAULT_CREDIT_BALANCE.lifetime_spent,
          purchased: DEFAULT_CREDIT_BALANCE.purchased_credits_balance,
          expired: 0,
          refunded: 0,
        },
        subscription: {
          status: 'none',
          isFreeTier: true,
          creditsPerPeriod: 0,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
        nextFreeGrantAt: DEFAULT_CREDIT_BALANCE.next_free_grant_at,
        pendingTransactions: 0,
      };
    }

    it('should produce valid response shape with all required fields', () => {
      const response = buildDefaultResponse();
      expect(response).toHaveProperty('balance');
      expect(response).toHaveProperty('lifetimeStats');
      expect(response).toHaveProperty('subscription');
      expect(response).toHaveProperty('nextFreeGrantAt');
      expect(response).toHaveProperty('pendingTransactions');
    });

    it('should have correct lifetimeStats shape', () => {
      const response = buildDefaultResponse();
      expect(response.lifetimeStats).toHaveProperty('earned');
      expect(response.lifetimeStats).toHaveProperty('spent');
      expect(response.lifetimeStats).toHaveProperty('purchased');
      expect(response.lifetimeStats).toHaveProperty('expired');
      expect(response.lifetimeStats).toHaveProperty('refunded');
    });

    it('should have correct subscription shape', () => {
      const response = buildDefaultResponse();
      expect(response.subscription).toHaveProperty('status');
      expect(response.subscription).toHaveProperty('isFreeTier');
      expect(response.subscription).toHaveProperty('creditsPerPeriod');
      expect(response.subscription).toHaveProperty('currentPeriodEnd');
      expect(response.subscription).toHaveProperty('cancelAtPeriodEnd');
    });

    it('should have numeric pendingTransactions (not array)', () => {
      const response = buildDefaultResponse();
      expect(typeof response.pendingTransactions).toBe('number');
    });

    it('should have boolean isFreeTier', () => {
      const response = buildDefaultResponse();
      expect(typeof response.subscription.isFreeTier).toBe('boolean');
    });
  });
});
