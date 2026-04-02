/**
 * Credits Subscribe Edge Function Tests
 *
 * Static analysis tests that verify the credits-subscribe edge function:
 * 1. Returns 401 before 500 when auth is missing (auth check comes first)
 * 2. Handles OPTIONS preflight
 * 3. Validates request body with Zod
 * 4. Uses proper CORS headers
 * 5. Uses logger instead of console.log
 * 6. Uses .maybeSingle() for optional queries
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FUNCTION_DIR = path.resolve(
  __dirname,
  '../../../../supabase/functions/credits-subscribe',
);
const INDEX_PATH = path.join(FUNCTION_DIR, 'index.ts');

function readSource(): string {
  return fs.readFileSync(INDEX_PATH, 'utf-8');
}

describe('credits-subscribe edge function', () => {
  it('should exist', () => {
    expect(fs.existsSync(INDEX_PATH)).toBe(true);
  });

  describe('authentication ordering', () => {
    it('should check Authorization header before env var / Stripe checks', () => {
      const source = readSource();
      const authHeaderIndex = source.indexOf(
        "req.headers.get('Authorization')",
      );
      const stripeCheckIndex = source.indexOf('STRIPE_SECRET_KEY');
      const createClientIndex = source.indexOf('createClient(');

      // Auth header check must appear before Stripe config and client creation
      expect(authHeaderIndex).toBeGreaterThan(-1);
      expect(stripeCheckIndex).toBeGreaterThan(-1);
      expect(createClientIndex).toBeGreaterThan(-1);
      expect(authHeaderIndex).toBeLessThan(stripeCheckIndex);
      expect(authHeaderIndex).toBeLessThan(createClientIndex);
    });

    it('should return 401 for missing auth before any 500 response', () => {
      const source = readSource();
      const lines = source.split('\n');

      // Find the first 401 response and the first 500 response
      let first401Line = -1;
      let first500Line = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('status: 401') && first401Line === -1) {
          first401Line = i;
        }
        if (lines[i].includes('status: 500') && first500Line === -1) {
          first500Line = i;
        }
      }

      expect(first401Line).toBeGreaterThan(-1);
      expect(first500Line).toBeGreaterThan(-1);
      expect(first401Line).toBeLessThan(first500Line);
    });

    it('should return 401 with error message for missing authorization', () => {
      const source = readSource();
      // The 401 response for missing auth should include an error field
      const authCheckBlock = source.slice(
        source.indexOf("req.headers.get('Authorization')"),
        source.indexOf('SUPABASE_URL'),
      );
      expect(authCheckBlock).toContain('status: 401');
      expect(authCheckBlock).toContain('error');
    });
  });

  describe('CORS compliance', () => {
    it('should handle OPTIONS preflight requests', () => {
      const source = readSource();
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should include CORS headers via shared deps', () => {
      const source = readSource();
      expect(source).toContain('corsHeaders');
      expect(source).toContain("'../_shared/deps");
    });
  });

  describe('request validation', () => {
    it('should validate request body with Zod schema', () => {
      const source = readSource();
      expect(source).toContain('z.object');
      expect(source).toContain('RequestSchema.parse');
    });

    it('should require tenant_id as UUID', () => {
      const source = readSource();
      expect(source).toContain("tenant_id: z.string().uuid()");
    });

    it('should require package_id as UUID', () => {
      const source = readSource();
      expect(source).toContain("package_id: z.string().uuid()");
    });

    it('should require payment_method_id', () => {
      const source = readSource();
      expect(source).toContain('payment_method_id: z.string().min(1)');
    });

    it('should return 400 for Zod validation errors', () => {
      const source = readSource();
      expect(source).toContain('z.ZodError');
      expect(source).toContain('status: 400');
    });
  });

  describe('tenant isolation', () => {
    it('should filter credit_packages by is_active', () => {
      const source = readSource();
      expect(source).toContain(".eq('is_active', true)");
    });

    it('should filter credit_packages by subscription type', () => {
      const source = readSource();
      expect(source).toContain(".eq('package_type', 'subscription')");
    });

    it('should filter tenants by tenant_id', () => {
      const source = readSource();
      expect(source).toContain(".eq('id', tenant_id)");
    });

    it('should verify user has admin/owner access to tenant', () => {
      const source = readSource();
      expect(source).toContain('tenant_users');
      expect(source).toContain("'admin'");
      expect(source).toContain("'owner'");
      expect(source).toContain('status: 403');
    });

    it('should check for existing active subscription', () => {
      const source = readSource();
      expect(source).toContain('credit_subscriptions');
      expect(source).toContain("'active', 'trialing'");
      expect(source).toContain('status: 409');
    });
  });

  describe('query safety', () => {
    it('should use .maybeSingle() for optional queries', () => {
      const source = readSource();
      const maybeSingleCount = (source.match(/\.maybeSingle\(\)/g) || [])
        .length;
      // Should have maybeSingle for: credit_packages, tenants, tenant_users,
      // existing subscription, tenant_credits
      expect(maybeSingleCount).toBeGreaterThanOrEqual(4);
    });

    it('should not use .single() for optional lookups', () => {
      const source = readSource();
      const singleCalls = (source.match(/\.single\(\)/g) || []).length;
      // .single() is acceptable for INSERT...select().single() (the subscription insert)
      // but should not be used for SELECT queries on optional data
      expect(singleCalls).toBeLessThanOrEqual(1);
    });
  });

  describe('logging', () => {
    it('should use logger from shared deps, not console.log', () => {
      const source = readSource();
      expect(source).toContain('createLogger');
      expect(source).not.toContain('console.log');
    });

    it('should log success with subscription details', () => {
      const source = readSource();
      expect(source).toContain('logger.info');
      expect(source).toContain('Credit subscription created successfully');
    });

    it('should log errors', () => {
      const source = readSource();
      expect(source).toContain('logger.error');
    });
  });

  describe('error response format', () => {
    it('should return { error: string } format (not { success: false })', () => {
      const source = readSource();
      const lines = source.split('\n');
      const violations: string[] = [];

      const badPattern = /JSON\.stringify\(\{\s*success:\s*false/;
      for (let i = 0; i < lines.length; i++) {
        if (badPattern.test(lines[i])) {
          violations.push(`  line ${i + 1}: ${lines[i].trim()}`);
        }
      }

      expect(violations).toHaveLength(0);
    });

    it('should include CORS headers in all error responses', () => {
      const source = readSource();
      const lines = source.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (/status:\s*(4\d\d|5\d\d)/.test(lines[i])) {
          // Look back up to 5 lines for corsHeaders
          const chunk = lines.slice(Math.max(0, i - 5), i + 1).join(' ');
          expect(chunk).toContain('corsHeaders');
        }
      }
    });
  });

  describe('Stripe integration', () => {
    it('should create Stripe subscription with metadata', () => {
      const source = readSource();
      expect(source).toContain('stripe.subscriptions.create');
      expect(source).toContain('tenant_id');
      expect(source).toContain('package_id');
      expect(source).toContain("type: 'credit_subscription'");
    });

    it('should cancel Stripe subscription on DB insert failure', () => {
      const source = readSource();
      expect(source).toContain('stripe.subscriptions.cancel');
    });

    it('should use getOrCreateStripeCustomer for idempotent customer creation', () => {
      const source = readSource();
      expect(source).toContain('getOrCreateStripeCustomer');
    });
  });
});
