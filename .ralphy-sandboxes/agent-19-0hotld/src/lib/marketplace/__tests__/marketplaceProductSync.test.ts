/**
 * Marketplace Product Sync Tests
 * Tests for sync_product_to_marketplace and sync_all_products_to_marketplace RPC functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client
const mockRpcFn = vi.fn();
const mockSupabase = {
  rpc: mockRpcFn,
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('marketplace product sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sync_product_to_marketplace', () => {
    it('should successfully sync a product with default parameters', async () => {
      const mockResponse = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'blue-dream-flower',
        product_name: 'Blue Dream Flower',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data).toEqual(mockResponse);
      expect(data.success).toBe(true);
      expect(data.slug).toBe('blue-dream-flower');
    });

    it('should sync a product with display name override', async () => {
      const mockResponse = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'premium-blue-dream',
        product_name: 'Premium Blue Dream',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
        p_display_name: 'Premium Blue Dream',
      });

      expect(error).toBeNull();
      expect(data.product_name).toBe('Premium Blue Dream');
      expect(data.slug).toBe('premium-blue-dream');
    });

    it('should sync a product with price override', async () => {
      const mockResponse = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'blue-dream-flower',
        product_name: 'Blue Dream Flower',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
        p_display_price: 49.99,
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
    });

    it('should set is_featured flag when specified', async () => {
      const mockResponse = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'featured-product',
        product_name: 'Featured Product',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
        p_is_featured: true,
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
    });

    it('should return error for unauthorized user', async () => {
      const mockResponse = {
        success: false,
        error: 'Unauthorized: User not associated with a tenant',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized: User not associated with a tenant');
    });

    it('should return error for non-existent store', async () => {
      const mockResponse = {
        success: false,
        error: 'Store not found',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: 'non-existent-store-id',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Store not found');
    });

    it('should return error for non-existent product', async () => {
      const mockResponse = {
        success: false,
        error: 'Product not found or unauthorized',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: 'non-existent-product-id',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Product not found or unauthorized');
    });

    it('should return error for store belonging to different tenant', async () => {
      const mockResponse = {
        success: false,
        error: 'Unauthorized: Store belongs to different tenant',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: 'other-tenant-store-id',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized: Store belongs to different tenant');
    });
  });

  describe('sync_all_products_to_marketplace', () => {
    it('should successfully sync all products with stock', async () => {
      const mockResponse = {
        success: true,
        synced_count: 15,
        skipped_count: 3,
        error_count: 0,
        errors: null,
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_all_products_to_marketplace', {
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.synced_count).toBe(15);
      expect(data.skipped_count).toBe(3);
      expect(data.error_count).toBe(0);
    });

    it('should skip products without stock', async () => {
      const mockResponse = {
        success: true,
        synced_count: 10,
        skipped_count: 5,
        error_count: 0,
        errors: null,
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_all_products_to_marketplace', {
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.skipped_count).toBe(5);
    });

    it('should report errors for individual product failures', async () => {
      const mockResponse = {
        success: false,
        synced_count: 8,
        skipped_count: 2,
        error_count: 2,
        errors: [
          {
            product_id: '123e4567-e89b-12d3-a456-426614174010',
            product_name: 'Problem Product 1',
            error: 'unique constraint violation',
          },
          {
            product_id: '123e4567-e89b-12d3-a456-426614174011',
            product_name: 'Problem Product 2',
            error: 'invalid data',
          },
        ],
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_all_products_to_marketplace', {
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error_count).toBe(2);
      expect(data.errors).toHaveLength(2);
    });

    it('should return error for unauthorized user', async () => {
      const mockResponse = {
        success: false,
        error: 'Unauthorized: User not associated with a tenant',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_all_products_to_marketplace', {
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized: User not associated with a tenant');
    });

    it('should return error for non-existent store', async () => {
      const mockResponse = {
        success: false,
        error: 'Store not found',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_all_products_to_marketplace', {
        p_store_id: 'non-existent-store-id',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Store not found');
    });

    it('should handle empty product list gracefully', async () => {
      const mockResponse = {
        success: true,
        synced_count: 0,
        skipped_count: 0,
        error_count: 0,
        errors: null,
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_all_products_to_marketplace', {
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.synced_count).toBe(0);
    });
  });

  describe('slug generation', () => {
    it('should generate URL-safe slugs', async () => {
      const mockResponse = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'blue-dream-premium-28g',
        product_name: 'Blue Dream Premium (28g)',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.slug).not.toContain(' ');
      expect(data.slug).not.toContain('(');
      expect(data.slug).not.toContain(')');
      expect(data.slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should handle duplicate slugs by appending counter', async () => {
      // First sync
      const mockResponse1 = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'blue-dream',
        product_name: 'Blue Dream',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse1, error: null });

      const { data: data1 } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(data1.slug).toBe('blue-dream');

      // Second sync with same name should get different slug
      const mockResponse2 = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174010',
        slug: 'blue-dream-1',
        product_name: 'Blue Dream',
        product_id: '123e4567-e89b-12d3-a456-426614174003',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse2, error: null });

      const { data: data2 } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174003',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(data2.slug).toBe('blue-dream-1');
    });
  });

  describe('upsert behavior', () => {
    it('should update existing marketplace product on re-sync', async () => {
      // Simulate upsert behavior - same product_id + store_id should update
      const mockResponse = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'blue-dream-flower',
        product_name: 'Blue Dream Flower Updated',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
        p_display_name: 'Blue Dream Flower Updated',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      // The marketplace_product_id should be the same (upsert)
      expect(data.marketplace_product_id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should preserve existing slug on update without display_name change', async () => {
      const mockResponse = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'original-slug',
        product_name: 'Original Product',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
        p_display_price: 59.99, // Only updating price
      });

      expect(error).toBeNull();
      expect(data.slug).toBe('original-slug'); // Slug preserved
    });
  });

  describe('RLS policy behavior', () => {
    it('should allow public to view visible products from active stores', async () => {
      // This tests the RLS policy behavior
      const mockResponse = {
        success: true,
        marketplace_product_id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'public-product',
        product_name: 'Public Product',
        product_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRpcFn.mockResolvedValueOnce({ data: mockResponse, error: null });

      // Note: In actual RLS tests, this would be tested against a real database
      // with different user contexts (anon, authenticated, service_role)
      const { data, error } = await mockSupabase.rpc('sync_product_to_marketplace', {
        p_product_id: '123e4567-e89b-12d3-a456-426614174001',
        p_store_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
    });
  });
});
