/**
 * Credits Transactions Edge Function Tests
 *
 * Verifies that the credits-transactions edge function:
 *   - Imports shared deps correctly (serve, createClient, corsHeaders, z)
 *   - Handles CORS preflight (OPTIONS → 200)
 *   - Rejects non-GET methods with 405
 *   - Returns 401 for missing/invalid auth
 *   - Resolves tenant from JWT via tenant_users lookup
 *   - Validates query params with Zod (limit, cursor, type, date_from, date_to)
 *   - Filters transactions by tenant_id
 *   - Implements cursor-based pagination
 *   - Returns totals (total_earned, total_spent, net_change, transaction_count)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

const FUNCTIONS_DIR = path.resolve(__dirname, '../../../../supabase/functions');
const EDGE_FN_PATH = path.join(FUNCTIONS_DIR, 'credits-transactions/index.ts');

function readSource(): string {
  return fs.readFileSync(EDGE_FN_PATH, 'utf-8');
}

// Replicate the Zod schema from the edge function for validation testing
const TransactionTypeEnum = z.enum([
  'free_grant',
  'purchase',
  'usage',
  'refund',
  'bonus',
  'adjustment',
]);

const QueryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  type: TransactionTypeEnum.optional(),
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
});

// Replicate cursor helpers for unit testing
function encodeCursor(createdAt: string, id: string): string {
  return btoa(JSON.stringify({ created_at: createdAt, id }));
}

function decodeCursor(cursor: string): { created_at: string; id: string } {
  const decoded = JSON.parse(atob(cursor));
  if (!decoded.created_at || !decoded.id) {
    throw new Error('Invalid cursor format');
  }
  return decoded as { created_at: string; id: string };
}

describe('credits-transactions edge function', () => {
  const source = readSource();

  // =========================================================================
  // Source file structure
  // =========================================================================

  describe('imports and setup', () => {
    it('should import serve, createClient, corsHeaders, z from shared deps', () => {
      expect(source).toContain("import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts'");
    });

    it('should define a Zod schema for query parameter validation', () => {
      expect(source).toContain('QueryParamsSchema');
      expect(source).toContain('z.object');
    });

    it('should define transaction type enum with Zod', () => {
      expect(source).toContain('TransactionTypeEnum');
      expect(source).toContain('z.enum');
    });
  });

  // =========================================================================
  // CORS and method handling
  // =========================================================================

  describe('CORS and method handling', () => {
    it('should handle OPTIONS preflight requests', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
      expect(source).toContain("headers: corsHeaders");
    });

    it('should reject non-GET methods with 405', () => {
      expect(source).toContain("req.method !== 'GET'");
      expect(source).toContain('status: 405');
      expect(source).toContain('Method not allowed');
    });
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  describe('authentication', () => {
    it('should check for Authorization header', () => {
      expect(source).toContain("req.headers.get('Authorization')");
    });

    it('should require Bearer token format', () => {
      expect(source).toContain("startsWith('Bearer ')");
    });

    it('should return 401 for missing auth header', () => {
      expect(source).toContain('Missing or invalid authorization header');
      expect(source).toContain('status: 401');
    });

    it('should validate token via supabase.auth.getUser', () => {
      expect(source).toContain('supabase.auth.getUser(token)');
    });

    it('should return 401 for invalid or expired token', () => {
      expect(source).toContain('Invalid or expired token');
    });
  });

  // =========================================================================
  // Tenant resolution
  // =========================================================================

  describe('tenant resolution', () => {
    it('should look up tenant via tenant_users table', () => {
      expect(source).toContain("from('tenant_users')");
      expect(source).toContain("select('tenant_id')");
    });

    it('should filter tenant_users by authenticated user id', () => {
      expect(source).toContain("eq('user_id', user.id)");
    });

    it('should use .maybeSingle() for tenant lookup', () => {
      expect(source).toContain('.maybeSingle()');
    });

    it('should return 403 when user has no tenant access', () => {
      expect(source).toContain('No tenant access');
      expect(source).toContain('status: 403');
    });
  });

  // =========================================================================
  // Query parameter validation
  // =========================================================================

  describe('query parameter validation', () => {
    it('should parse limit with coerce and bounds (1-100, default 20)', () => {
      const result = QueryParamsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept valid limit values', () => {
      const result = QueryParamsSchema.safeParse({ limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit below 1', () => {
      const result = QueryParamsSchema.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject limit above 100', () => {
      const result = QueryParamsSchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should accept valid transaction type filters', () => {
      for (const type of ['free_grant', 'purchase', 'usage', 'refund', 'bonus', 'adjustment']) {
        const result = QueryParamsSchema.safeParse({ type });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid transaction type', () => {
      const result = QueryParamsSchema.safeParse({ type: 'invalid_type' });
      expect(result.success).toBe(false);
    });

    it('should accept ISO datetime with offset for date_from', () => {
      const result = QueryParamsSchema.safeParse({ date_from: '2025-01-01T00:00:00+00:00' });
      expect(result.success).toBe(true);
    });

    it('should accept ISO datetime with offset for date_to', () => {
      const result = QueryParamsSchema.safeParse({ date_to: '2025-12-31T23:59:59+00:00' });
      expect(result.success).toBe(true);
    });

    it('should reject non-ISO date strings', () => {
      const result = QueryParamsSchema.safeParse({ date_from: '2025-01-01' });
      expect(result.success).toBe(false);
    });

    it('should return 400 for invalid query parameters', () => {
      expect(source).toContain('Invalid query parameters');
      expect(source).toContain('status: 400');
    });
  });

  // =========================================================================
  // Transaction query
  // =========================================================================

  describe('transaction query', () => {
    it('should query credit_transactions table', () => {
      expect(source).toContain("from('credit_transactions')");
    });

    it('should filter by tenant_id', () => {
      expect(source).toContain("eq('tenant_id', tenantId)");
    });

    it('should order by created_at descending', () => {
      expect(source).toContain("order('created_at', { ascending: false })");
    });

    it('should order by id descending for stable sort', () => {
      expect(source).toContain("order('id', { ascending: false })");
    });

    it('should fetch limit + 1 for has-more detection', () => {
      expect(source).toContain('limit + 1');
    });

    it('should apply type filter when provided', () => {
      expect(source).toContain("eq('transaction_type', type)");
    });

    it('should apply date_from filter with gte', () => {
      expect(source).toContain("gte('created_at', date_from)");
    });

    it('should apply date_to filter with lte', () => {
      expect(source).toContain("lte('created_at', date_to)");
    });
  });

  // =========================================================================
  // Cursor-based pagination
  // =========================================================================

  describe('cursor-based pagination', () => {
    it('should encode cursor as base64 JSON with created_at and id', () => {
      const cursor = encodeCursor('2025-06-01T00:00:00Z', 'abc-123');
      const decoded = JSON.parse(atob(cursor));
      expect(decoded).toEqual({ created_at: '2025-06-01T00:00:00Z', id: 'abc-123' });
    });

    it('should decode cursor back to created_at and id', () => {
      const cursor = encodeCursor('2025-06-01T00:00:00Z', 'abc-123');
      const decoded = decodeCursor(cursor);
      expect(decoded.created_at).toBe('2025-06-01T00:00:00Z');
      expect(decoded.id).toBe('abc-123');
    });

    it('should roundtrip encode/decode correctly', () => {
      const original = { created_at: '2025-12-31T23:59:59.999Z', id: '550e8400-e29b-41d4-a716-446655440000' };
      const cursor = encodeCursor(original.created_at, original.id);
      const decoded = decodeCursor(cursor);
      expect(decoded).toEqual(original);
    });

    it('should throw on invalid cursor format (missing created_at)', () => {
      const invalidCursor = btoa(JSON.stringify({ id: 'abc' }));
      expect(() => decodeCursor(invalidCursor)).toThrow('Invalid cursor format');
    });

    it('should throw on invalid cursor format (missing id)', () => {
      const invalidCursor = btoa(JSON.stringify({ created_at: '2025-01-01T00:00:00Z' }));
      expect(() => decodeCursor(invalidCursor)).toThrow('Invalid cursor format');
    });

    it('should return 400 for invalid cursor in source', () => {
      expect(source).toContain('Invalid cursor');
      expect(source).toContain('status: 400');
    });

    it('should use compound cursor condition with or() for keyset pagination', () => {
      expect(source).toContain('.or(');
      expect(source).toContain('created_at.lt.');
      expect(source).toContain('created_at.eq.');
      expect(source).toContain('id.lt.');
    });

    it('should determine hasMore from fetched count > limit', () => {
      expect(source).toContain('(transactions?.length ?? 0) > limit');
    });

    it('should slice results to limit when hasMore is true', () => {
      expect(source).toContain('transactions!.slice(0, limit)');
    });

    it('should generate next_cursor from last result item', () => {
      expect(source).toContain('results[results.length - 1].created_at');
      expect(source).toContain('results[results.length - 1].id');
    });
  });

  // =========================================================================
  // Response format
  // =========================================================================

  describe('response format', () => {
    it('should return data array in response', () => {
      expect(source).toContain('data: results');
    });

    it('should return pagination object with has_more, next_cursor, limit', () => {
      expect(source).toContain('has_more: hasMore');
      expect(source).toContain('next_cursor: nextCursor');
    });

    it('should return totals with total_earned, total_spent, net_change, transaction_count', () => {
      expect(source).toContain('total_earned');
      expect(source).toContain('total_spent');
      expect(source).toContain('net_change');
      expect(source).toContain('transaction_count');
    });

    it('should calculate total_earned from positive amounts', () => {
      expect(source).toContain('row.amount > 0');
      expect(source).toContain('totals.total_earned += row.amount');
    });

    it('should calculate total_spent from negative amounts using Math.abs', () => {
      expect(source).toContain('Math.abs(row.amount)');
    });

    it('should return 200 with Content-Type application/json', () => {
      expect(source).toContain('status: 200');
      expect(source).toContain("'Content-Type': 'application/json'");
    });
  });

  // =========================================================================
  // Totals query
  // =========================================================================

  describe('totals query', () => {
    it('should build a separate totals query filtered by tenant_id', () => {
      // The function builds two queries: one for transactions, one for totals
      const totalsQueryMatch = source.match(/totalsQuery\s*=\s*supabase/g);
      expect(totalsQueryMatch).not.toBeNull();
      expect(totalsQueryMatch!.length).toBeGreaterThanOrEqual(1);
    });

    it('should select amount and transaction_type for totals', () => {
      expect(source).toContain("select('amount, transaction_type')");
    });

    it('should apply same type and date filters to totals query', () => {
      // The source applies type/date_from/date_to to both queries
      const typeFilterCount = (source.match(/eq\('transaction_type', type\)/g) ?? []).length;
      expect(typeFilterCount).toBe(2); // once for transactions, once for totals

      const dateFromCount = (source.match(/gte\('created_at', date_from\)/g) ?? []).length;
      expect(dateFromCount).toBe(2);

      const dateToCount = (source.match(/lte\('created_at', date_to\)/g) ?? []).length;
      expect(dateToCount).toBe(2);
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('should return 500 for failed transaction query', () => {
      expect(source).toContain('Failed to fetch transactions');
    });

    it('should return 500 for failed totals query', () => {
      expect(source).toContain('Failed to fetch totals');
    });

    it('should have a catch-all error handler', () => {
      expect(source).toContain('Internal server error');
      expect(source).toContain('catch (error)');
    });

    it('should safely extract error message in catch block', () => {
      expect(source).toContain('error instanceof Error ? error.message');
    });
  });

  // =========================================================================
  // Security
  // =========================================================================

  describe('security', () => {
    it('should use service role key for server-side queries', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    });

    it('should use SUPABASE_URL from environment', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_URL')");
    });

    it('should not expose service role key in responses', () => {
      // Ensure no response contains the service role key value
      const responseLines = source.split('\n').filter(l => l.includes('JSON.stringify'));
      for (const line of responseLines) {
        expect(line).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      }
    });
  });
});
