/**
 * create-encrypted-menu Edge Function — Credit Gate Integration Tests
 *
 * Verifies that the create-encrypted-menu edge function correctly integrates
 * withCreditGate middleware with the 'menu_create' action key.
 *
 * Since edge functions run in Deno, these tests verify the source code structure
 * rather than runtime behavior. The withCreditGate middleware itself is tested
 * separately.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const EDGE_FN_PATH = path.resolve(
  __dirname,
  '../../create-encrypted-menu/index.ts'
);
const source = fs.readFileSync(EDGE_FN_PATH, 'utf-8');

describe('create-encrypted-menu credit gate integration', () => {
  it('should import withCreditGate from shared creditGate module', () => {
    expect(source).toContain("import { withCreditGate }");
    expect(source).toContain("from '../_shared/creditGate.ts'");
  });

  it('should use menu_create action key', () => {
    expect(source).toContain("'menu_create'");
  });

  it('should wrap handler with withCreditGate', () => {
    // Verify the withCreditGate call pattern
    expect(source).toMatch(/withCreditGate\(req,\s*'menu_create'/);
  });

  it('should use Deno.serve (not legacy serve import)', () => {
    expect(source).toContain('Deno.serve(');
    // Should not import serve from deps
    expect(source).not.toMatch(/import\s*\{[^}]*\bserve\b[^}]*\}\s*from/);
  });

  it('should not import createClient (uses serviceClient from creditGate)', () => {
    // withCreditGate provides serviceClient, so createClient should not be imported
    expect(source).not.toMatch(/import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from/);
  });

  it('should not manually extract auth header for authentication', () => {
    // withCreditGate handles auth — the function should not have its own
    // top-level auth extraction. The only auth header usage should be in
    // the tenant_id mismatch fallback check.
    const lines = source.split('\n');
    const authHeaderLines = lines.filter(
      (l) => l.includes("req.headers.get('Authorization')") && !l.trim().startsWith('//')
    );
    // Should only reference auth header in the tenant mismatch fallback
    expect(authHeaderLines.length).toBeLessThanOrEqual(1);
  });

  it('should use serviceClient for all database operations', () => {
    // All .from() calls should use serviceClient, not a locally-created client
    expect(source).not.toMatch(/\bsupabase\b\.from\(/);
    expect(source).toContain('serviceClient');
  });

  it('should verify tenant_id matches authenticated tenant', () => {
    expect(source).toContain('menuData.tenant_id !== tenantId');
  });

  it('should handle CORS preflight before credit gate', () => {
    // CORS should be handled before withCreditGate to avoid unnecessary auth
    const corsIndex = source.indexOf("req.method === 'OPTIONS'");
    const creditGateIndex = source.indexOf('withCreditGate(');
    expect(corsIndex).toBeLessThan(creditGateIndex);
  });

  it('should return 201 status on successful menu creation', () => {
    expect(source).toContain('status: 201');
  });

  it('should include Zod validation for request body', () => {
    expect(source).toContain('CreateMenuSchema.safeParse(body)');
  });

  it('should filter wholesale_inventory by tenant_id', () => {
    expect(source).toMatch(/\.eq\('tenant_id',\s*menuData\.tenant_id\)/);
  });

  it('should call encrypt_disposable_menu RPC', () => {
    expect(source).toContain("'encrypt_disposable_menu'");
  });
});
