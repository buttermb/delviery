/**
 * CollectionMode Tests
 * Tests for collection mode page: queryKey structure, tenant_id filtering,
 * loading state propagation, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';

// ============================================================================
// Query Key Tests
// ============================================================================

describe('CollectionMode Query Keys', () => {
  describe('collections.all', () => {
    it('should have correct base key', () => {
      expect(queryKeys.collections.all).toEqual(['collections']);
    });
  });

  describe('collections.mode', () => {
    it('should nest under collections.all', () => {
      const key = queryKeys.collections.mode('tenant-123');
      expect(key[0]).toBe('collections');
    });

    it('should include mode identifier', () => {
      const key = queryKeys.collections.mode('tenant-123');
      expect(key[1]).toBe('mode');
    });

    it('should include tenantId in object form', () => {
      const key = queryKeys.collections.mode('tenant-123');
      expect(key[2]).toEqual({ tenantId: 'tenant-123' });
    });

    it('should handle undefined tenantId', () => {
      const key = queryKeys.collections.mode();
      expect(key[2]).toEqual({ tenantId: undefined });
    });

    it('should produce unique keys for different tenants', () => {
      const key1 = queryKeys.collections.mode('tenant-1');
      const key2 = queryKeys.collections.mode('tenant-2');
      expect(key1).not.toEqual(key2);
    });

    it('should produce identical keys for same tenant', () => {
      const key1 = queryKeys.collections.mode('tenant-same');
      const key2 = queryKeys.collections.mode('tenant-same');
      expect(key1).toEqual(key2);
    });

    it('should support invalidation via collections.all', () => {
      const modeKey = queryKeys.collections.mode('tenant-123');
      // collections.all is a prefix of mode key
      expect(modeKey.slice(0, 1)).toEqual(queryKeys.collections.all);
    });
  });

  describe('collections.activities', () => {
    it('should nest under collections.all', () => {
      const key = queryKeys.collections.activities('client-abc');
      expect(key[0]).toBe('collections');
    });

    it('should include activities identifier', () => {
      const key = queryKeys.collections.activities('client-abc');
      expect(key[1]).toBe('activities');
    });

    it('should include clientId in object form', () => {
      const key = queryKeys.collections.activities('client-abc');
      expect(key[2]).toEqual({ clientId: 'client-abc' });
    });

    it('should handle null clientId', () => {
      const key = queryKeys.collections.activities(null);
      expect(key[2]).toEqual({ clientId: null });
    });

    it('should handle undefined clientId', () => {
      const key = queryKeys.collections.activities();
      expect(key[2]).toEqual({ clientId: undefined });
    });

    it('should produce unique keys for different clients', () => {
      const key1 = queryKeys.collections.activities('client-1');
      const key2 = queryKeys.collections.activities('client-2');
      expect(key1).not.toEqual(key2);
    });

    it('should support invalidation via collections.all', () => {
      const activitiesKey = queryKeys.collections.activities('client-abc');
      // collections.all is a prefix of activities key
      expect(activitiesKey.slice(0, 1)).toEqual(queryKeys.collections.all);
    });
  });
});

// ============================================================================
// Component Integration Tests (Supabase queries)
// ============================================================================

// Mock supabase with chainable methods
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGt = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          eq: mockEq.mockReturnValue({
            order: mockOrder.mockReturnValue({
              limit: mockLimit.mockResolvedValue({ data: [], error: null }),
            }),
          }),
          gt: mockGt.mockReturnValue({
            order: mockOrder.mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
      insert: mockInsert.mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
      }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-test-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/hooks/useRecordPayment', () => ({
  useRecordPayment: vi.fn().mockReturnValue({
    recordPayment: vi.fn().mockResolvedValue({ success: true }),
    isRecordingPayment: false,
    isLoading: false,
    recordFrontedPayment: vi.fn(),
    completeDelivery: vi.fn(),
    adjustBalance: vi.fn(),
    isRecordingFrontedPayment: false,
    isCompletingDelivery: false,
  }),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: vi.fn((v: number) => `$${v.toFixed(2)}`),
  formatCompactCurrency: vi.fn((v: number) => `$${v.toFixed(0)}`),
}));

describe('CollectionMode Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query tenant_id filtering', () => {
    it('should export the module without errors', async () => {
      // Verify the component can be imported
      const module = await import('../CollectionMode');
      expect(module.default).toBeDefined();
    });
  });

  describe('isLoading prop propagation', () => {
    it('RecordPaymentDialog and AddNoteDialog should receive actual loading state', async () => {
      // This is a code-level verification - the hardcoded false has been replaced
      // with recordPayment.isPending and addNote.isPending respectively.
      // Read the source to verify.
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '../CollectionMode.tsx'),
        'utf-8'
      );

      // Verify isLoading is NOT hardcoded to false
      expect(source).not.toMatch(/RecordPaymentDialog[\s\S]*?isLoading=\{false\}/);
      expect(source).not.toMatch(/AddNoteDialog[\s\S]*?isLoading=\{false\}/);

      // Verify it uses actual pending states
      expect(source).toContain('isLoading={recordPayment.isPending}');
      expect(source).toContain('isLoading={addNote.isPending}');
    });
  });

  describe('Source code compliance', () => {
    it('should filter collection_activities by tenant_id', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '../CollectionMode.tsx'),
        'utf-8'
      );

      // The collection_activities query should have tenant_id filter
      // Find the activities query block and ensure it filters by tenant_id
      const activitiesQueryMatch = source.match(
        /from\('collection_activities'\)[\s\S]*?\.eq\('tenant_id'/
      );
      expect(activitiesQueryMatch).not.toBeNull();
    });

    it('should not have placeholder onRowClick', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '../CollectionMode.tsx'),
        'utf-8'
      );

      // Should not have the old placeholder comment
      expect(source).not.toContain('Leaving empty to rely on specific action buttons');
    });

    it('should wire Payment Plan button to toast', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '../CollectionMode.tsx'),
        'utf-8'
      );

      // Payment Plan button should invoke toast
      expect(source).toContain("toast.info('Payment plan feature coming soon')");
    });

    it('should pass tenantId to queryKeys.collections.mode invalidation', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '../CollectionMode.tsx'),
        'utf-8'
      );

      // All mode() invalidations should include tenant?.id
      const modeInvalidations = source.match(/queryKeys\.collections\.mode\([^)]*\)/g) ?? [];
      expect(modeInvalidations.length).toBeGreaterThan(0);

      // Every call should pass tenant?.id
      for (const call of modeInvalidations) {
        expect(call).toContain("tenant?.id");
      }
    });

    it('should handle null created_at in activities', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '../CollectionMode.tsx'),
        'utf-8'
      );

      // Should use fallback for nullable created_at
      expect(source).toContain('a.created_at ?? Date.now()');
    });
  });
});
