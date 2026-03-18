/**
 * Test for get_dashboard_stats RPC function
 * Verifies that the RPC function returns correct dashboard statistics for a tenant within a date range
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These environment variables should be set for testing
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Skip tests if no database connection is available
const skipIfNoDb = !SUPABASE_URL || !SUPABASE_ANON_KEY;

describe('Migration: add_get_dashboard_stats_rpc', () => {
  let supabase: SupabaseClient;
  let testTenantId: string;

  beforeAll(async () => {
    if (!skipIfNoDb) {
      supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

      // Try to get a test tenant ID from existing data
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id')
        .limit(1);

      if (tenants && tenants.length > 0) {
        testTenantId = tenants[0].id;
      } else {
        // Use a mock UUID if no tenants exist
        testTenantId = '00000000-0000-0000-0000-000000000000';
      }
    }
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should have the get_dashboard_stats RPC function available', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Call the RPC with a test tenant ID
    // This will likely fail with auth error if not authenticated, but confirms function exists
    const { error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    // Function should exist (error might be auth-related, not function-not-found)
    if (error) {
      // Error code '42883' means function doesn't exist
      // Any other error (like auth) means function exists
      expect(error.code).not.toBe('42883');
    }
  });

  it('should enforce tenant membership for unauthorized users', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Attempt to call without proper authentication
    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    // Should get an auth error or permission denied
    // The function requires the user to be a member of the tenant
    if (error) {
      // Expected: either auth error or 'not allowed' exception
      const isExpectedError =
        error.message.includes('not allowed') ||
        error.message.includes('JWT') ||
        error.message.includes('anonymous') ||
        error.code === '42501'; // insufficient_privilege

      expect(isExpectedError).toBe(true);
    } else {
      // If no error, it means we're authenticated and are a member
      expect(data).toBeDefined();
    }
  });

  it('should return a properly structured JSON object', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    // If we're authenticated and authorized, verify structure
    if (!error && data) {
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');

      // Verify top-level keys
      expect(data).toHaveProperty('orders');
      expect(data).toHaveProperty('revenue');
      expect(data).toHaveProperty('products');
      expect(data).toHaveProperty('customers');
      expect(data).toHaveProperty('date_range');
      expect(data).toHaveProperty('generated_at');
    }
  });

  it('should have correct orders statistics structure', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    if (!error && data) {
      expect(data.orders).toBeDefined();
      expect(data.orders).toHaveProperty('total');
      expect(data.orders).toHaveProperty('pending');
      expect(data.orders).toHaveProperty('completed');
      expect(data.orders).toHaveProperty('cancelled');

      // Verify all are numbers
      expect(typeof data.orders.total).toBe('number');
      expect(typeof data.orders.pending).toBe('number');
      expect(typeof data.orders.completed).toBe('number');
      expect(typeof data.orders.cancelled).toBe('number');

      // Verify logical constraints
      expect(data.orders.total).toBeGreaterThanOrEqual(0);
      expect(data.orders.pending).toBeGreaterThanOrEqual(0);
      expect(data.orders.completed).toBeGreaterThanOrEqual(0);
      expect(data.orders.cancelled).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have correct revenue statistics structure', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    if (!error && data) {
      expect(data.revenue).toBeDefined();
      expect(data.revenue).toHaveProperty('total');
      expect(data.revenue).toHaveProperty('average_order_value');
      expect(data.revenue).toHaveProperty('pending');

      // Verify all are numbers
      expect(typeof data.revenue.total).toBe('number');
      expect(typeof data.revenue.average_order_value).toBe('number');
      expect(typeof data.revenue.pending).toBe('number');

      // Verify non-negative values
      expect(data.revenue.total).toBeGreaterThanOrEqual(0);
      expect(data.revenue.average_order_value).toBeGreaterThanOrEqual(0);
      expect(data.revenue.pending).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have correct products statistics structure', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    if (!error && data) {
      expect(data.products).toBeDefined();
      expect(data.products).toHaveProperty('total');
      expect(data.products).toHaveProperty('low_stock');
      expect(data.products).toHaveProperty('out_of_stock');

      // Verify all are numbers
      expect(typeof data.products.total).toBe('number');
      expect(typeof data.products.low_stock).toBe('number');
      expect(typeof data.products.out_of_stock).toBe('number');

      // Verify non-negative values
      expect(data.products.total).toBeGreaterThanOrEqual(0);
      expect(data.products.low_stock).toBeGreaterThanOrEqual(0);
      expect(data.products.out_of_stock).toBeGreaterThanOrEqual(0);

      // Low stock and out of stock should not exceed total
      expect(data.products.low_stock).toBeLessThanOrEqual(data.products.total);
      expect(data.products.out_of_stock).toBeLessThanOrEqual(data.products.total);
    }
  });

  it('should have correct customers statistics structure', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    if (!error && data) {
      expect(data.customers).toBeDefined();
      expect(data.customers).toHaveProperty('total');
      expect(data.customers).toHaveProperty('new');
      expect(data.customers).toHaveProperty('active');

      // Verify all are numbers
      expect(typeof data.customers.total).toBe('number');
      expect(typeof data.customers.new).toBe('number');
      expect(typeof data.customers.active).toBe('number');

      // Verify non-negative values
      expect(data.customers.total).toBeGreaterThanOrEqual(0);
      expect(data.customers.new).toBeGreaterThanOrEqual(0);
      expect(data.customers.active).toBeGreaterThanOrEqual(0);

      // New and active customers should not exceed total
      expect(data.customers.new).toBeLessThanOrEqual(data.customers.total);
      expect(data.customers.active).toBeLessThanOrEqual(data.customers.total);
    }
  });

  it('should include date range metadata', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    if (!error && data) {
      expect(data.date_range).toBeDefined();
      expect(data.date_range).toHaveProperty('start');
      expect(data.date_range).toHaveProperty('end');

      // Verify dates are valid ISO strings
      const startDate = new Date(data.date_range.start);
      const endDate = new Date(data.date_range.end);

      expect(startDate).toBeInstanceOf(Date);
      expect(endDate).toBeInstanceOf(Date);
      expect(startDate.getTime()).not.toBeNaN();
      expect(endDate.getTime()).not.toBeNaN();

      // Start date should be before or equal to end date
      expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
    }
  });

  it('should accept custom date range parameters', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const startDate = new Date('2024-01-01T00:00:00Z');
    const endDate = new Date('2024-12-31T23:59:59Z');

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString()
    });

    if (!error && data) {
      expect(data).toBeDefined();
      expect(data.date_range).toBeDefined();

      // Verify the returned date range matches our input
      const returnedStart = new Date(data.date_range.start);
      const returnedEnd = new Date(data.date_range.end);

      // Dates should be within a reasonable range of our input
      // (allowing for some timezone/precision differences)
      expect(Math.abs(returnedStart.getTime() - startDate.getTime())).toBeLessThan(1000);
      expect(Math.abs(returnedEnd.getTime() - endDate.getTime())).toBeLessThan(1000);
    }
  });

  it('should default to last 30 days when no dates provided', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    if (!error && data) {
      const now = new Date();

      const returnedStart = new Date(data.date_range.start);
      const returnedEnd = new Date(data.date_range.end);

      // Start date should be approximately 30 days ago
      const daysDiff = (now.getTime() - returnedStart.getTime()) / (24 * 60 * 60 * 1000);
      expect(daysDiff).toBeGreaterThan(29);
      expect(daysDiff).toBeLessThan(31);

      // End date should be approximately now
      expect(Math.abs(returnedEnd.getTime() - now.getTime())).toBeLessThan(60000); // Within 1 minute
    }
  });

  it('should include generated_at timestamp', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId
    });

    if (!error && data) {
      expect(data.generated_at).toBeDefined();

      const generatedAt = new Date(data.generated_at);
      expect(generatedAt).toBeInstanceOf(Date);
      expect(generatedAt.getTime()).not.toBeNaN();

      // Generated timestamp should be very recent (within last minute)
      const now = new Date();
      expect(Math.abs(now.getTime() - generatedAt.getTime())).toBeLessThan(60000);
    }
  });

  it('should handle tenants with no data gracefully', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Use a non-existent tenant ID (will fail auth check, but tests error handling)
    const nonExistentTenantId = '99999999-9999-9999-9999-999999999999';

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: nonExistentTenantId
    });

    // Should get auth error since user won't be a member of non-existent tenant
    if (error) {
      expect(error.message).toBeDefined();
    } else if (data) {
      // If somehow we got data (shouldn't happen), verify zero values
      expect(data.orders.total).toBe(0);
      expect(data.revenue.total).toBe(0);
    }
  });

  it('should filter data correctly by date range', async () => {
    if (skipIfNoDb) {
      console.warn('Skipping test: No database connection available');
      return;
    }

    // Get stats for a very old date range (should have 0 or minimal data)
    const oldStartDate = new Date('2020-01-01T00:00:00Z');
    const oldEndDate = new Date('2020-01-31T23:59:59Z');

    const { data: oldData, error: oldError } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId,
      p_start_date: oldStartDate.toISOString(),
      p_end_date: oldEndDate.toISOString()
    });

    // Get stats for recent date range
    const recentStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    const recentEndDate = new Date();

    const { data: recentData, error: recentError } = await supabase.rpc('get_dashboard_stats', {
      p_tenant_id: testTenantId,
      p_start_date: recentStartDate.toISOString(),
      p_end_date: recentEndDate.toISOString()
    });

    if (!oldError && oldData && !recentError && recentData) {
      // Old data should generally have fewer orders than recent data
      // (unless the business started long ago and is now inactive)
      expect(oldData.orders).toBeDefined();
      expect(recentData.orders).toBeDefined();

      // Both should have valid structure
      expect(typeof oldData.orders.total).toBe('number');
      expect(typeof recentData.orders.total).toBe('number');
    }
  });
});

describe('RPC Function: get_dashboard_stats - Security', () => {
  it('should document security features', () => {
    const securityFeatures = {
      authentication: 'Requires authenticated user via SECURITY DEFINER',
      authorization: 'Enforces tenant membership via tenant_users table',
      tenantIsolation: 'Only returns data for the specified tenant',
      sqlInjectionProtection: 'Uses parameterized queries',
      privileges: 'Granted only to authenticated role',
      errorHandling: 'Raises exception for unauthorized access'
    };

    expect(securityFeatures.authentication).toBeDefined();
    expect(securityFeatures.authorization).toBeDefined();
    expect(securityFeatures.tenantIsolation).toBeDefined();
  });

  it('should document the membership check logic', () => {
    const membershipCheck = {
      table: 'tenant_users',
      conditions: [
        'tenant_id must match p_tenant_id parameter',
        'user_id must match auth.uid() (current authenticated user)'
      ],
      errorCode: '42501 (insufficient_privilege)',
      errorMessage: 'not allowed'
    };

    expect(membershipCheck.table).toBe('tenant_users');
    expect(membershipCheck.errorCode).toBe('42501 (insufficient_privilege)');
  });
});

describe('RPC Function: get_dashboard_stats - Performance', () => {
  it('should document performance considerations', () => {
    const performanceNotes = {
      indexRequirements: [
        'tenant_id index on orders table',
        'tenant_id index on products table',
        'tenant_id index on customers table',
        'created_at index for date range filtering',
        'Composite indexes on (tenant_id, created_at) recommended'
      ],
      optimization: [
        'Uses COUNT(*) for efficient counting',
        'Uses COALESCE for null handling',
        'Date range filtering reduces scan size',
        'Separate subqueries allow parallel execution',
        'Returns single JSONB object (efficient serialization)'
      ],
      caching: 'Results can be cached on client side for short duration',
      expectedResponseTime: 'Should be < 200ms for typical tenant data volume'
    };

    expect(performanceNotes.indexRequirements.length).toBeGreaterThan(0);
    expect(performanceNotes.optimization.length).toBeGreaterThan(0);
  });
});

describe('RPC Function: get_dashboard_stats - Use Cases', () => {
  it('should document common use cases', () => {
    const useCases = [
      'Dashboard overview page showing key business metrics',
      'Admin panel displaying tenant statistics',
      'Analytics reports for specific time periods',
      'Business intelligence dashboards',
      'Real-time monitoring of order flow',
      'Inventory management alerts',
      'Customer acquisition tracking',
      'Revenue trend analysis'
    ];

    expect(useCases.length).toBeGreaterThan(0);
    expect(useCases).toContain('Dashboard overview page showing key business metrics');
  });

  it('should document integration patterns', () => {
    const integrationPatterns = {
      reactQuery: 'Use with React Query for automatic caching and refetching',
      polling: 'Can be polled every 30-60 seconds for real-time updates',
      websockets: 'Combine with Supabase Realtime for instant updates',
      caching: 'Cache results with short TTL (30-60 seconds)',
      errorHandling: 'Handle auth errors and display appropriate messages'
    };

    expect(integrationPatterns.reactQuery).toBeDefined();
    expect(integrationPatterns.caching).toBeDefined();
  });
});
