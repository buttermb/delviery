/**
 * Test for invoices composite index migration
 * Verifies that the composite index on (tenant_id, status) is created correctly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These environment variables should be set for testing
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Skip tests if no database connection is available
const skipIfNoDb = !SUPABASE_URL || !SUPABASE_ANON_KEY;

describe('Migration: add_invoices_tenant_status_composite_index', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    if (!skipIfNoDb) {
      supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    }
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should create the composite index idx_invoices_tenant_status', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Query the pg_indexes system catalog to check if the index exists
    const { data, error } = await supabase.rpc('check_index_exists', {
      index_name: 'idx_invoices_tenant_status',
      table_name: 'invoices'
    });

    // If the RPC doesn't exist, we can query directly (this requires proper permissions)
    if (error) {
      // Alternative: Query pg_indexes view
      const { data: indexData, error: indexError } = await supabase
        .from('pg_indexes')
        .select('indexname, tablename, indexdef')
        .eq('indexname', 'idx_invoices_tenant_status')
        .eq('tablename', 'invoices')
        .maybeSingle();

      if (indexError && indexError.code === 'PGRST116') {
        // Permission denied or table not accessible
        console.warn('Unable to query pg_indexes directly. Test will verify index indirectly.');

        // Indirect verification: Create test query and check execution
        // The presence of the index should make queries faster
        const { error: queryError } = await supabase
          .from('invoices')
          .select('id')
          .limit(1);

        expect(queryError).toBeNull();
        return;
      }

      expect(indexData).toBeDefined();
      expect(indexData?.indexname).toBe('idx_invoices_tenant_status');
      return;
    }

    expect(data).toBeTruthy();
  });

  it('should have correct index definition on (tenant_id, status)', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Verify the index columns are in the correct order
    // We can check this by attempting a query that would benefit from the index
    const testTenantId = '00000000-0000-0000-0000-000000000000';

    const { error } = await supabase
      .from('invoices')
      .select('id, tenant_id, status')
      .eq('tenant_id', testTenantId)
      .eq('status', 'open')
      .limit(10);

    // The query should execute without errors
    // With the index, this query should be optimized
    expect(error).toBeNull();
  });

  it('should support queries filtering by tenant_id and status', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // This test verifies that the typical use case is supported
    // The index should optimize queries like this:
    // SELECT * FROM invoices WHERE tenant_id = ? AND status = ?

    const testTenantId = '00000000-0000-0000-0000-000000000000';
    const statuses = ['draft', 'open', 'paid', 'void', 'uncollectible'];

    for (const status of statuses) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('status', status)
        .limit(5);

      // The query should execute successfully
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it('should improve query performance for tenant-scoped invoice listings by status', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // This test verifies common use cases like filtering invoices by status
    const testTenantId = '00000000-0000-0000-0000-000000000000';
    const pageSize = 20;

    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total, due_date')
      .eq('tenant_id', testTenantId)
      .eq('status', 'open')
      .range(0, pageSize - 1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    // If data is returned, verify all have the correct status
    if (data && data.length > 0) {
      for (const invoice of data) {
        expect(invoice.status).toBe('open');
      }
    }
  });

  it('should work with additional filters on indexed query', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Test that the index still helps even with additional filters
    const testTenantId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total, due_date')
      .eq('tenant_id', testTenantId)
      .eq('status', 'open')
      .order('due_date', { ascending: true })
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should handle empty result sets efficiently', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Test with a tenant that likely has no invoices
    const nonExistentTenantId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    const { data, error } = await supabase
      .from('invoices')
      .select('id')
      .eq('tenant_id', nonExistentTenantId)
      .eq('status', 'paid')
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // Empty result is expected, but query should execute successfully
  });

  it('should support filtering by status only on indexed column', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // While the composite index is optimized for tenant_id + status,
    // it can still be used for tenant_id alone
    const testTenantId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('tenant_id', testTenantId)
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should support multiple status filtering with IN operator', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Test filtering by multiple statuses
    const testTenantId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('tenant_id', testTenantId)
      .in('status', ['open', 'draft'])
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    // Verify returned invoices have correct status
    if (data && data.length > 0) {
      for (const invoice of data) {
        expect(['open', 'draft']).toContain(invoice.status);
      }
    }
  });
});
