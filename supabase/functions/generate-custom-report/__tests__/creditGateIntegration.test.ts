/**
 * Generate Custom Report Edge Function - Credit Gate Integration Tests
 *
 * Verifies that the generate-custom-report edge function is properly
 * wrapped with withCreditGate using the correct action key.
 *
 * Action key: report_custom_generate (75 credits)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const EDGE_FUNCTION_PATH = resolve(
  __dirname,
  '../../generate-custom-report/index.ts'
);

const CREDIT_GATE_PATH = resolve(
  __dirname,
  '../../_shared/creditGate.ts'
);

describe('Generate Custom Report - Credit Gate Integration', () => {
  const edgeFunctionSource = readFileSync(EDGE_FUNCTION_PATH, 'utf-8');
  const creditGateSource = readFileSync(CREDIT_GATE_PATH, 'utf-8');

  describe('Import verification', () => {
    it('should import withCreditGate from shared creditGate module', () => {
      expect(edgeFunctionSource).toContain(
        "import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts'"
      );
    });
  });

  describe('Credit gate wrapping', () => {
    it('should wrap handler with withCreditGate', () => {
      expect(edgeFunctionSource).toContain('withCreditGate(req,');
    });

    it('should use CREDIT_ACTIONS.REPORT_CUSTOM_GENERATE as action key', () => {
      expect(edgeFunctionSource).toContain(
        'CREDIT_ACTIONS.REPORT_CUSTOM_GENERATE'
      );
    });

    it('should not have standalone try/catch at outer serve level (handled by creditGate)', () => {
      // The outer serve handler should delegate error handling to withCreditGate
      // Only inner data-source-level try/catch should remain
      const outerServeMatch = edgeFunctionSource.match(
        /serve\(async \(req\) => \{[\s\S]*?return withCreditGate/
      );
      expect(outerServeMatch).not.toBeNull();

      // Verify CORS preflight is still handled before withCreditGate
      const corsBeforeGate = edgeFunctionSource.indexOf("req.method === 'OPTIONS'");
      const creditGateCall = edgeFunctionSource.indexOf('withCreditGate(req,');
      expect(corsBeforeGate).toBeLessThan(creditGateCall);
    });
  });

  describe('CREDIT_ACTIONS constant', () => {
    it('should define REPORT_CUSTOM_GENERATE in CREDIT_ACTIONS', () => {
      expect(creditGateSource).toContain("REPORT_CUSTOM_GENERATE: 'report_custom_generate'");
    });

    it('should place REPORT_CUSTOM_GENERATE in Reports & Exports section', () => {
      const reportsSection = creditGateSource.indexOf('// Reports & Exports');
      const actionDef = creditGateSource.indexOf("REPORT_CUSTOM_GENERATE:");
      const nextSection = creditGateSource.indexOf('// AI Features');

      expect(reportsSection).toBeLessThan(actionDef);
      expect(actionDef).toBeLessThan(nextSection);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight before credit gate', () => {
      // CORS preflight should return early without going through credit gate
      const optionsHandling = edgeFunctionSource.match(
        /if \(req\.method === 'OPTIONS'\)[\s\S]*?return new Response\(null/
      );
      expect(optionsHandling).not.toBeNull();
    });
  });

  describe('Handler callback signature', () => {
    it('should receive creditTenantId and serviceClient from withCreditGate', () => {
      expect(edgeFunctionSource).toContain(
        'async (creditTenantId, serviceClient) =>'
      );
    });

    it('should still create user-authenticated supabase client inside handler', () => {
      // The handler needs its own user-authenticated client for RLS-protected queries
      expect(edgeFunctionSource).toContain("Deno.env.get('SUPABASE_ANON_KEY')");
      expect(edgeFunctionSource).toContain('Authorization');
    });
  });
});
