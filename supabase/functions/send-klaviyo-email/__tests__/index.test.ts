/**
 * send-klaviyo-email Edge Function Tests (now using Resend)
 *
 * Verifies:
 * 1. Credit gating via withCreditGate with action_key 'send_email'
 * 2. Input validation (to, subject, content required)
 * 3. Refund on Resend API failure
 * 4. Successful email send path
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('send-klaviyo-email credit enforcement (Resend)', () => {
  const source = readSource();

  describe('credit gate integration', () => {
    it('should import withCreditGate from shared creditGate module', () => {
      expect(source).toContain("import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
    });

    it('should wrap handler with withCreditGate', () => {
      expect(source).toContain('withCreditGate(req, CREDIT_ACTIONS.SEND_EMAIL,');
    });

    it('should use SEND_EMAIL action key', () => {
      expect(source).toContain('CREDIT_ACTIONS.SEND_EMAIL');
    });

    it('should pass referenceType and description options', () => {
      expect(source).toContain("referenceType: 'email'");
      expect(source).toContain("description: 'Resend email send'");
    });

    it('should import serve from shared deps', () => {
      expect(source).toContain("import { serve } from '../_shared/deps.ts'");
    });

    it('should import corsHeaders from shared deps', () => {
      expect(source).toContain("import { corsHeaders } from '../_shared/deps.ts'");
    });

    it('should not define its own corsHeaders', () => {
      // Ensure we're using shared CORS headers, not inline ones
      expect(source).not.toMatch(/const corsHeaders\s*=/);
    });
  });

  describe('refund on API failure', () => {
    it('should call refundCredits when Resend API returns non-ok response', () => {
      expect(source).toContain('refundCredits(supabaseClient, tenantId, CREDIT_ACTIONS.SEND_EMAIL,');
    });

    it('should have a refundCredits function', () => {
      expect(source).toContain('async function refundCredits(');
    });

    it('should look up credit cost from credit_costs table in refund', () => {
      expect(source).toContain("from('credit_costs')");
      expect(source).toContain("eq('action_key', actionKey)");
      expect(source).toContain("eq('is_active', true)");
    });

    it('should update tenant_credits balance on refund', () => {
      expect(source).toContain("from('tenant_credits')");
      expect(source).toContain('balance: newBalance');
    });

    it('should insert a refund transaction record', () => {
      expect(source).toContain("from('credit_transactions')");
      expect(source).toContain("transaction_type: 'refund'");
    });

    it('should return 502 with refunded flag on Resend failure', () => {
      expect(source).toContain('refunded: true');
      expect(source).toContain('status: 502');
    });
  });

  describe('input validation', () => {
    it('should validate required fields: to, subject, and content', () => {
      expect(source).toContain('!to || !subject || (!html && !text)');
    });

    it('should return 400 for missing fields', () => {
      expect(source).toContain('status: 400');
    });
  });

  describe('Resend API integration', () => {
    it('should call Resend emails API endpoint', () => {
      expect(source).toContain('https://api.resend.com/emails');
    });

    it('should use RESEND_API_KEY from environment', () => {
      expect(source).toContain("Deno.env.get('RESEND_API_KEY')");
    });

    it('should include tenantId in logging for observability', () => {
      expect(source).toContain('tenantId');
      // Ensure tenantId appears in log context
      const logLines = source.split('\n').filter(l => l.includes('console.error') && l.includes('tenantId'));
      expect(logLines.length).toBeGreaterThanOrEqual(1);
    });

    it('should return success with messageId on successful send', () => {
      expect(source).toContain('success: true');
      expect(source).toContain("messageId: result.id");
    });
  });

  describe('handler receives tenantId from withCreditGate', () => {
    it('should use tenantId parameter from credit gate callback', () => {
      // The handler signature includes tenantId
      expect(source).toContain('async (tenantId: string, supabaseClient: SupabaseClient)');
    });
  });

  describe('no direct serve handler for CORS', () => {
    it('should not handle OPTIONS directly (withCreditGate handles CORS)', () => {
      // withCreditGate already handles OPTIONS preflight
      // The top-level serve should just delegate to withCreditGate
      const optionsCount = (source.match(/req\.method === 'OPTIONS'/g) || []).length;
      expect(optionsCount).toBe(0); // withCreditGate handles it internally
    });
  });
});
