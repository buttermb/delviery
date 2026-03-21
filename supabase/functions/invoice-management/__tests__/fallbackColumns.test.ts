/**
 * Invoice Management Edge Function — Fallback Query Column Tests
 *
 * Verifies that the fallback direct queries in the invoice-management edge
 * function select the exact same columns that the corresponding RPC functions
 * return.  A mismatch would cause the API to return inconsistent response
 * shapes depending on whether the RPC succeeds or the fallback fires.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Expected columns ──────────────────────────────────────────────────────
// These mirror the `jsonb_build_object(...)` calls inside the secure RPCs
// defined in 20251116224510_secure_invoice_rpcs.sql.

/** Columns returned by `get_tenant_invoices` (list action) — note: no tenant_id */
const LIST_RPC_COLUMNS = [
  'id',
  'invoice_number',
  'subtotal',
  'tax',
  'total',
  'amount_paid',
  'amount_due',
  'line_items',
  'billing_period_start',
  'billing_period_end',
  'issue_date',
  'due_date',
  'paid_at',
  'status',
  'stripe_invoice_id',
  'stripe_payment_intent_id',
  'created_at',
  'updated_at',
] as const;

/** Columns returned by `get_invoice` (get action) — includes tenant_id */
const GET_RPC_COLUMNS = [
  'id',
  'tenant_id',
  'invoice_number',
  'subtotal',
  'tax',
  'total',
  'amount_paid',
  'amount_due',
  'line_items',
  'billing_period_start',
  'billing_period_end',
  'issue_date',
  'due_date',
  'paid_at',
  'status',
  'stripe_invoice_id',
  'stripe_payment_intent_id',
  'created_at',
  'updated_at',
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Read the edge function source */
function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(
    __dirname,
    '..',
    'index.ts',
  );
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

/**
 * Extract the `.select(...)` string from the first `.from('invoices').select(...)` call
 * that appears after a given marker string in the source code.
 */
function extractSelectAfterMarker(source: string, marker: string): string | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;

  const afterMarker = source.slice(markerIndex);
  // Match .select('...') — allowing multi-line content
  const selectMatch = afterMarker.match(/\.select\(\s*'([^']+)'\s*\)/);
  return selectMatch ? selectMatch[1] : null;
}

/** Parse a Supabase `.select()` column string into a sorted array of column names */
function parseSelectColumns(selectStr: string): string[] {
  return selectStr
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .sort();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Invoice Management Fallback Query Columns', () => {
  const source = readEdgeFunctionSource();

  describe('list action fallback', () => {
    it('should use explicit column selection (not wildcard)', () => {
      // Find the list fallback after the "Fallback" comment in the list action
      const listSection = source.slice(
        source.indexOf("action === 'list'"),
        source.indexOf("action === 'create'"),
      );

      expect(listSection).not.toMatch(/\.select\(\s*'\*'\s*\)/);
    });

    it('should select columns matching get_tenant_invoices RPC output', () => {
      const selectStr = extractSelectAfterMarker(
        source,
        "action === 'list'",
      );

      expect(selectStr).not.toBeNull();
      const fallbackColumns = parseSelectColumns(selectStr!);
      const rpcColumns = [...LIST_RPC_COLUMNS].sort();

      expect(fallbackColumns).toEqual(rpcColumns);
    });
  });

  describe('get action fallback', () => {
    it('should use explicit column selection (not wildcard)', () => {
      const getSection = source.slice(
        source.indexOf("action === 'get'"),
        source.indexOf("action === 'delete'"),
      );

      expect(getSection).not.toMatch(/\.select\(\s*'\*'\s*\)/);
    });

    it('should select columns matching get_invoice RPC output', () => {
      // The get action fallback comes after the 'get' action check
      const getActionStart = source.indexOf("action === 'get'");
      const deleteActionStart = source.indexOf("action === 'delete'");
      const getSection = source.slice(getActionStart, deleteActionStart);

      const selectMatch = getSection.match(
        /\.from\('invoices'\)\s*\.select\(\s*'([^']+)'\s*\)/,
      );

      expect(selectMatch).not.toBeNull();
      const fallbackColumns = parseSelectColumns(selectMatch![1]);
      const rpcColumns = [...GET_RPC_COLUMNS].sort();

      expect(fallbackColumns).toEqual(rpcColumns);
    });

    it('should include tenant_id matching the get_invoice RPC', () => {
      const getActionStart = source.indexOf("action === 'get'");
      const deleteActionStart = source.indexOf("action === 'delete'");
      const getSection = source.slice(getActionStart, deleteActionStart);

      const selectMatch = getSection.match(
        /\.from\('invoices'\)\s*\.select\(\s*'([^']+)'\s*\)/,
      );

      expect(selectMatch).not.toBeNull();
      const columns = parseSelectColumns(selectMatch![1]);
      expect(columns).toContain('tenant_id');
    });
  });

  describe('list fallback should NOT include tenant_id', () => {
    it('should match the RPC which omits tenant_id from list results', () => {
      const selectStr = extractSelectAfterMarker(
        source,
        "action === 'list'",
      );

      expect(selectStr).not.toBeNull();
      const columns = parseSelectColumns(selectStr!);
      expect(columns).not.toContain('tenant_id');
    });
  });

  describe('both fallbacks query the invoices table', () => {
    it('list fallback should query invoices table', () => {
      const listSection = source.slice(
        source.indexOf("action === 'list'"),
        source.indexOf("action === 'create'"),
      );

      expect(listSection).toContain(".from('invoices')");
    });

    it('get fallback should query invoices table', () => {
      const getSection = source.slice(
        source.indexOf("action === 'get'"),
        source.indexOf("action === 'delete'"),
      );

      expect(getSection).toContain(".from('invoices')");
    });
  });

  describe('fallback queries filter by tenant_id', () => {
    it('list fallback should filter by tenant_id', () => {
      const listSection = source.slice(
        source.indexOf("action === 'list'"),
        source.indexOf("action === 'create'"),
      );

      expect(listSection).toContain(".eq('tenant_id', tenantId)");
    });

    it('get fallback should filter by both id and tenant_id', () => {
      const getSection = source.slice(
        source.indexOf("action === 'get'"),
        source.indexOf("action === 'delete'"),
      );

      expect(getSection).toContain(".eq('id', invoice_id)");
      expect(getSection).toContain(".eq('tenant_id', tenantId)");
    });
  });
});
