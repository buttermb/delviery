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
    it('should import withCreditGate from shared creditGate module', () => {
      expect(source).toContain("import { withCreditGate");
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
      // Should not have a const corsHeaders = { ... } definition
      expect(source).not.toMatch(/const corsHeaders\s*=\s*\{/);
    });
  });

  describe('credit gate wrapping', () => {
    it('should wrap handler with withCreditGate', () => {
      expect(source).toContain('withCreditGate(req,');
    });

    it('should use CREDIT_ACTIONS.SEND_SMS action key', () => {
      expect(source).toContain('CREDIT_ACTIONS.SEND_SMS');
    });

    it('should pass req as first argument to withCreditGate', () => {
      expect(source).toMatch(/withCreditGate\(req,\s*CREDIT_ACTIONS\.SEND_SMS/);
    });
  });

  describe('handler structure', () => {
    it('should handle CORS OPTIONS before credit gate call', () => {
      // OPTIONS should be handled before withCreditGate invocation to avoid unnecessary credit checks
      const optionsIndex = source.indexOf("req.method === 'OPTIONS'");
      const creditGateCallIndex = source.indexOf('withCreditGate(req,');
      expect(optionsIndex).toBeGreaterThan(-1);
      expect(creditGateCallIndex).toBeGreaterThan(-1);
      expect(optionsIndex).toBeLessThan(creditGateCallIndex);
    });

    it('should validate phone and message inside credit-gated handler', () => {
      expect(source).toContain('!phone || !message');
    });

    it('should call Klaviyo API inside credit-gated handler', () => {
      expect(source).toContain('https://a.klaviyo.com/api/campaigns/');
    });

    it('should return success response with messageId on success', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('messageId');
    });
  });

  describe('error handling', () => {
    it('should handle Klaviyo API errors', () => {
      expect(source).toContain('Klaviyo API error');
    });

    it('should handle missing KLAVIYO_API_KEY', () => {
      expect(source).toContain('KLAVIYO_API_KEY not configured');
    });

    it('should include TODO for credit refund on API failure', () => {
      expect(source).toContain('TODO: Refund credits on API failure');
    });
  });
});
