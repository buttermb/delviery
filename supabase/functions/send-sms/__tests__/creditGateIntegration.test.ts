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
 * 7. Uses errorResponse helper for consistent error formatting
 * 8. Uses createRequestLogger for structured logging
 * 9. Safely parses JSON request body (returns 400, not 500)
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

    it('should import errorResponse from shared error-response module', () => {
      expect(source).toContain("import { errorResponse } from '../_shared/error-response.ts'");
    });

    it('should import createRequestLogger from shared logger module', () => {
      expect(source).toContain("import { createRequestLogger } from '../_shared/logger.ts'");
    });

    it('should not import directly from deno.land or esm.sh', () => {
      expect(source).not.toContain('deno.land/std');
      expect(source).not.toContain('esm.sh/@supabase');
    });

    it('should not define its own corsHeaders', () => {
      expect(source).not.toMatch(/const\s+corsHeaders\s*=/);
    });
  });

  describe('structured logging', () => {
    it('should create a request-scoped logger inside the handler', () => {
      expect(source).toContain("createRequestLogger('send-sms', req)");
    });

    it('should not use console.error directly', () => {
      expect(source).not.toMatch(/\bconsole\.error\b/);
    });

    it('should not use console.warn directly', () => {
      expect(source).not.toMatch(/\bconsole\.warn\b/);
    });

    it('should not use console.log', () => {
      expect(source).not.toMatch(/\bconsole\.log\b/);
    });

    it('should use logger.error for Twilio API errors', () => {
      const twilioErrorIdx = source.indexOf('!twilioResponse.ok');
      const afterCheck = source.slice(twilioErrorIdx, twilioErrorIdx + 300);
      expect(afterCheck).toContain('logger.error');
    });

    it('should use logger.warn for non-critical message logging failures', () => {
      expect(source).toContain('logger.warn');
    });
  });

  describe('error response consistency', () => {
    it('should use errorResponse for Twilio not configured error', () => {
      const envCheckIdx = source.indexOf('!TWILIO_ACCOUNT_SID');
      const nextReturn = source.indexOf('return', envCheckIdx + 1);
      const errorCall = source.slice(nextReturn, nextReturn + 200);
      expect(errorCall).toContain('errorResponse');
      expect(errorCall).toContain('TWILIO_NOT_CONFIGURED');
    });

    it('should use errorResponse for invalid JSON error', () => {
      expect(source).toContain("errorResponse(400, 'Invalid JSON in request body', 'INVALID_JSON')");
    });

    it('should use errorResponse for missing fields error', () => {
      expect(source).toContain("errorResponse(400, 'Missing required fields: to, message', 'MISSING_FIELDS')");
    });

    it('should use errorResponse for Twilio API failure', () => {
      expect(source).toContain("errorResponse(502, 'Failed to send SMS via Twilio', 'TWILIO_ERROR'");
    });

    it('should use errorResponse for network/unexpected failures', () => {
      expect(source).toContain("errorResponse(\n        500,\n        'Failed to send SMS',\n        'SMS_SEND_FAILED'");
    });

    it('should return 502 for upstream Twilio errors (not 500)', () => {
      const twilioErrorIdx = source.indexOf('!twilioResponse.ok');
      const errorBlock = source.slice(twilioErrorIdx, twilioErrorIdx + 500);
      expect(errorBlock).toContain('502');
    });
  });

  describe('JSON parsing safety', () => {
    it('should wrap req.json() in try-catch', () => {
      const jsonCallIdx = source.indexOf('req.json()');
      expect(jsonCallIdx).toBeGreaterThan(-1);
      const beforeJson = source.slice(0, jsonCallIdx);
      const lastTryIdx = beforeJson.lastIndexOf('try {');
      const lastCatchIdx = beforeJson.lastIndexOf('catch');
      // The try should be more recent than any previous catch
      expect(lastTryIdx).toBeGreaterThan(lastCatchIdx);
    });

    it('should return 400 for invalid JSON (not 500)', () => {
      // Find the catch block that handles JSON parse errors
      const invalidJsonIdx = source.indexOf('INVALID_JSON');
      expect(invalidJsonIdx).toBeGreaterThan(-1);
      const beforeInvalidJson = source.slice(Math.max(0, invalidJsonIdx - 100), invalidJsonIdx);
      expect(beforeInvalidJson).toContain('400');
    });

    it('should parse to, message, and customerId from body', () => {
      expect(source).toContain('body.to');
      expect(source).toContain('body.message');
      expect(source).toContain('body.customerId');
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

    it('should default to 25 credits if lookup fails', () => {
      const getCreditCostIdx = source.indexOf('async function getCreditCost');
      const refundCreditsIdx = source.indexOf('async function refundCredits');
      const getCreditCostBody = source.slice(getCreditCostIdx, refundCreditsIdx);
      expect(getCreditCostBody).toContain('?? 25');
    });
  });

  describe('credit refund on failure', () => {
    it('should define a refundCredits function', () => {
      expect(source).toContain('async function refundCredits');
    });

    it('should use proper SupabaseClient type for refund function', () => {
      const refundFnIdx = source.indexOf('async function refundCredits');
      const refundFn = source.slice(refundFnIdx, refundFnIdx + 300);
      expect(refundFn).toContain('supabaseClient: SupabaseClient');
    });

    it('should accept numeric amount parameter for refund', () => {
      const refundFnIdx = source.indexOf('async function refundCredits');
      const refundFn = source.slice(refundFnIdx, refundFnIdx + 300);
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

    it('should accept a logger parameter for structured error logging', () => {
      const refundFnIdx = source.indexOf('async function refundCredits');
      const refundFn = source.slice(refundFnIdx, refundFnIdx + 300);
      expect(refundFn).toContain('logger');
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

    it('should include external_id from Twilio response in message log', () => {
      expect(source).toContain('external_id: twilioData.sid');
    });

    it('should handle message_history table not existing (42P01)', () => {
      expect(source).toContain("logError.code !== '42P01'");
    });
  });
});
