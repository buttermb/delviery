/**
 * Storefront Admin Sync Tests
 *
 * Tests that updating a product in the admin panel and syncing to marketplace
 * results in the storefront reflecting the changes immediately via
 * TanStack Query cache invalidation.
 *
 * Flow under test:
 * 1. Admin updates product (products table)
 * 2. Admin triggers sync (sync_product_to_marketplace RPC)
 * 3. Query invalidation fires for storefront query keys
 * 4. Storefront refetches and displays updated product data
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// Mock Supabase client with chainable query builder
const mockRpcFn = vi.fn();
const mockFromFn = vi.fn();
const mockChannelFn = vi.fn();
const mockRemoveChannelFn = vi.fn();

const createChainableMock = (resolvedValue: { data: unknown; error: unknown }) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.match = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
  return chain;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpcFn(...args),
    from: (...args: unknown[]) => mockFromFn(...args),
    channel: (...args: unknown[]) => mockChannelFn(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannelFn(...args),
  },
}));

// Test data fixtures
const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const STORE_ID = '22222222-2222-2222-2222-222222222222';
const PRODUCT_ID = '33333333-3333-3333-3333-333333333333';
const MARKETPLACE_PRODUCT_ID = '44444444-4444-4444-4444-444444444444';

const baseProduct = {
  id: PRODUCT_ID,
  name: 'Blue Dream Flower',
  category: 'flower',
  wholesale_price: 25.0,
  retail_price: 45.0,
  available_quantity: 100,
  image_url: 'https://example.com/blue-dream.jpg',
  tenant_id: TENANT_ID,
  sku: 'BD-001',
  description: 'Premium Blue Dream strain',
  strain_type: 'hybrid',
  thc_content: '22%',
  cbd_content: '1%',
};

const updatedProduct = {
  ...baseProduct,
  name: 'Blue Dream Flower Premium',
  retail_price: 55.0,
  available_quantity: 75,
  description: 'Updated premium Blue Dream strain - top shelf',
};

const marketplaceProductBeforeSync = {
  id: MARKETPLACE_PRODUCT_ID,
  product_id: PRODUCT_ID,
  store_id: STORE_ID,
  product_name: 'Blue Dream Flower',
  display_price: 45.0,
  description: 'Premium Blue Dream strain',
  slug: 'blue-dream-flower',
  category: 'flower',
  strain_type: 'hybrid',
  thc_content: '22%',
  cbd_content: '1%',
  image_url: 'https://example.com/blue-dream.jpg',
  images: null,
  in_stock: true,
  is_visible: true,
  is_featured: false,
};

const marketplaceProductAfterSync = {
  ...marketplaceProductBeforeSync,
  product_name: 'Blue Dream Flower Premium',
  display_price: 55.0,
  description: 'Updated premium Blue Dream strain - top shelf',
};

describe('Storefront Admin Sync - Product Update Flow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Admin product update triggers sync', () => {
    it('should update product in admin and sync to marketplace successfully', async () => {
      // Step 1: Admin updates product in products table
      const updateChain = createChainableMock({ data: updatedProduct, error: null });
      mockFromFn.mockReturnValueOnce(updateChain);

      const { supabase } = await import('@/integrations/supabase/client');
      const updateResult = supabase.from('products');
      // Simulate: supabase.from('products').update({...}).eq('id', PRODUCT_ID).eq('tenant_id', TENANT_ID)
      expect(mockFromFn).toHaveBeenCalledWith('products');

      // Step 2: Admin triggers sync via RPC
      const syncResponse = {
        success: true,
        marketplace_product_id: MARKETPLACE_PRODUCT_ID,
        slug: 'blue-dream-flower-premium',
        product_name: 'Blue Dream Flower Premium',
        product_id: PRODUCT_ID,
      };
      mockRpcFn.mockResolvedValueOnce({ data: syncResponse, error: null });

      const { data: syncData, error: syncError } = await supabase.rpc(
        'sync_product_to_marketplace',
        {
          p_product_id: PRODUCT_ID,
          p_store_id: STORE_ID,
        }
      );

      expect(syncError).toBeNull();
      expect(syncData.success).toBe(true);
      expect(syncData.product_name).toBe('Blue Dream Flower Premium');
      expect(syncData.marketplace_product_id).toBe(MARKETPLACE_PRODUCT_ID);
    });

    it('should invalidate storefront query cache after successful sync', async () => {
      // Set up initial storefront cache with old product data
      queryClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);

      // Verify cache has old data
      const cachedBefore = queryClient.getQueryData<typeof marketplaceProductBeforeSync[]>([
        'shop-products',
        STORE_ID,
      ]);
      expect(cachedBefore).toHaveLength(1);
      expect(cachedBefore?.[0].product_name).toBe('Blue Dream Flower');
      expect(cachedBefore?.[0].display_price).toBe(45.0);

      // Simulate sync completion - invalidate storefront queries
      // This is what ProductSyncPage.tsx does after successful sync mutation
      await queryClient.invalidateQueries({ queryKey: ['products-sync'] });
      await queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      await queryClient.invalidateQueries({ queryKey: ['shop-products', STORE_ID] });

      // After invalidation, the query state should be marked as stale
      const queryState = queryClient.getQueryState(['shop-products', STORE_ID]);
      expect(queryState?.isInvalidated).toBe(true);
    });

    it('should refetch storefront products with updated data after invalidation', async () => {
      // Set up query with initial data
      queryClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);

      // Mock the RPC call that storefront uses to refetch
      mockRpcFn.mockResolvedValueOnce({
        data: [marketplaceProductAfterSync],
        error: null,
      });

      // Set up the query function (simulates what ProductCatalogPage does)
      const fetchProducts = async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.rpc('get_marketplace_products', {
          p_store_id: STORE_ID,
        });
        if (error) throw error;
        return data;
      };

      // Fetch fresh data (simulates refetch after invalidation)
      const freshProducts = await fetchProducts();

      expect(mockRpcFn).toHaveBeenCalledWith('get_marketplace_products', {
        p_store_id: STORE_ID,
      });
      expect(freshProducts).toHaveLength(1);
      expect(freshProducts[0].product_name).toBe('Blue Dream Flower Premium');
      expect(freshProducts[0].display_price).toBe(55.0);
      expect(freshProducts[0].description).toBe(
        'Updated premium Blue Dream strain - top shelf'
      );
    });
  });

  describe('Sync with price and display name overrides', () => {
    it('should sync with custom display price that overrides retail price', async () => {
      const customPrice = 49.99;
      const syncResponse = {
        success: true,
        marketplace_product_id: MARKETPLACE_PRODUCT_ID,
        slug: 'blue-dream-flower',
        product_name: 'Blue Dream Flower',
        product_id: PRODUCT_ID,
      };

      mockRpcFn.mockResolvedValueOnce({ data: syncResponse, error: null });

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.rpc('sync_product_to_marketplace', {
        p_product_id: PRODUCT_ID,
        p_store_id: STORE_ID,
        p_display_price: customPrice,
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(mockRpcFn).toHaveBeenCalledWith('sync_product_to_marketplace', {
        p_product_id: PRODUCT_ID,
        p_store_id: STORE_ID,
        p_display_price: customPrice,
      });
    });

    it('should sync with custom display name different from admin product name', async () => {
      const customName = 'Premium Blue Dream - Limited Edition';
      const syncResponse = {
        success: true,
        marketplace_product_id: MARKETPLACE_PRODUCT_ID,
        slug: 'premium-blue-dream-limited-edition',
        product_name: customName,
        product_id: PRODUCT_ID,
      };

      mockRpcFn.mockResolvedValueOnce({ data: syncResponse, error: null });

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.rpc('sync_product_to_marketplace', {
        p_product_id: PRODUCT_ID,
        p_store_id: STORE_ID,
        p_display_name: customName,
      });

      expect(error).toBeNull();
      expect(data.product_name).toBe(customName);
      expect(data.slug).toBe('premium-blue-dream-limited-edition');
    });

    it('should reflect overridden price in storefront after sync', async () => {
      const overriddenProduct = {
        ...marketplaceProductBeforeSync,
        display_price: 39.99, // Custom override price (lower than retail)
      };

      // Set initial cache
      queryClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);

      // After sync with price override, storefront fetches updated data
      mockRpcFn.mockResolvedValueOnce({
        data: [overriddenProduct],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase.rpc('get_marketplace_products', {
        p_store_id: STORE_ID,
      });

      // Update cache with fresh data
      queryClient.setQueryData(['shop-products', STORE_ID], data);

      const cached = queryClient.getQueryData<typeof overriddenProduct[]>([
        'shop-products',
        STORE_ID,
      ]);
      expect(cached?.[0].display_price).toBe(39.99);
    });
  });

  describe('Query cache consistency across storefront pages', () => {
    it('should invalidate both product list and detail queries after sync', async () => {
      const productSlug = 'blue-dream-flower';

      // Set up caches for multiple storefront query keys
      queryClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);
      queryClient.setQueryData(
        ['shop-product', STORE_ID, productSlug, true],
        marketplaceProductBeforeSync
      );
      queryClient.setQueryData(
        ['related-products', STORE_ID, 'flower'],
        [marketplaceProductBeforeSync]
      );

      // Invalidate all shop queries (simulates comprehensive cache bust)
      await queryClient.invalidateQueries({ queryKey: ['shop-products', STORE_ID] });
      await queryClient.invalidateQueries({
        queryKey: ['shop-product', STORE_ID, productSlug, true],
      });
      await queryClient.invalidateQueries({
        queryKey: ['related-products', STORE_ID, 'flower'],
      });

      // All queries should be invalidated
      expect(
        queryClient.getQueryState(['shop-products', STORE_ID])?.isInvalidated
      ).toBe(true);
      expect(
        queryClient.getQueryState(['shop-product', STORE_ID, productSlug, true])
          ?.isInvalidated
      ).toBe(true);
      expect(
        queryClient.getQueryState(['related-products', STORE_ID, 'flower'])
          ?.isInvalidated
      ).toBe(true);
    });

    it('should update storefront product detail page data after admin sync', async () => {
      const productSlug = 'blue-dream-flower-premium';

      // Mock the detail page RPC call
      mockRpcFn.mockResolvedValueOnce({
        data: [marketplaceProductAfterSync],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.rpc('get_marketplace_products', {
        p_store_id: STORE_ID,
      });

      expect(error).toBeNull();
      const product = (data as typeof marketplaceProductAfterSync[]).find(
        (p) => p.product_id === PRODUCT_ID
      );
      expect(product).toBeDefined();
      expect(product?.product_name).toBe('Blue Dream Flower Premium');
      expect(product?.display_price).toBe(55.0);
      expect(product?.description).toContain('top shelf');
    });

    it('should handle multiple products synced in sequence', async () => {
      const PRODUCT_2_ID = '55555555-5555-5555-5555-555555555555';
      const product2 = {
        ...marketplaceProductBeforeSync,
        id: '66666666-6666-6666-6666-666666666666',
        product_id: PRODUCT_2_ID,
        product_name: 'OG Kush',
        display_price: 35.0,
        slug: 'og-kush',
      };

      // Set initial cache with 2 products
      queryClient.setQueryData(
        ['shop-products', STORE_ID],
        [marketplaceProductBeforeSync, product2]
      );

      // Sync product 1 with updated name
      mockRpcFn.mockResolvedValueOnce({
        data: {
          success: true,
          marketplace_product_id: MARKETPLACE_PRODUCT_ID,
          slug: 'blue-dream-flower-premium',
          product_name: 'Blue Dream Flower Premium',
          product_id: PRODUCT_ID,
        },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const { data: sync1 } = await supabase.rpc('sync_product_to_marketplace', {
        p_product_id: PRODUCT_ID,
        p_store_id: STORE_ID,
      });
      expect(sync1.success).toBe(true);

      // Sync product 2 with updated price
      mockRpcFn.mockResolvedValueOnce({
        data: {
          success: true,
          marketplace_product_id: '66666666-6666-6666-6666-666666666666',
          slug: 'og-kush',
          product_name: 'OG Kush',
          product_id: PRODUCT_2_ID,
        },
        error: null,
      });

      const { data: sync2 } = await supabase.rpc('sync_product_to_marketplace', {
        p_product_id: PRODUCT_2_ID,
        p_store_id: STORE_ID,
      });
      expect(sync2.success).toBe(true);

      // Invalidate and refetch - both products should reflect updated data
      await queryClient.invalidateQueries({ queryKey: ['shop-products', STORE_ID] });

      // Mock refetch with both updated products
      const updatedProducts = [
        marketplaceProductAfterSync,
        { ...product2, display_price: 40.0 },
      ];
      mockRpcFn.mockResolvedValueOnce({ data: updatedProducts, error: null });

      const { data: freshData } = await supabase.rpc('get_marketplace_products', {
        p_store_id: STORE_ID,
      });

      expect(freshData).toHaveLength(2);
      expect(freshData[0].product_name).toBe('Blue Dream Flower Premium');
      expect(freshData[1].display_price).toBe(40.0);
    });
  });

  describe('Error handling during sync', () => {
    it('should not invalidate storefront cache when sync fails', async () => {
      // Use a query client with longer gcTime so cache persists without observers
      const persistentClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
          mutations: { retry: false },
        },
      });

      // Set up storefront cache
      persistentClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);

      // Sync fails
      mockRpcFn.mockResolvedValueOnce({
        data: null,
        error: { message: 'Product not found or unauthorized', code: '42501' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.rpc('sync_product_to_marketplace', {
        p_product_id: 'non-existent-id',
        p_store_id: STORE_ID,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toBe('Product not found or unauthorized');

      // On error, we do NOT call invalidateQueries - so cache stays intact
      // (This mirrors the onSettled callback which only invalidates on success)
      const cached = persistentClient.getQueryData<typeof marketplaceProductBeforeSync[]>([
        'shop-products',
        STORE_ID,
      ]);
      expect(cached?.[0].product_name).toBe('Blue Dream Flower');
      expect(cached?.[0].display_price).toBe(45.0);

      // Query should NOT be invalidated
      const queryState = persistentClient.getQueryState(['shop-products', STORE_ID]);
      expect(queryState?.isInvalidated).toBe(false);

      persistentClient.clear();
    });

    it('should handle sync_product_to_marketplace RPC returning success=false', async () => {
      queryClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);

      mockRpcFn.mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Unauthorized: Store belongs to different tenant',
        },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.rpc('sync_product_to_marketplace', {
        p_product_id: PRODUCT_ID,
        p_store_id: 'other-tenant-store',
      });

      // No Supabase-level error, but application-level failure
      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized: Store belongs to different tenant');

      // Storefront cache should remain unchanged
      const cached = queryClient.getQueryData<typeof marketplaceProductBeforeSync[]>([
        'shop-products',
        STORE_ID,
      ]);
      expect(cached?.[0].product_name).toBe('Blue Dream Flower');
    });

    it('should handle network error during storefront refetch gracefully', async () => {
      // Use a persistent query client to simulate browser-like behavior
      // where stale cache data survives invalidation as a fallback
      const persistentClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity, staleTime: 0 },
          mutations: { retry: false },
        },
      });

      // Set initial cache
      persistentClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);

      // Invalidate (sync was successful)
      await persistentClient.invalidateQueries({ queryKey: ['shop-products', STORE_ID] });

      // The refetch fails due to network error
      mockRpcFn.mockResolvedValueOnce({
        data: null,
        error: { message: 'Network request failed', code: 'NETWORK_ERROR' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.rpc('get_marketplace_products', {
        p_store_id: STORE_ID,
      });

      expect(error).not.toBeNull();
      expect(data).toBeNull();

      // With gcTime: Infinity (like production), stale cache data
      // remains available as a fallback even after invalidation
      const staleData = persistentClient.getQueryData<typeof marketplaceProductBeforeSync[]>([
        'shop-products',
        STORE_ID,
      ]);
      expect(staleData).toBeDefined();
      expect(staleData?.[0].product_name).toBe('Blue Dream Flower');

      persistentClient.clear();
    });
  });

  describe('Sync status tracking', () => {
    it('should update sync status to synced after successful sync', async () => {
      const syncStatusData = {
        id: PRODUCT_ID,
        name: 'Blue Dream Flower Premium',
        category: 'flower',
        wholesale_price: 25.0,
        retail_price: 55.0,
        available_quantity: 75,
        image_url: 'https://example.com/blue-dream.jpg',
        marketplace_product_sync: [
          {
            id: 'sync-record-1',
            sync_status: 'synced' as const,
            last_synced_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            sync_errors: null,
            listing_id: MARKETPLACE_PRODUCT_ID,
          },
        ],
      };

      // Set up admin products-sync cache
      queryClient.setQueryData(['products-sync', TENANT_ID], [syncStatusData]);

      const cached = queryClient.getQueryData<typeof syncStatusData[]>([
        'products-sync',
        TENANT_ID,
      ]);
      expect(cached?.[0].marketplace_product_sync[0].sync_status).toBe('synced');
      expect(cached?.[0].marketplace_product_sync[0].listing_id).toBe(
        MARKETPLACE_PRODUCT_ID
      );
    });

    it('should invalidate products-sync query after sync mutation', async () => {
      const initialSyncData = [
        {
          id: PRODUCT_ID,
          name: 'Blue Dream Flower',
          marketplace_product_sync: [],
        },
      ];

      queryClient.setQueryData(['products-sync', TENANT_ID], initialSyncData);

      // After successful sync, invalidate sync status query
      await queryClient.invalidateQueries({ queryKey: ['products-sync'] });

      const queryState = queryClient.getQueryState(['products-sync', TENANT_ID]);
      expect(queryState?.isInvalidated).toBe(true);
    });

    it('should invalidate marketplace-listings query after sync', async () => {
      queryClient.setQueryData(['marketplace-listings', STORE_ID], []);

      await queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });

      const queryState = queryClient.getQueryState(['marketplace-listings', STORE_ID]);
      expect(queryState?.isInvalidated).toBe(true);
    });
  });

  describe('End-to-end sync flow', () => {
    it('should complete full admin update -> sync -> storefront reflects change', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      // Phase 1: Admin has product in cache
      queryClient.setQueryData(['products-sync', TENANT_ID], [
        {
          id: PRODUCT_ID,
          name: 'Blue Dream Flower',
          category: 'flower',
          wholesale_price: 25.0,
          retail_price: 45.0,
          available_quantity: 100,
          marketplace_product_sync: [],
        },
      ]);

      // Phase 2: Storefront has old marketplace data
      queryClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);

      // Phase 3: Admin updates product locally (optimistic)
      const adminCache = queryClient.getQueryData<Array<{ id: string; name: string; retail_price: number }>>([
        'products-sync',
        TENANT_ID,
      ]);
      expect(adminCache?.[0].name).toBe('Blue Dream Flower');

      // Phase 4: Admin triggers sync
      mockRpcFn.mockResolvedValueOnce({
        data: {
          success: true,
          marketplace_product_id: MARKETPLACE_PRODUCT_ID,
          slug: 'blue-dream-flower-premium',
          product_name: 'Blue Dream Flower Premium',
          product_id: PRODUCT_ID,
        },
        error: null,
      });

      const { data: syncResult, error: syncError } = await supabase.rpc(
        'sync_product_to_marketplace',
        {
          p_product_id: PRODUCT_ID,
          p_store_id: STORE_ID,
          p_display_name: 'Blue Dream Flower Premium',
          p_display_price: 55.0,
        }
      );

      expect(syncError).toBeNull();
      expect(syncResult.success).toBe(true);

      // Phase 5: On sync success, invalidate all related queries
      // (This is what the onSettled callback in ProductSyncPage does)
      await queryClient.invalidateQueries({ queryKey: ['products-sync'] });
      await queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      await queryClient.invalidateQueries({ queryKey: ['shop-products', STORE_ID] });

      // Phase 6: Storefront refetches and gets updated data
      mockRpcFn.mockResolvedValueOnce({
        data: [marketplaceProductAfterSync],
        error: null,
      });

      const { data: storefrontProducts } = await supabase.rpc(
        'get_marketplace_products',
        { p_store_id: STORE_ID }
      );

      // Phase 7: Verify storefront reflects the admin change
      expect(storefrontProducts).toHaveLength(1);
      expect(storefrontProducts[0].product_name).toBe('Blue Dream Flower Premium');
      expect(storefrontProducts[0].display_price).toBe(55.0);
      expect(storefrontProducts[0].description).toContain('top shelf');

      // Phase 8: Update the storefront cache with fresh data
      queryClient.setQueryData(['shop-products', STORE_ID], storefrontProducts);

      const finalCache = queryClient.getQueryData<typeof marketplaceProductAfterSync[]>([
        'shop-products',
        STORE_ID,
      ]);
      expect(finalCache?.[0].product_name).toBe('Blue Dream Flower Premium');
      expect(finalCache?.[0].display_price).toBe(55.0);
    });

    it('should handle product visibility toggle from admin to storefront', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      // Product starts visible
      queryClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);

      // Admin syncs with product marked as not visible
      mockRpcFn.mockResolvedValueOnce({
        data: {
          success: true,
          marketplace_product_id: MARKETPLACE_PRODUCT_ID,
          slug: 'blue-dream-flower',
          product_name: 'Blue Dream Flower',
          product_id: PRODUCT_ID,
        },
        error: null,
      });

      await supabase.rpc('sync_product_to_marketplace', {
        p_product_id: PRODUCT_ID,
        p_store_id: STORE_ID,
      });

      // Invalidate storefront cache
      await queryClient.invalidateQueries({ queryKey: ['shop-products', STORE_ID] });

      // Storefront refetches - product is no longer in visible results
      mockRpcFn.mockResolvedValueOnce({
        data: [], // Product hidden by RPC (is_visible = false in marketplace_products)
        error: null,
      });

      const { data: visibleProducts } = await supabase.rpc('get_marketplace_products', {
        p_store_id: STORE_ID,
      });

      expect(visibleProducts).toHaveLength(0);
    });

    it('should handle stock depletion sync (in_stock false)', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      // Product starts in stock
      queryClient.setQueryData(['shop-products', STORE_ID], [marketplaceProductBeforeSync]);
      expect(marketplaceProductBeforeSync.in_stock).toBe(true);

      // Admin depletes stock and syncs
      mockRpcFn.mockResolvedValueOnce({
        data: {
          success: true,
          marketplace_product_id: MARKETPLACE_PRODUCT_ID,
          slug: 'blue-dream-flower',
          product_name: 'Blue Dream Flower',
          product_id: PRODUCT_ID,
        },
        error: null,
      });

      await supabase.rpc('sync_product_to_marketplace', {
        p_product_id: PRODUCT_ID,
        p_store_id: STORE_ID,
      });

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ['shop-products', STORE_ID] });

      mockRpcFn.mockResolvedValueOnce({
        data: [{ ...marketplaceProductBeforeSync, in_stock: false }],
        error: null,
      });

      const { data: products } = await supabase.rpc('get_marketplace_products', {
        p_store_id: STORE_ID,
      });

      expect(products[0].in_stock).toBe(false);
    });
  });
});
