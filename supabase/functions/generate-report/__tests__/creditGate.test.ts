/**
 * Generate Report Edge Function — Credit Gate Integration Tests
 *
 * Verifies that the generate-report edge function correctly uses
 * withCreditGate with the 'report_custom_generate' action key (75 credits).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

describe('Generate Report Credit Gate', () => {
  const source = readEdgeFunctionSource();

  it('should import withCreditGate from _shared/creditGate', () => {
    expect(source).toContain("import { withCreditGate } from");
    expect(source).toContain("creditGate.ts");
  });

  it('should wrap handler with withCreditGate', () => {
    expect(source).toMatch(/withCreditGate\s*\(\s*req/);
  });

  it('should use report_custom_generate action key', () => {
    expect(source).toContain("'report_custom_generate'");
  });

  it('should pass tenantId and serviceClient to the handler', () => {
    // The handler callback should receive tenantId and serviceClient
    expect(source).toMatch(/withCreditGate\(req,\s*'report_custom_generate',\s*async\s*\(\s*tenantId\s*,\s*serviceClient\s*\)/);
  });

  it('should filter all data queries by tenantId', () => {
    // All three report types must filter by tenantId
    const orderQuery = source.match(/\.from\("orders"\)[\s\S]*?\.eq\("tenant_id",\s*tenantId\)/);
    const productQuery = source.match(/\.from\("products"\)[\s\S]*?\.eq\("tenant_id",\s*tenantId\)/);
    const customerQuery = source.match(/\.from\("customers"\)[\s\S]*?\.eq\("tenant_id",\s*tenantId\)/);

    expect(orderQuery).not.toBeNull();
    expect(productQuery).not.toBeNull();
    expect(customerQuery).not.toBeNull();
  });

  it('should not create its own service role client', () => {
    // The function should NOT create a separate service client — it uses the one from withCreditGate
    // We check that SUPABASE_SERVICE_ROLE_KEY is not referenced (withCreditGate handles this)
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('should handle CORS preflight before credit gate call', () => {
    // CORS must be handled before withCreditGate call to avoid unnecessary credit checks
    const corsIndex = source.indexOf('req.method === "OPTIONS"');
    const creditGateCallIndex = source.indexOf('withCreditGate(req');

    expect(corsIndex).toBeGreaterThan(-1);
    expect(creditGateCallIndex).toBeGreaterThan(-1);
    expect(corsIndex).toBeLessThan(creditGateCallIndex);
  });

  it('should still log report execution with user info', () => {
    expect(source).toContain('report_executions');
    expect(source).toContain('user_id');
  });

  it('should use serviceClient for data queries (not anon client)', () => {
    // Data queries should use serviceClient from credit gate, not supabaseClient
    expect(source).toMatch(/serviceClient\s*\.\s*from\("orders"\)/);
    expect(source).toMatch(/serviceClient\s*\.\s*from\("products"\)/);
    expect(source).toMatch(/serviceClient\s*\.\s*from\("customers"\)/);
  });
});
