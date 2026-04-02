/**
 * send-klaviyo-sms Edge Function — Credit Gate Integration Tests
 *
 * Verifies that the send-klaviyo-sms edge function correctly integrates
 * with the credit gate middleware using the 'send_sms' action key (25 credits).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('send-klaviyo-sms Credit Gate Integration', () => {
  const source = readEdgeFunctionSource();

  describe('imports', () => {
    it('should import withCreditGateAndRefund from shared creditGate module', () => {
      expect(source).toContain('import { withCreditGateAndRefund');
      expect(source).toContain("from '../_shared/creditGate.ts'");
    });

    it('should import CREDIT_ACTIONS from shared creditGate module', () => {
      expect(source).toContain('CREDIT_ACTIONS');
    });

    it('should import corsHeaders from shared deps', () => {
      expect(source).toContain("from '../_shared/deps.ts'");
      expect(source).toContain('corsHeaders');
    });

    it('should not define local corsHeaders (uses shared)', () => {
      expect(source).not.toMatch(/const corsHeaders\s*=\s*\{/);
    });
  });

  describe('credit gate wrapping', () => {
    it('should wrap handler with withCreditGateAndRefund for auto-refund on failure', () => {
      expect(source).toContain('withCreditGateAndRefund(req,');
    });

    it('should use CREDIT_ACTIONS.SEND_SMS action key', () => {
      expect(source).toContain('CREDIT_ACTIONS.SEND_SMS');
    });

    it('should pass req as first argument to withCreditGateAndRefund', () => {
      expect(source).toMatch(/withCreditGateAndRefund\(req,\s*CREDIT_ACTIONS\.SEND_SMS/);
    });
  });

  describe('handler structure', () => {
    it('should use Deno.serve instead of imported serve', () => {
      expect(source).toContain('Deno.serve(');
      expect(source).not.toMatch(/^import.*\bserve\b.*from/m);
    });

    it('should handle CORS OPTIONS before credit gate call', () => {
      const optionsIndex = source.indexOf("req.method === 'OPTIONS'");
      const creditGateCallIndex = source.indexOf('withCreditGateAndRefund(req,');
      expect(optionsIndex).toBeGreaterThan(-1);
      expect(creditGateCallIndex).toBeGreaterThan(-1);
      expect(optionsIndex).toBeLessThan(creditGateCallIndex);
    });

    it('should accept both "to" and "phone" field names', () => {
      expect(source).toContain('body.to');
      expect(source).toContain('body.phone');
    });

    it('should validate phone and message inside credit-gated handler', () => {
      expect(source).toContain('!phone || !message');
    });

    it('should call Klaviyo Events API', () => {
      expect(source).toContain('https://a.klaviyo.com/api/events/');
    });

    it('should return success response with eventId on success', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('eventId');
    });
  });

  describe('error handling', () => {
    it('should return 500 response for missing KLAVIYO_API_KEY (not throw)', () => {
      expect(source).toContain('KLAVIYO_API_KEY not configured');
      // Should return a Response, not throw
      expect(source).toMatch(/return new Response[\s\S]*?KLAVIYO_API_KEY not configured/);
    });

    it('should handle Klaviyo API errors with 502 status', () => {
      expect(source).toContain('Klaviyo API error');
      expect(source).toContain('status: 502');
    });

    it('should log Klaviyo API errors with function name prefix', () => {
      expect(source).toContain('[send-klaviyo-sms]');
    });
  });
});
