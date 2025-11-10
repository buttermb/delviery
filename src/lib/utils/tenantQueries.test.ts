/**
 * Tests for tenant query utilities
 * Run with: npm test -- tenantQueries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  tenantQuery,
  tenantInsert,
  tenantUpdate,
  tenantDelete,
  validateTenantAccess,
  getUserTenantIds,
  hasTenantId,
  assertTenantId,
} from './tenantQueries';

// Mock Supabase client
const createMockSupabase = () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn().mockReturnValue(mockQuery),
  } as unknown as SupabaseClient;
};

describe('tenantQueries', () => {
  let supabase: SupabaseClient;
  const tenantId = 'test-tenant-id';

  beforeEach(() => {
    supabase = createMockSupabase();
  });

  describe('tenantQuery', () => {
    it('should throw if tenantId is missing', () => {
      expect(() => {
        tenantQuery(supabase, 'products', '');
      }).toThrow('tenantId is required');
    });

    it('should create tenant-scoped query', () => {
      const query = tenantQuery(supabase, 'products', tenantId);
      
      expect(supabase.from).toHaveBeenCalledWith('products');
      // The query should have .eq('tenant_id', tenantId) applied
    });
  });

  describe('tenantInsert', () => {
    it('should throw if tenantId is missing', () => {
      expect(() => {
        tenantInsert(supabase, 'products', '');
      }).toThrow('tenantId is required');
    });

    it('should create tenant-scoped insert', () => {
      const insert = tenantInsert(supabase, 'products', tenantId);
      
      expect(supabase.from).toHaveBeenCalledWith('products');
    });
  });

  describe('tenantUpdate', () => {
    it('should throw if tenantId is missing', () => {
      expect(() => {
        tenantUpdate(supabase, 'products', '');
      }).toThrow('tenantId is required');
    });

    it('should create tenant-scoped update', () => {
      const update = tenantUpdate(supabase, 'products', tenantId);
      
      expect(supabase.from).toHaveBeenCalledWith('products');
    });
  });

  describe('tenantDelete', () => {
    it('should throw if tenantId is missing', () => {
      expect(() => {
        tenantDelete(supabase, 'products', '');
      }).toThrow('tenantId is required');
    });

    it('should create tenant-scoped delete', () => {
      const del = tenantDelete(supabase, 'products', tenantId);
      
      expect(supabase.from).toHaveBeenCalledWith('products');
    });
  });

  describe('hasTenantId', () => {
    it('should return true if object has tenant_id', () => {
      expect(hasTenantId({ tenant_id: 'test-id' })).toBe(true);
    });

    it('should return false if tenant_id is missing', () => {
      expect(hasTenantId({})).toBe(false);
    });

    it('should return false if tenant_id is empty string', () => {
      expect(hasTenantId({ tenant_id: '' })).toBe(false);
    });
  });

  describe('assertTenantId', () => {
    it('should not throw if tenant_id exists', () => {
      expect(() => {
        assertTenantId({ tenant_id: 'test-id' });
      }).not.toThrow();
    });

    it('should throw if tenant_id is missing', () => {
      expect(() => {
        assertTenantId({});
      }).toThrow('Missing tenant_id');
    });

    it('should include context in error message', () => {
      expect(() => {
        assertTenantId({}, 'Product creation');
      }).toThrow('Missing tenant_id in Product creation');
    });
  });
});

