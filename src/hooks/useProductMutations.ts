/**
 * useProductMutations - Admin product mutations with cross-context cache invalidation
 *
 * When admin creates/updates/deletes products, this hook invalidates:
 * - Admin product queries (products list)
 * - Storefront product queries (shop-products, shop-product detail)
 * - Related queries (marketplace-product-settings, product sync, inventory, POS)
 *
 * This ensures that storefront visitors see product changes instantly
 * without requiring a manual sync or page refresh.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { invalidateOnEvent } from '@/lib/invalidation';

interface InvalidationOptions {
  /** The tenant ID for admin-side invalidation */
  tenantId?: string;
  /** The store ID for storefront-side invalidation */
  storeId?: string;
  /** Specific product ID to invalidate detail queries */
  productId?: string;
  /** Product category for related-products invalidation */
  category?: string;
  /** Mutation action to emit cross-hub invalidation events */
  action?: 'created' | 'updated' | 'deleted' | 'stock_adjusted';
}

/**
 * Hook providing cache invalidation for product mutations.
 * Call `invalidateProductCaches` after any product create/update/delete
 * to sync changes across admin and storefront instantly.
 */
export function useProductMutations() {
  const queryClient = useQueryClient();

  /**
   * Invalidates all product-related caches across admin and storefront.
   * This ensures that any product change in admin is immediately reflected
   * in the storefront without manual sync.
   */
  const invalidateProductCaches = useCallback(
    (options: InvalidationOptions = {}) => {
      const { tenantId, storeId, productId, category, action = 'updated' } = options;

      logger.info('Invalidating product caches', { tenantId, storeId, productId });

      // 1. Invalidate admin product queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.byTenant(tenantId),
        });
      }

      // 2. Invalidate storefront product queries (shop-facing)
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });

      if (storeId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.list(storeId),
        });

        // Invalidate storefront carousel/dynamic sections
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.carousels(storeId),
        });

        // Invalidate categories
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.categories(storeId),
        });

        // Invalidate specific product detail if provided
        if (productId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.shopProducts.detail(storeId, productId),
          });
        }

        // Invalidate related products for the category
        if (category) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.shopProducts.related(storeId, category),
          });
        }
      }

      // 3. Invalidate marketplace product settings (admin storefront config)
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceProductSettings.all,
      });

      // 4. Invalidate product sync status
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.marketplaceProductSettings.sync(tenantId),
        });
      }

      // 5. Invalidate marketplace product stats
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplaceProductSettings.stats(),
      });

      // 6. Invalidate POS products (if tenant uses POS)
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.pos.products(tenantId),
        });
      }

      // 7. Invalidate inventory queries (stock changes)
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

      // 8. Invalidate CRM products
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.products.all(),
      });

      // 9. Emit cross-hub invalidation events for non-product panels
      if (tenantId) {
        if (action === 'created') {
          invalidateOnEvent(queryClient, 'PRODUCT_CREATED', tenantId, { productId });
        } else if (action === 'deleted') {
          invalidateOnEvent(queryClient, 'PRODUCT_DELETED', tenantId, { productId });
        } else {
          invalidateOnEvent(queryClient, 'PRODUCT_UPDATED', tenantId, { productId });
        }

        if (action === 'stock_adjusted') {
          invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenantId, { productId });
        }
      }
    },
    [queryClient]
  );

  return { invalidateProductCaches };
}
