/**
 * Credits Cancel Subscription Edge Function — Source Analysis Tests
 *
 * Verifies:
 * 1. Auth check runs before infrastructure checks (returns 401, not 500)
 * 2. HTTP method validation (POST only)
 * 3. Input validation with Zod (subscription_id UUID, cancel_immediately boolean)
 * 4. Safe JSON parsing (returns 400 on invalid JSON, not 500)
 * 5. Subscription ownership verification (filters by user_id)
 * 6. Stripe API integration (immediate DELETE vs period-end POST)
 * 7. Prorated credit deduction on immediate cancellation
 * 8. Tenant isolation (tenant_id on all queries)
 * 9. Analytics and transaction logging
 * 10. Proper CORS handling
 * 11. Uses shared errorResponse helper
 * 12. Uses shared deps imports
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('credits-cancel-subscription edge function', () => {
  const source = readSource();

  describe('authentication — must return 401 before any other error', () => {
    it('should check Authorization header before Stripe config', () => {
      const authCheckIndex = source.indexOf("req.headers.get('Authorization')");
      const stripeCheckIndex = source.indexOf("Deno.env.get('STRIPE_SECRET_KEY')");
      expect(authCheckIndex).toBeGreaterThan(-1);
      expect(stripeCheckIndex).toBeGreaterThan(-1);
      expect(authCheckIndex).toBeLessThan(stripeCheckIndex);
    });

    it('should return 401 for missing Authorization header', () => {
      expect(source).toContain("return errorResponse(401, 'Missing authorization header')");
    });

    it('should return 401 for invalid token', () => {
      expect(source).toContain("return errorResponse(401, 'Unauthorized')");
    });

    it('should verify user via supabase.auth.getUser', () => {
      expect(source).toContain('supabase.auth.getUser(token)');
    });

    it('should check both authError and !user', () => {
      expect(source).toContain('if (authError || !user)');
    });
  });

  describe('HTTP method validation', () => {
    it('should handle OPTIONS for CORS preflight', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should reject non-POST methods with 405', () => {
      expect(source).toContain("req.method !== 'POST'");
      expect(source).toContain("errorResponse(405, 'Method not allowed')");
    });
  });

  describe('input validation', () => {
    it('should define Zod schema for request body', () => {
      expect(source).toContain('z.object({');
      expect(source).toContain("subscription_id: z.string().uuid(");
      expect(source).toContain('cancel_immediately: z.boolean().default(false)');
    });

    it('should use safeParse for validation', () => {
      expect(source).toContain('requestSchema.safeParse(body)');
    });

    it('should return 400 with VALIDATION_ERROR code on invalid input', () => {
      expect(source).toContain("'Validation failed'");
      expect(source).toContain("'VALIDATION_ERROR'");
    });

    it('should safely parse JSON body with try-catch', () => {
      expect(source).toContain('body = await req.json()');
      expect(source).toContain("return errorResponse(400, 'Invalid JSON body')");
    });
  });

  describe('subscription ownership verification', () => {
    it('should query credit_subscriptions table', () => {
      expect(source).toContain("from('credit_subscriptions')");
    });

    it('should filter by subscription_id', () => {
      expect(source).toContain("eq('id', subscription_id)");
    });

    it('should filter by user_id for ownership check', () => {
      expect(source).toContain("eq('user_id', user.id)");
    });

    it('should use maybeSingle for optional result', () => {
      expect(source).toContain('.maybeSingle()');
    });

    it('should return 404 when subscription not found', () => {
      expect(source).toContain("errorResponse(404, 'Subscription not found')");
    });

    it('should return 400 when subscription already cancelled', () => {
      expect(source).toContain("errorResponse(400, 'Subscription is already cancelled')");
    });

    it('should return 400 when no Stripe subscription associated', () => {
      expect(source).toContain("errorResponse(400, 'No Stripe subscription associated')");
    });
  });

  describe('Stripe API integration', () => {
    it('should call Stripe subscriptions API endpoint', () => {
      expect(source).toContain('https://api.stripe.com/v1/subscriptions/');
    });

    it('should use DELETE method for immediate cancellation', () => {
      expect(source).toContain("method: 'DELETE'");
    });

    it('should use POST method with cancel_at_period_end for period-end cancellation', () => {
      expect(source).toContain("'cancel_at_period_end': 'true'");
    });

    it('should authorize with Bearer token', () => {
      expect(source).toContain('`Bearer ${stripeSecretKey}`');
    });

    it('should return 502 on Stripe failure for immediate cancel', () => {
      expect(source).toContain("errorResponse(502, 'Failed to cancel Stripe subscription'");
    });

    it('should return 502 on Stripe failure for period-end cancel', () => {
      expect(source).toContain("errorResponse(502, 'Failed to update Stripe subscription'");
    });

    it('should include stripe_error detail in 502 responses', () => {
      expect(source).toContain("stripe_error: stripeError.error?.message");
    });
  });

  describe('prorated credit deduction', () => {
    it('should calculate proration based on period elapsed', () => {
      expect(source).toContain('remainingFraction');
      expect(source).toContain('1 - (elapsedMs / totalPeriodMs)');
    });

    it('should clamp remainingFraction to minimum 0', () => {
      expect(source).toContain('Math.max(0,');
    });

    it('should floor the credits removed', () => {
      expect(source).toContain('Math.floor(');
    });

    it('should query credits table with user_id and tenant_id', () => {
      expect(source).toContain("from('credits')");
      expect(source).toContain("eq('user_id', user.id)");
      expect(source).toContain("eq('tenant_id', subscription.tenant_id)");
    });

    it('should only deduct if user has sufficient balance', () => {
      expect(source).toContain('currentCredits.balance >= creditsRemoved');
    });

    it('should log proration transaction with metadata', () => {
      expect(source).toContain("description: 'Prorated credits removed due to immediate subscription cancellation'");
      expect(source).toContain('proration_fraction: remainingFraction');
    });
  });

  describe('subscription record update', () => {
    it('should set cancel_at_period_end flag', () => {
      expect(source).toContain('cancel_at_period_end: !cancel_immediately');
    });

    it('should record cancelled_at timestamp', () => {
      expect(source).toContain('cancelled_at: now');
    });

    it('should set status to cancelled on immediate cancellation', () => {
      expect(source).toContain("updateData.status = 'cancelled'");
    });

    it('should zero out remaining credits on immediate cancellation', () => {
      expect(source).toContain('updateData.credits_remaining_this_period = 0');
    });

    it('should filter update by subscription_id and user_id', () => {
      // Verify the update query includes both id and user_id filters
      const updateSection = source.slice(
        source.indexOf("// Update credit_subscriptions record"),
        source.indexOf("// Log cancellation event")
      );
      expect(updateSection).toContain("eq('id', subscription_id)");
      expect(updateSection).toContain("eq('user_id', user.id)");
    });

    it('should return 500 with support message if local update fails after Stripe', () => {
      expect(source).toContain('Stripe cancelled but local update failed');
    });
  });

  describe('analytics and transaction logging', () => {
    it('should log to credit_analytics with subscription_cancelled event', () => {
      expect(source).toContain("from('credit_analytics')");
      expect(source).toContain("event_type: 'subscription_cancelled'");
    });

    it('should include tenant_id on analytics insert', () => {
      expect(source).toContain('tenant_id: subscription.tenant_id');
    });

    it('should log event transaction when no proration occurred', () => {
      expect(source).toContain('!cancel_immediately || creditsRemoved === 0');
    });

    it('should log to credit_transactions for non-proration events', () => {
      expect(source).toContain("type: 'adjustment'");
      expect(source).toContain("reference_type: 'subscription'");
    });
  });

  describe('CORS and shared imports', () => {
    it('should import serve from shared deps', () => {
      expect(source).toContain("import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts'");
    });

    it('should import errorResponse from shared error-response', () => {
      expect(source).toContain("import { errorResponse } from '../_shared/error-response.ts'");
    });

    it('should return CORS headers on OPTIONS', () => {
      expect(source).toContain('headers: corsHeaders');
    });

    it('should include CORS headers in success response', () => {
      expect(source).toContain("{ ...corsHeaders, 'Content-Type': 'application/json' }");
    });

    it('should not define its own corsHeaders', () => {
      expect(source).not.toMatch(/const corsHeaders\s*=/);
    });
  });

  describe('success response shape', () => {
    it('should return success flag', () => {
      expect(source).toContain('success: true');
    });

    it('should return subscription_id', () => {
      // In success response
      const successSection = source.slice(source.indexOf('success: true'));
      expect(successSection).toContain('subscription_id');
    });

    it('should return cancel_immediately flag', () => {
      const successSection = source.slice(source.indexOf('success: true'));
      expect(successSection).toContain('cancel_immediately');
    });

    it('should return correct status based on cancel type', () => {
      expect(source).toContain("status: cancel_immediately ? 'cancelled' : 'active'");
    });

    it('should return cancel_at_period_end flag', () => {
      const successSection = source.slice(source.indexOf('success: true'));
      expect(successSection).toContain('cancel_at_period_end: !cancel_immediately');
    });

    it('should return credits_removed count', () => {
      const successSection = source.slice(source.indexOf('success: true'));
      expect(successSection).toContain('credits_removed: creditsRemoved');
    });

    it('should return current_period_end', () => {
      const successSection = source.slice(source.indexOf('success: true'));
      expect(successSection).toContain('current_period_end: subscription.current_period_end');
    });
  });

  describe('error handling', () => {
    it('should catch unexpected errors in outer try-catch', () => {
      expect(source).toContain('} catch (error)');
      expect(source).toContain("'[CREDITS_CANCEL_SUB] Unexpected error:'");
    });

    it('should return 500 for unexpected errors', () => {
      expect(source).toContain("errorResponse(500, (error as Error).message || 'Internal server error')");
    });

    it('should log errors with function prefix', () => {
      expect(source).toContain('[CREDITS_CANCEL_SUB]');
    });
  });

  describe('Stripe config check', () => {
    it('should check for STRIPE_SECRET_KEY env var', () => {
      expect(source).toContain("Deno.env.get('STRIPE_SECRET_KEY')");
    });

    it('should return 500 if Stripe not configured', () => {
      expect(source).toContain("errorResponse(500, 'Stripe is not configured')");
    });

    it('should check Stripe key AFTER auth check', () => {
      const authCheckPos = source.indexOf("return errorResponse(401, 'Missing authorization header')");
      const stripeCheckPos = source.indexOf("return errorResponse(500, 'Stripe is not configured')");
      expect(authCheckPos).toBeLessThan(stripeCheckPos);
    });
  });
});
