/**
 * Query Keys Tests
 * Verifies that query keys follow consistent patterns and produce expected structures
 */

import { describe, it, expect } from 'vitest';
import { queryKeys } from '../queryKeys';

describe('Dashboard Query Keys', () => {
  describe('dashboard.widgets', () => {
    it('should generate correct key structure without tenantId', () => {
      const key = queryKeys.dashboard.widgets();
      expect(key).toEqual(['dashboard', 'widgets', undefined]);
    });

    it('should generate correct key structure with tenantId', () => {
      const tenantId = 'tenant-123';
      const key = queryKeys.dashboard.widgets(tenantId);
      expect(key).toEqual(['dashboard', 'widgets', 'tenant-123']);
    });

    it('should be properly typed as const', () => {
      const key = queryKeys.dashboard.widgets('tenant-123');
      // This test verifies TypeScript typing - if it compiles, the type is correct
      expect(Array.isArray(key)).toBe(true);
    });

    it('should include base dashboard key', () => {
      const key = queryKeys.dashboard.widgets('tenant-123');
      expect(key[0]).toBe('dashboard');
    });

    it('should include widgets identifier', () => {
      const key = queryKeys.dashboard.widgets('tenant-123');
      expect(key[1]).toBe('widgets');
    });

    it('should handle different tenantId formats', () => {
      const uuidTenant = queryKeys.dashboard.widgets('123e4567-e89b-12d3-a456-426614174000');
      const simpleTenant = queryKeys.dashboard.widgets('tenant-1');

      expect(uuidTenant[2]).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(simpleTenant[2]).toBe('tenant-1');
    });
  });

  describe('dashboard.stats', () => {
    it('should generate correct key structure with both parameters', () => {
      const key = queryKeys.dashboard.stats('tenant-123', 'last-7-days');
      expect(key).toEqual(['dashboard', 'stats', 'tenant-123', 'last-7-days']);
    });

    it('should generate correct key structure without parameters', () => {
      const key = queryKeys.dashboard.stats();
      expect(key).toEqual(['dashboard', 'stats', undefined, undefined]);
    });
  });

  describe('dashboard.alerts', () => {
    it('should generate correct key structure without tenantId', () => {
      const key = queryKeys.dashboard.alerts();
      expect(key).toEqual(['dashboard', 'alerts', undefined]);
    });

    it('should generate correct key structure with tenantId', () => {
      const tenantId = 'tenant-123';
      const key = queryKeys.dashboard.alerts(tenantId);
      expect(key).toEqual(['dashboard', 'alerts', 'tenant-123']);
    });

    it('should be properly typed as const', () => {
      const key = queryKeys.dashboard.alerts('tenant-123');
      // This test verifies TypeScript typing - if it compiles, the type is correct
      expect(Array.isArray(key)).toBe(true);
    });

    it('should include base dashboard key', () => {
      const key = queryKeys.dashboard.alerts('tenant-123');
      expect(key[0]).toBe('dashboard');
    });

    it('should include alerts identifier', () => {
      const key = queryKeys.dashboard.alerts('tenant-123');
      expect(key[1]).toBe('alerts');
    });

    it('should handle different tenantId formats', () => {
      const uuidTenant = queryKeys.dashboard.alerts('123e4567-e89b-12d3-a456-426614174000');
      const simpleTenant = queryKeys.dashboard.alerts('tenant-1');

      expect(uuidTenant[2]).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(simpleTenant[2]).toBe('tenant-1');
    });

    it('should handle empty string tenantId', () => {
      const key = queryKeys.dashboard.alerts('');
      expect(key).toEqual(['dashboard', 'alerts', '']);
    });

    it('should create unique keys for different tenant IDs', () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      const key1 = queryKeys.dashboard.alerts(tenant1);
      const key2 = queryKeys.dashboard.alerts(tenant2);

      expect(key1).not.toEqual(key2);
      expect(key1[2]).toBe(tenant1);
      expect(key2[2]).toBe(tenant2);
    });

    it('should create identical keys for same tenant ID', () => {
      const key1 = queryKeys.dashboard.alerts('tenant-same');
      const key2 = queryKeys.dashboard.alerts('tenant-same');

      expect(key1).toEqual(key2);
    });

    it('should be suitable for useQuery', () => {
      const tenantId = 'tenant-123';
      const key = queryKeys.dashboard.alerts(tenantId);

      // TanStack Query expects array keys
      expect(Array.isArray(key)).toBe(true);
      // Should have at least 2 elements for proper caching
      expect(key.length).toBeGreaterThanOrEqual(2);
      // First element should be a string identifier
      expect(typeof key[0]).toBe('string');
    });

    it('should support query invalidation patterns', () => {
      // Invalidating all dashboard queries
      const baseKey = queryKeys.dashboard.all;
      expect(baseKey).toEqual(['dashboard']);

      // Invalidating all alert queries (would match dashboard.alerts with any params)
      const alertsPattern = ['dashboard', 'alerts'];
      const alertsKey = queryKeys.dashboard.alerts('any-tenant');
      expect(alertsKey.slice(0, 2)).toEqual(alertsPattern);
    });

    it('should be different from inventory.alerts', () => {
      const dashboardAlertsKey = queryKeys.dashboard.alerts('tenant-123');
      const inventoryAlertsKey = queryKeys.inventory.alerts();

      // Both should exist and be different
      expect(dashboardAlertsKey).toBeDefined();
      expect(inventoryAlertsKey).toBeDefined();
      expect(dashboardAlertsKey).not.toEqual(inventoryAlertsKey);
      expect(dashboardAlertsKey[0]).toBe('dashboard');
      expect(inventoryAlertsKey[0]).toBe('inventory');
    });

    it('should be different from inventory.lowStockAlerts', () => {
      const tenantId = 'tenant-123';
      const dashboardAlertsKey = queryKeys.dashboard.alerts(tenantId);
      const lowStockAlertsKey = queryKeys.inventory.lowStockAlerts(tenantId);

      expect(dashboardAlertsKey[0]).toBe('dashboard');
      expect(lowStockAlertsKey[0]).toBe('inventory');
      expect(dashboardAlertsKey).not.toEqual(lowStockAlertsKey);
    });
  });

  describe('dashboard base key', () => {
    it('should have correct all key', () => {
      const key = queryKeys.dashboard.all;
      expect(key).toEqual(['dashboard']);
    });

    it('should be used as base for all dashboard keys', () => {
      const statsKey = queryKeys.dashboard.stats('tenant-1', 'today');
      const widgetsKey = queryKeys.dashboard.widgets('tenant-1');
      const alertsKey = queryKeys.dashboard.alerts('tenant-1');

      expect(statsKey[0]).toBe(queryKeys.dashboard.all[0]);
      expect(widgetsKey[0]).toBe(queryKeys.dashboard.all[0]);
      expect(alertsKey[0]).toBe(queryKeys.dashboard.all[0]);
    });
  });
});

describe('Query Keys Consistency', () => {
  describe('Pattern Compliance', () => {
    it('dashboard keys should follow factory pattern', () => {
      // Verify that all dashboard methods return arrays starting with base key
      const statsKey = queryKeys.dashboard.stats('test', 'range');
      const widgetsKey = queryKeys.dashboard.widgets('test');
      const alertsKey = queryKeys.dashboard.alerts('test');

      expect(statsKey).toBeInstanceOf(Array);
      expect(widgetsKey).toBeInstanceOf(Array);
      expect(alertsKey).toBeInstanceOf(Array);
      expect(statsKey[0]).toBe('dashboard');
      expect(widgetsKey[0]).toBe('dashboard');
      expect(alertsKey[0]).toBe('dashboard');
    });

    it('should maintain type safety with as const', () => {
      const widgetsKey = queryKeys.dashboard.widgets('test');
      const alertsKey = queryKeys.dashboard.alerts('test');
      // If this compiles, the type is readonly
      expect(Object.isFrozen(widgetsKey)).toBe(false); // Array with as const is not frozen, but typed as readonly
      expect(Object.isFrozen(alertsKey)).toBe(false);
    });
  });

  describe('Key Uniqueness', () => {
    it('different dashboard query types should produce different keys', () => {
      const statsKey = queryKeys.dashboard.stats('tenant-1', 'today');
      const widgetsKey = queryKeys.dashboard.widgets('tenant-1');
      const alertsKey = queryKeys.dashboard.alerts('tenant-1');

      expect(statsKey).not.toEqual(widgetsKey);
      expect(statsKey).not.toEqual(alertsKey);
      expect(widgetsKey).not.toEqual(alertsKey);
    });

    it('same query type with different params should produce different keys', () => {
      const widgets1 = queryKeys.dashboard.widgets('tenant-1');
      const widgets2 = queryKeys.dashboard.widgets('tenant-2');
      const alerts1 = queryKeys.dashboard.alerts('tenant-1');
      const alerts2 = queryKeys.dashboard.alerts('tenant-2');

      expect(widgets1).not.toEqual(widgets2);
      expect(alerts1).not.toEqual(alerts2);
    });

    it('same query type with same params should produce identical keys', () => {
      const widgets1 = queryKeys.dashboard.widgets('tenant-1');
      const widgets2 = queryKeys.dashboard.widgets('tenant-1');
      const alerts1 = queryKeys.dashboard.alerts('tenant-1');
      const alerts2 = queryKeys.dashboard.alerts('tenant-1');

      expect(widgets1).toEqual(widgets2);
      expect(alerts1).toEqual(alerts2);
    });
  });
});

describe('Integration with TanStack Query', () => {
  it('dashboard.widgets key should be suitable for useQuery', () => {
    const tenantId = 'tenant-123';
    const key = queryKeys.dashboard.widgets(tenantId);

    // TanStack Query expects array keys
    expect(Array.isArray(key)).toBe(true);
    // Should have at least 2 elements for proper caching
    expect(key.length).toBeGreaterThanOrEqual(2);
    // First element should be a string identifier
    expect(typeof key[0]).toBe('string');
  });

  it('should support query invalidation patterns', () => {
    // Invalidating all dashboard queries
    const baseKey = queryKeys.dashboard.all;
    expect(baseKey).toEqual(['dashboard']);

    // Invalidating all widget queries (would match dashboard.widgets with any params)
    const widgetsPattern = ['dashboard', 'widgets'];
    const widgetsKey = queryKeys.dashboard.widgets('any-tenant');
    expect(widgetsKey.slice(0, 2)).toEqual(widgetsPattern);
  });
});

describe('Inventory Query Keys', () => {
  describe('inventory.summary', () => {
    it('should generate correct key structure without tenantId', () => {
      const key = queryKeys.inventory.summary();
      expect(key).toEqual(['inventory', 'summary', undefined]);
    });

    it('should generate correct key structure with tenantId', () => {
      const tenantId = 'tenant-456';
      const key = queryKeys.inventory.summary(tenantId);
      expect(key).toEqual(['inventory', 'summary', 'tenant-456']);
    });

    it('should be properly typed as const', () => {
      const key = queryKeys.inventory.summary('tenant-456');
      // This test verifies TypeScript typing - if it compiles, the type is correct
      expect(Array.isArray(key)).toBe(true);
    });

    it('should include base inventory key', () => {
      const key = queryKeys.inventory.summary('tenant-456');
      expect(key[0]).toBe('inventory');
    });

    it('should include summary identifier', () => {
      const key = queryKeys.inventory.summary('tenant-456');
      expect(key[1]).toBe('summary');
    });

    it('should handle different tenantId formats', () => {
      const uuidTenant = queryKeys.inventory.summary('123e4567-e89b-12d3-a456-426614174000');
      const simpleTenant = queryKeys.inventory.summary('tenant-1');

      expect(uuidTenant[2]).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(simpleTenant[2]).toBe('tenant-1');
    });

    it('should maintain inheritance from inventory.all', () => {
      const summary = queryKeys.inventory.summary('tenant-789');
      // First element should be from inventory.all
      expect(summary[0]).toBe(queryKeys.inventory.all[0]);
      expect(summary.slice(0, 1)).toEqual(queryKeys.inventory.all);
    });

    it('should support query invalidation patterns', () => {
      // Invalidating all inventory queries
      const baseKey = queryKeys.inventory.all;
      expect(baseKey).toEqual(['inventory']);

      // Invalidating all summary queries
      const summaryPattern = ['inventory', 'summary'];
      const summaryKey = queryKeys.inventory.summary('any-tenant');
      expect(summaryKey.slice(0, 2)).toEqual(summaryPattern);
    });
  });

  describe('inventory base key', () => {
    it('should have correct all key', () => {
      const key = queryKeys.inventory.all;
      expect(key).toEqual(['inventory']);
    });

    it('should be used as base for all inventory keys', () => {
      const summaryKey = queryKeys.inventory.summary('tenant-1');
      const alertsKey = queryKeys.inventory.alerts();
      const locationsKey = queryKeys.inventory.locations('tenant-1');

      expect(summaryKey[0]).toBe(queryKeys.inventory.all[0]);
      expect(alertsKey[0]).toBe(queryKeys.inventory.all[0]);
      expect(locationsKey[0]).toBe(queryKeys.inventory.all[0]);
    });
  });

  describe('inventory.summary - TanStack Query compatibility', () => {
    it('should be suitable for useQuery', () => {
      const tenantId = 'tenant-789';
      const key = queryKeys.inventory.summary(tenantId);

      // TanStack Query expects array keys
      expect(Array.isArray(key)).toBe(true);
      // Should have at least 2 elements for proper caching
      expect(key.length).toBeGreaterThanOrEqual(2);
      // First element should be a string identifier
      expect(typeof key[0]).toBe('string');
    });

    it('should be suitable for invalidateQueries', () => {
      const tenantId = 'tenant-abc';
      const key = queryKeys.inventory.summary(tenantId);

      // Should be usable in invalidateQueries
      const mockInvalidateConfig = {
        queryKey: key,
      };

      expect(mockInvalidateConfig.queryKey).toEqual(['inventory', 'summary', 'tenant-abc']);
    });

    it('should produce unique keys for different tenants', () => {
      const key1 = queryKeys.inventory.summary('tenant-1');
      const key2 = queryKeys.inventory.summary('tenant-2');

      expect(key1).not.toEqual(key2);
      expect(key1[2]).toBe('tenant-1');
      expect(key2[2]).toBe('tenant-2');
    });

    it('should produce identical keys for same tenant', () => {
      const key1 = queryKeys.inventory.summary('tenant-same');
      const key2 = queryKeys.inventory.summary('tenant-same');

      expect(key1).toEqual(key2);
    });
  });

  describe('inventory.summary - edge cases', () => {
    it('should handle empty string tenantId', () => {
      const key = queryKeys.inventory.summary('');
      expect(key).toEqual(['inventory', 'summary', '']);
    });

    it('should handle special characters in tenantId', () => {
      const specialId = 'tenant-with-special-chars-!@#$%';
      const key = queryKeys.inventory.summary(specialId);
      expect(key[2]).toBe(specialId);
    });
  });
});

describe('Finance Query Keys', () => {
  describe('finance.snapshot', () => {
    it('should generate correct key structure without dateRange', () => {
      const key = queryKeys.finance.snapshot();
      expect(key).toEqual(['finance', 'snapshot', { dateRange: undefined }]);
    });

    it('should generate correct key structure with dateRange', () => {
      const dateRange = '7d';
      const key = queryKeys.finance.snapshot(dateRange);
      expect(key).toEqual(['finance', 'snapshot', { dateRange: '7d' }]);
    });

    it('should be properly typed as const', () => {
      const key = queryKeys.finance.snapshot('30d');
      // This test verifies TypeScript typing - if it compiles, the type is correct
      expect(Array.isArray(key)).toBe(true);
    });

    it('should include base finance key', () => {
      const key = queryKeys.finance.snapshot('7d');
      expect(key[0]).toBe('finance');
    });

    it('should include snapshot identifier', () => {
      const key = queryKeys.finance.snapshot('7d');
      expect(key[1]).toBe('snapshot');
    });

    it('should handle different dateRange formats', () => {
      const key7d = queryKeys.finance.snapshot('7d');
      const key30d = queryKeys.finance.snapshot('30d');
      const key90d = queryKeys.finance.snapshot('90d');

      expect(key7d[2]).toEqual({ dateRange: '7d' });
      expect(key30d[2]).toEqual({ dateRange: '30d' });
      expect(key90d[2]).toEqual({ dateRange: '90d' });
    });

    it('should maintain inheritance from finance.all', () => {
      const snapshot = queryKeys.finance.snapshot('7d');
      // First element should be from finance.all
      expect(snapshot[0]).toBe(queryKeys.finance.all[0]);
      expect(snapshot.slice(0, 1)).toEqual(queryKeys.finance.all);
    });

    it('should support query invalidation patterns', () => {
      // Invalidating all finance queries
      const baseKey = queryKeys.finance.all;
      expect(baseKey).toEqual(['finance']);

      // Invalidating all snapshot queries
      const snapshotPattern = ['finance', 'snapshot'];
      const snapshotKey = queryKeys.finance.snapshot('7d');
      expect(snapshotKey.slice(0, 2)).toEqual(snapshotPattern);
    });
  });

  describe('finance base key', () => {
    it('should have correct all key', () => {
      const key = queryKeys.finance.all;
      expect(key).toEqual(['finance']);
    });

    it('should be used as base for all finance keys', () => {
      const revenueKey = queryKeys.finance.revenue('tenant-1');
      const completedOrdersKey = queryKeys.finance.completedOrders('tenant-1', '30d');
      const revenueGoalKey = queryKeys.finance.revenueGoal('tenant-1');
      const snapshotKey = queryKeys.finance.snapshot('7d');

      expect(revenueKey[0]).toBe(queryKeys.finance.all[0]);
      expect(completedOrdersKey[0]).toBe(queryKeys.finance.all[0]);
      expect(revenueGoalKey[0]).toBe(queryKeys.finance.all[0]);
      expect(snapshotKey[0]).toBe(queryKeys.finance.all[0]);
    });
  });

  describe('finance.snapshot - TanStack Query compatibility', () => {
    it('should be suitable for useQuery', () => {
      const dateRange = '7d';
      const key = queryKeys.finance.snapshot(dateRange);

      // TanStack Query expects array keys
      expect(Array.isArray(key)).toBe(true);
      // Should have at least 2 elements for proper caching
      expect(key.length).toBeGreaterThanOrEqual(2);
      // First element should be a string identifier
      expect(typeof key[0]).toBe('string');
    });

    it('should be suitable for invalidateQueries', () => {
      const dateRange = '30d';
      const key = queryKeys.finance.snapshot(dateRange);

      // Should be usable in invalidateQueries
      const mockInvalidateConfig = {
        queryKey: key,
      };

      expect(mockInvalidateConfig.queryKey).toEqual(['finance', 'snapshot', { dateRange: '30d' }]);
    });

    it('should produce unique keys for different date ranges', () => {
      const key1 = queryKeys.finance.snapshot('7d');
      const key2 = queryKeys.finance.snapshot('30d');

      expect(key1).not.toEqual(key2);
      expect(key1[2]).toEqual({ dateRange: '7d' });
      expect(key2[2]).toEqual({ dateRange: '30d' });
    });

    it('should produce identical keys for same date range', () => {
      const key1 = queryKeys.finance.snapshot('7d');
      const key2 = queryKeys.finance.snapshot('7d');

      expect(key1).toEqual(key2);
    });
  });

  describe('finance.snapshot - edge cases', () => {
    it('should handle empty string dateRange', () => {
      const key = queryKeys.finance.snapshot('');
      expect(key).toEqual(['finance', 'snapshot', { dateRange: '' }]);
    });

    it('should handle custom date range formats', () => {
      const customRange = '2024-01-01_2024-12-31';
      const key = queryKeys.finance.snapshot(customRange);
      expect(key[2]).toEqual({ dateRange: customRange });
    });

    it('should be different from other finance query keys', () => {
      const snapshotKey = queryKeys.finance.snapshot('7d');
      const revenueKey = queryKeys.finance.revenue('tenant-123');
      const completedOrdersKey = queryKeys.finance.completedOrders('tenant-123', '7d');

      expect(snapshotKey).not.toEqual(revenueKey);
      expect(snapshotKey).not.toEqual(completedOrdersKey);
      expect(snapshotKey[1]).toBe('snapshot');
      expect(revenueKey[1]).toBe('revenue');
      expect(completedOrdersKey[1]).toBe('completed-orders');
    });
  });
});

describe('Analytics Query Keys', () => {
  describe('analytics.realtime', () => {
    it('should generate correct key structure without filters', () => {
      const key = queryKeys.analytics.realtime();
      expect(key).toEqual(['analytics', 'realtime', undefined]);
    });

    it('should generate correct key structure with filters', () => {
      const filters = { tenantId: 'tenant-123', granularity: 'daily' };
      const key = queryKeys.analytics.realtime(filters);
      expect(key).toEqual(['analytics', 'realtime', filters]);
    });

    it('should be properly typed as const', () => {
      const key = queryKeys.analytics.realtime({ tenantId: 'tenant-456' });
      // This test verifies TypeScript typing - if it compiles, the type is correct
      expect(Array.isArray(key)).toBe(true);
    });

    it('should include base analytics key', () => {
      const key = queryKeys.analytics.realtime({ tenantId: 'tenant-789' });
      expect(key[0]).toBe('analytics');
    });

    it('should include realtime identifier', () => {
      const key = queryKeys.analytics.realtime({ tenantId: 'tenant-abc' });
      expect(key[1]).toBe('realtime');
    });

    it('should handle different filter formats', () => {
      const filter1 = queryKeys.analytics.realtime({ tenantId: 'tenant-1' });
      const filter2 = queryKeys.analytics.realtime({ tenantId: 'tenant-2', granularity: 'weekly' });
      const filter3 = queryKeys.analytics.realtime({ period: '7d' });

      expect(filter1[2]).toEqual({ tenantId: 'tenant-1' });
      expect(filter2[2]).toEqual({ tenantId: 'tenant-2', granularity: 'weekly' });
      expect(filter3[2]).toEqual({ period: '7d' });
    });

    it('should maintain inheritance from analytics.all', () => {
      const realtime = queryKeys.analytics.realtime({ tenantId: 'tenant-xyz' });
      // First element should be from analytics.all
      expect(realtime[0]).toBe(queryKeys.analytics.all[0]);
      expect(realtime.slice(0, 1)).toEqual(queryKeys.analytics.all);
    });

    it('should support query invalidation patterns', () => {
      // Invalidating all analytics queries
      const baseKey = queryKeys.analytics.all;
      expect(baseKey).toEqual(['analytics']);

      // Invalidating all realtime queries
      const realtimePattern = ['analytics', 'realtime'];
      const realtimeKey = queryKeys.analytics.realtime({ tenantId: 'any-tenant' });
      expect(realtimeKey.slice(0, 2)).toEqual(realtimePattern);
    });
  });

  describe('analytics base key', () => {
    it('should have correct all key', () => {
      const key = queryKeys.analytics.all;
      expect(key).toEqual(['analytics']);
    });

    it('should be used as base for all analytics keys', () => {
      const revenueKey = queryKeys.analytics.revenue({ period: 'monthly' });
      const ordersKey = queryKeys.analytics.orders({ status: 'completed' });
      const realtimeKey = queryKeys.analytics.realtime({ tenantId: 'tenant-1' });

      expect(revenueKey[0]).toBe(queryKeys.analytics.all[0]);
      expect(ordersKey[0]).toBe(queryKeys.analytics.all[0]);
      expect(realtimeKey[0]).toBe(queryKeys.analytics.all[0]);
    });
  });

  describe('analytics.realtime - TanStack Query compatibility', () => {
    it('should be suitable for useQuery', () => {
      const filters = { tenantId: 'tenant-123', granularity: 'daily' };
      const key = queryKeys.analytics.realtime(filters);

      // TanStack Query expects array keys
      expect(Array.isArray(key)).toBe(true);
      // Should have at least 2 elements for proper caching
      expect(key.length).toBeGreaterThanOrEqual(2);
      // First element should be a string identifier
      expect(typeof key[0]).toBe('string');
    });

    it('should be suitable for invalidateQueries', () => {
      const filters = { tenantId: 'tenant-abc' };
      const key = queryKeys.analytics.realtime(filters);

      // Should be usable in invalidateQueries
      const mockInvalidateConfig = {
        queryKey: key,
      };

      expect(mockInvalidateConfig.queryKey).toEqual(['analytics', 'realtime', filters]);
    });

    it('should produce unique keys for different filters', () => {
      const key1 = queryKeys.analytics.realtime({ tenantId: 'tenant-1' });
      const key2 = queryKeys.analytics.realtime({ tenantId: 'tenant-2' });

      expect(key1).not.toEqual(key2);
      expect(key1[2]).toEqual({ tenantId: 'tenant-1' });
      expect(key2[2]).toEqual({ tenantId: 'tenant-2' });
    });

    it('should produce identical keys for same filters', () => {
      const filters = { tenantId: 'tenant-same', granularity: 'daily' };
      const key1 = queryKeys.analytics.realtime(filters);
      const key2 = queryKeys.analytics.realtime(filters);

      expect(key1).toEqual(key2);
    });
  });

  describe('analytics.realtime - edge cases', () => {
    it('should handle empty object filters', () => {
      const key = queryKeys.analytics.realtime({});
      expect(key).toEqual(['analytics', 'realtime', {}]);
    });

    it('should handle complex filter objects', () => {
      const complexFilters = {
        tenantId: 'tenant-123',
        granularity: 'daily',
        dateRange: { start: '2024-01-01', end: '2024-01-31' },
        metrics: ['revenue', 'orders'],
      };
      const key = queryKeys.analytics.realtime(complexFilters);
      expect(key[2]).toBe(complexFilters);
    });

    it('should be different from other analytics query types', () => {
      const realtimeKey = queryKeys.analytics.realtime({ tenantId: 'tenant-123' });
      const revenueKey = queryKeys.analytics.revenue({ tenantId: 'tenant-123' });
      const ordersKey = queryKeys.analytics.orders({ tenantId: 'tenant-123' });

      expect(realtimeKey[1]).toBe('realtime');
      expect(revenueKey[1]).toBe('revenue');
      expect(ordersKey[1]).toBe('orders');
      expect(realtimeKey).not.toEqual(revenueKey);
      expect(realtimeKey).not.toEqual(ordersKey);
    });
  });
});

describe('Orders Query Keys', () => {
  describe('orders.pipeline', () => {
    it('should generate correct key structure without filters', () => {
      const key = queryKeys.orders.pipeline();
      expect(key).toEqual(['orders', 'pipeline', undefined]);
    });

    it('should generate correct key structure with filters', () => {
      const filters = { status: 'processing' };
      const key = queryKeys.orders.pipeline(filters);
      expect(key).toEqual(['orders', 'pipeline', { status: 'processing' }]);
    });

    it('should be properly typed as const', () => {
      const key = queryKeys.orders.pipeline({ status: 'pending' });
      // This test verifies TypeScript typing - if it compiles, the type is correct
      expect(Array.isArray(key)).toBe(true);
    });

    it('should include base orders key', () => {
      const key = queryKeys.orders.pipeline({ status: 'processing' });
      expect(key[0]).toBe('orders');
    });

    it('should include pipeline identifier', () => {
      const key = queryKeys.orders.pipeline({ status: 'processing' });
      expect(key[1]).toBe('pipeline');
    });

    it('should handle different filter combinations', () => {
      const statusFilter = queryKeys.orders.pipeline({ status: 'pending' });
      const multiFilter = queryKeys.orders.pipeline({ status: 'processing', priority: 'high' });
      const emptyFilter = queryKeys.orders.pipeline({});

      expect(statusFilter[2]).toEqual({ status: 'pending' });
      expect(multiFilter[2]).toEqual({ status: 'processing', priority: 'high' });
      expect(emptyFilter[2]).toEqual({});
    });

    it('should maintain inheritance from orders.all', () => {
      const pipeline = queryKeys.orders.pipeline({ status: 'shipped' });
      // First element should be from orders.all
      expect(pipeline[0]).toBe(queryKeys.orders.all[0]);
      expect(pipeline.slice(0, 1)).toEqual(queryKeys.orders.all);
    });

    it('should support query invalidation patterns', () => {
      // Invalidating all orders queries
      const baseKey = queryKeys.orders.all;
      expect(baseKey).toEqual(['orders']);

      // Invalidating all pipeline queries
      const pipelinePattern = ['orders', 'pipeline'];
      const pipelineKey = queryKeys.orders.pipeline({ status: 'any' });
      expect(pipelineKey.slice(0, 2)).toEqual(pipelinePattern);
    });

    it('should be suitable for useQuery', () => {
      const filters = { status: 'processing' };
      const key = queryKeys.orders.pipeline(filters);

      // TanStack Query expects array keys
      expect(Array.isArray(key)).toBe(true);
      // Should have at least 2 elements for proper caching
      expect(key.length).toBeGreaterThanOrEqual(2);
      // First element should be a string identifier
      expect(typeof key[0]).toBe('string');
    });

    it('should produce unique keys for different filters', () => {
      const key1 = queryKeys.orders.pipeline({ status: 'pending' });
      const key2 = queryKeys.orders.pipeline({ status: 'processing' });

      expect(key1).not.toEqual(key2);
      expect(key1[2]).toEqual({ status: 'pending' });
      expect(key2[2]).toEqual({ status: 'processing' });
    });

    it('should produce identical keys for same filters', () => {
      const key1 = queryKeys.orders.pipeline({ status: 'pending' });
      const key2 = queryKeys.orders.pipeline({ status: 'pending' });

      expect(key1).toEqual(key2);
    });

    it('should be different from orders.list', () => {
      const pipelineKey = queryKeys.orders.pipeline({ status: 'pending' });
      const listKey = queryKeys.orders.list({ status: 'pending' });

      expect(pipelineKey).not.toEqual(listKey);
      expect(pipelineKey[1]).toBe('pipeline');
      expect(listKey[1]).not.toBe('pipeline');
    });

    it('should handle complex filter objects', () => {
      const complexFilters = {
        status: 'processing',
        dateRange: { start: '2024-01-01', end: '2024-12-31' },
        tags: ['urgent', 'wholesale'],
        limit: 50
      };
      const key = queryKeys.orders.pipeline(complexFilters);
      expect(key[2]).toEqual(complexFilters);
    });

    it('should handle edge case filters', () => {
      const nullValue = queryKeys.orders.pipeline({ search: null });
      const undefinedValue = queryKeys.orders.pipeline({ search: undefined });
      const emptyString = queryKeys.orders.pipeline({ search: '' });

      expect(nullValue[2]).toEqual({ search: null });
      expect(undefinedValue[2]).toEqual({ search: undefined });
      expect(emptyString[2]).toEqual({ search: '' });
    });
  });

  describe('orders base key', () => {
    it('should have correct all key', () => {
      const key = queryKeys.orders.all;
      expect(key).toEqual(['orders']);
    });

    it('should be used as base for all orders keys', () => {
      const listKey = queryKeys.orders.list({ status: 'pending' });
      const detailKey = queryKeys.orders.detail('order-123');
      const pipelineKey = queryKeys.orders.pipeline({ status: 'processing' });

      expect(listKey[0]).toBe(queryKeys.orders.all[0]);
      expect(detailKey[0]).toBe(queryKeys.orders.all[0]);
      expect(pipelineKey[0]).toBe(queryKeys.orders.all[0]);
    });
  });
});
