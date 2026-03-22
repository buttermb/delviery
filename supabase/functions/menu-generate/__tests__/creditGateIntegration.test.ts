/**
 * Menu Generate Edge Function — Credit Gate Integration Tests
 *
 * Verifies that the menu-generate edge function is correctly wrapped with
 * withCreditGate using action_key 'menu_create' (100 credits).
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

describe('Menu Generate Credit Gate Integration', () => {
  const source = readEdgeFunctionSource();

  describe('withCreditGate wrapping', () => {
    it('should import withCreditGate from _shared/creditGate.ts', () => {
      expect(source).toMatch(/import\s+\{[^}]*withCreditGate[^}]*\}\s+from\s+['"]\.\.\/\_shared\/creditGate\.ts['"]/);
    });

    it('should wrap handler with withCreditGate', () => {
      expect(source).toContain('withCreditGate(req,');
    });

    it('should use menu_create as the action key', () => {
      expect(source).toMatch(/withCreditGate\(\s*req\s*,\s*'menu_create'/);
    });

    it('should use Deno.serve instead of legacy serve import', () => {
      expect(source).toContain('Deno.serve(');
      expect(source).not.toMatch(/^import\s+\{[^}]*\bserve\b[^}]*\}/m);
    });
  });

  describe('handler uses provided tenantId and serviceClient', () => {
    it('should receive tenantId and serviceClient from withCreditGate', () => {
      expect(source).toMatch(/withCreditGate\(req,\s*'menu_create',\s*async\s*\(\s*tenantId\s*,\s*serviceClient\s*\)/);
    });

    it('should use serviceClient for database queries (not create a new client)', () => {
      // Should NOT create a new supabase client with createClient for the main logic
      const handlerSection = source.slice(source.indexOf('withCreditGate'));
      expect(handlerSection).not.toMatch(/createClient\(/);
    });

    it('should use tenantId from withCreditGate for tenant filtering', () => {
      expect(source).toContain("tenant_id: tenantId");
    });
  });

  describe('imports use shared deps', () => {
    it('should import corsHeaders from _shared/deps.ts', () => {
      expect(source).toMatch(/import\s+\{[^}]*corsHeaders[^}]*\}\s+from\s+['"]\.\.\/\_shared\/deps\.ts['"]/);
    });

    it('should import validateMenuGenerate from validation.ts', () => {
      expect(source).toMatch(/import\s+\{[^}]*validateMenuGenerate[^}]*\}\s+from\s+['"]\.\/validation\.ts['"]/);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight before withCreditGate', () => {
      const optionsIndex = source.indexOf("req.method === 'OPTIONS'");
      const creditGateIndex = source.indexOf('withCreditGate(');
      expect(optionsIndex).toBeGreaterThan(-1);
      expect(creditGateIndex).toBeGreaterThan(-1);
      expect(optionsIndex).toBeLessThan(creditGateIndex);
    });
  });

  describe('product tenant validation', () => {
    it('should validate products belong to the tenant', () => {
      expect(source).toContain('p.tenant_id !== tenantId');
    });

    it('should return 403 for cross-tenant products', () => {
      const crossTenantSection = source.slice(source.indexOf('invalidProducts'));
      expect(crossTenantSection).toContain('status: 403');
      expect(crossTenantSection).toContain('do not belong to your tenant');
    });
  });

  describe('error handling', () => {
    it('should handle errors within the withCreditGate handler', () => {
      expect(source).toContain('catch (error: unknown)');
      expect(source).toContain('Error in menu-generate');
    });

    it('should return structured error response', () => {
      expect(source).toContain("error instanceof Error ? error.message : 'Unknown error occurred'");
    });
  });
});
