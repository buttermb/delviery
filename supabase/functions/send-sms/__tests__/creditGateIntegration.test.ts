/**
 * Send SMS Edge Function — Credit Gate Integration Tests
 *
 * Verifies that the send-sms edge function:
 * 1. Uses withCreditGate wrapper for credit deduction
 * 2. Uses the correct CREDIT_ACTIONS.SEND_SMS action key
 * 3. Refunds credits on Twilio failure (including network errors)
 * 4. Uses tenantId from credit gate (not client-supplied accountId)
 * 5. Uses shared deps imports with proper types
 * 6. Looks up credit cost dynamically from credit_costs table
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

describe('Send SMS Credit Gate Integration', () => {
  const source = readEdgeFunctionSource();

  describe('credit gate wrapper', () => {
    it('should import withCreditGate from shared creditGate module', () => {
      expect(source).toContain("import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
    });

    it('should wrap handler with withCreditGate', () => {
      expect(source).toContain('withCreditGate(req, CREDIT_ACTIONS.SEND_SMS');
    });

    it('should use CREDIT_ACTIONS.SEND_SMS action key', () => {
      expect(source).toContain('CREDIT_ACTIONS.SEND_SMS');
    });

    it('should receive tenantId and serviceClient from credit gate', () => {
      expect(source).toMatch(/withCreditGate\(req,\s*CREDIT_ACTIONS\.SEND_SMS,\s*async\s*\(tenantId,\s*serviceClient\)/);
    });
  });

  describe('shared deps usage', () => {
    it('should import corsHeaders and SupabaseClient type from shared deps', () => {
      expect(source).toContain("import { corsHeaders, type SupabaseClient } from '../_shared/deps.ts'");
    });

    it('should not import directly from deno.land or esm.sh', () => {
      expect(source).not.toContain('deno.land/std');
      expect(source).not.toContain('esm.sh/@supabase');
    });

    it('should not define its own corsHeaders', () => {
      expect(source).not.toMatch(/const\s+corsHeaders\s*=/);
    });
  });

  describe('tenant isolation', () => {
    it('should use tenantId from credit gate for message logging', () => {
      expect(source).toContain('tenant_id: tenantId');
    });

    it('should not use client-supplied accountId for tenant context', () => {
      expect(source).not.toContain('accountId');
    });
  });

  describe('dynamic credit cost lookup', () => {
    it('should define a getCreditCost function', () => {
      expect(source).toContain('async function getCreditCost');
    });

    it('should look up cost from credit_costs table', () => {
      expect(source).toContain("from('credit_costs')");
      expect(source).toContain("eq('action_key', actionKey)");
      expect(source).toContain("eq('is_active', true)");
    });

    it('should use .maybeSingle() for credit cost lookup', () => {
      // getCreditCost section should use maybeSingle
      const getCreditCostIdx = source.indexOf('async function getCreditCost');
      const refundCreditsIdx = source.indexOf('async function refundCredits');
      const getCreditCostBody = source.slice(getCreditCostIdx, refundCreditsIdx);
      expect(getCreditCostBody).toContain('.maybeSingle()');
    });

    it('should call getCreditCost before Twilio API call', () => {
      const costLookupIdx = source.indexOf('getCreditCost(serviceClient');
      const twilioFetchIdx = source.indexOf('fetch(twilioUrl');
      expect(costLookupIdx).toBeGreaterThan(-1);
      expect(twilioFetchIdx).toBeGreaterThan(-1);
      expect(costLookupIdx).toBeLessThan(twilioFetchIdx);
    });
  });

  describe('credit refund on failure', () => {
    it('should define a refundCredits function', () => {
      expect(source).toContain('async function refundCredits');
    });

    it('should use proper SupabaseClient type for refund function', () => {
      const refundFnIdx = source.indexOf('async function refundCredits');
      const refundFn = source.slice(refundFnIdx, refundFnIdx + 200);
      expect(refundFn).toContain('supabaseClient: SupabaseClient');
    });

    it('should accept numeric amount parameter for refund', () => {
      const refundFnIdx = source.indexOf('async function refundCredits');
      const refundFn = source.slice(refundFnIdx, refundFnIdx + 200);
      expect(refundFn).toContain('amount: number');
    });

    it('should call refundCredits when Twilio API returns error', () => {
      const twilioErrorIdx = source.indexOf('!twilioResponse.ok');
      expect(twilioErrorIdx).toBeGreaterThan(-1);
      const afterTwilioCheck = source.slice(twilioErrorIdx, twilioErrorIdx + 500);
      expect(afterTwilioCheck).toContain('refundCredits');
    });

    it('should call refundCredits when Twilio fetch throws (network error)', () => {
      // Find the outer catch block that handles network errors
      const catchBlocks = [...source.matchAll(/catch\s*\(/g)];
      // At least one catch block should contain refundCredits
      const hasRefundInCatch = catchBlocks.some(match => {
        const afterCatch = source.slice(match.index!, match.index! + 500);
        return afterCatch.includes('refundCredits') && afterCatch.includes('Network error');
      });
      expect(hasRefundInCatch).toBe(true);
    });

    it('should use admin_adjust_credits RPC for refunds', () => {
      expect(source).toContain("'admin_adjust_credits'");
    });

    it('should pass dynamic amount via p_amount parameter', () => {
      const refundFnIdx = source.indexOf('async function refundCredits');
      const refundFn = source.slice(refundFnIdx);
      expect(refundFn).toContain('p_amount: amount');
    });

    it('should include descriptive reason for refund transaction', () => {
      expect(source).toMatch(/p_reason:.*Refund.*failed/);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight before credit gate call', () => {
      const optionsIdx = source.indexOf("req.method === 'OPTIONS'");
      const creditGateCallIdx = source.indexOf('withCreditGate(req');
      expect(optionsIdx).toBeGreaterThan(-1);
      expect(creditGateCallIdx).toBeGreaterThan(-1);
      expect(optionsIdx).toBeLessThan(creditGateCallIdx);
    });
  });

  describe('Twilio integration', () => {
    it('should validate Twilio environment variables', () => {
      expect(source).toContain('TWILIO_ACCOUNT_SID');
      expect(source).toContain('TWILIO_AUTH_TOKEN');
      expect(source).toContain('TWILIO_PHONE_NUMBER');
    });

    it('should format phone numbers with + prefix', () => {
      expect(source).toContain("to.startsWith('+')");
    });

    it('should wrap Twilio fetch in try-catch for error handling', () => {
      // The fetch call should be inside a try block
      const fetchIdx = source.indexOf('fetch(twilioUrl');
      expect(fetchIdx).toBeGreaterThan(-1);
      // Find the nearest preceding 'try {' before the fetch
      const beforeFetch = source.slice(0, fetchIdx);
      const lastTryIdx = beforeFetch.lastIndexOf('try {');
      expect(lastTryIdx).toBeGreaterThan(-1);
      // The try should be after the formData setup
      const formDataIdx = source.indexOf("formData.append('Body'");
      expect(lastTryIdx).toBeGreaterThan(formDataIdx);
    });

    it('should log sent message to message_history', () => {
      expect(source).toContain("from('message_history')");
    });
  });
});
