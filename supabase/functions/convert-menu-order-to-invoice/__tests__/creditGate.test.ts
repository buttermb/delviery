/**
 * Convert Menu Order to Invoice - Credit Gate Tests
 *
 * Verifies that the edge function correctly uses withCreditGate
 * with the 'invoice_create' action key (50 credits).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read the source file to verify credit gate integration
const sourceCode = readFileSync(
  resolve(__dirname, '../index.ts'),
  'utf-8'
);

describe('convert-menu-order-to-invoice credit gate integration', () => {
  it('should import withCreditGate from _shared/creditGate.ts', () => {
    expect(sourceCode).toContain("import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
  });

  it('should use CREDIT_ACTIONS.INVOICE_CREATE as the action key', () => {
    expect(sourceCode).toContain('CREDIT_ACTIONS.INVOICE_CREATE');
  });

  it('should wrap the handler with withCreditGate', () => {
    expect(sourceCode).toContain('withCreditGate(req, CREDIT_ACTIONS.INVOICE_CREATE');
  });

  it('should use tenantId from withCreditGate instead of manual auth', () => {
    // Should NOT have manual auth extraction (withCreditGate handles this)
    expect(sourceCode).not.toContain("supabase.auth.getUser(token)");
    // Should use tenantId from callback parameter
    expect(sourceCode).toContain('async (tenantId, supabase)');
  });

  it('should handle CORS preflight before withCreditGate, not inside the handler', () => {
    // The handler callback (after the withCreditGate call signature) should not have OPTIONS check
    const handlerStart = sourceCode.indexOf('async (tenantId, supabase) =>');
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerBody = sourceCode.slice(handlerStart);
    expect(handlerBody).not.toContain("req.method === 'OPTIONS'");
  });

  it('should filter menu_orders by tenantId from credit gate', () => {
    expect(sourceCode).toContain(".eq('tenant_id', tenantId)");
  });

  it('should use tenant_id from withCreditGate for invoice creation', () => {
    expect(sourceCode).toContain('tenant_id: tenantId');
  });
});

describe('CREDIT_ACTIONS constant', () => {
  it('should define INVOICE_CREATE action key', () => {
    const creditGateSource = readFileSync(
      resolve(__dirname, '../../_shared/creditGate.ts'),
      'utf-8'
    );
    expect(creditGateSource).toContain("INVOICE_CREATE: 'invoice_create'");
  });
});
