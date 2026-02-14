/**
 * useStorefrontProductSync - Real-time product sync from admin to storefront
 *
 * When admin updates a product (price, name, description, image, stock),
 * changes reflect on storefront immediately via eventBus and TanStack Query invalidation.
 * No manual publish step needed.
 *
 * Features:
 * - Listens to product_updated events from eventBus
 * - Automatically invalidates storefront product queries
 * - Tracks sync status for UI indicators
 * - Logs sync events for audit trail
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useEventBus } from '@/hooks/useEventBus';
import { useRealTimeSubscription, type ConnectionStatus } from '@/hooks/useRealTimeSubscription';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

/**
 * Sync status for a product
 */
export type ProductSyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

/**
 * Product change details for audit logging
 */
export interface ProductChange {
  productId: string;
  tenantId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: string;
  changedBy?: string;
}

/**
 * Sync event for tracking
 */
export interface ProductSyncEvent {
  productId: string;
  tenantId: string;
  syncedAt: string;
  source: 'admin' | 'realtime' | 'eventBus';
  changes?: Record<string, unknown>;
  status: 'success' | 'error';
  errorMessage?: string;
}

/**
 * Options for the sync hook
 */
export interface UseStorefrontProductSyncOptions {
  /** Tenant ID for filtering sync events */
  tenantId: string | null;
  /** Optional store ID for storefront-specific invalidation */
  storeId?: string;
  /** Whether to enable realtime subscription (default: true) */
  enableRealtime?: boolean;
  /** Callback when a product is synced */
  onProductSynced?: (event: ProductSyncEvent) => void;
  /** Callback when sync fails */
  onSyncError?: (error: Error, productId: string) => void;
}

/**
 * Return value from the hook
 */
export interface UseStorefrontProductSyncResult {
  /** Current connection status for realtime */
  connectionStatus: ConnectionStatus;
  /** Map of product IDs to their sync status */
  productSyncStatus: Map<string, ProductSyncStatus>;
  /** Last sync timestamp */
  lastSyncAt: string | null;
  /** Number of products synced in current session */
  syncCount: number;
  /** Manually trigger a sync for a specific product */
  syncProduct: (productId: string) => Promise<void>;
  /** Log a product change for audit */
  logProductChange: (change: ProductChange) => Promise<void>;
  /** Get sync status for a specific product */
  getProductSyncStatus: (productId: string) => ProductSyncStatus;
}

/**
 * Hook for syncing products from admin to storefront in real-time
 */
export function useStorefrontProductSync(
  options: UseStorefrontProductSyncOptions
): UseStorefrontProductSyncResult {
  const {
    tenantId,
    storeId,
    enableRealtime = true,
    onProductSynced,
    onSyncError,
  } = options;

  const queryClient = useQueryClient();

  // Track sync status for individual products
  const [productSyncStatus, setProductSyncStatus] = useState<Map<string, ProductSyncStatus>>(
    new Map()
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncCount, setSyncCount] = useState(0);

  // Refs for stable callbacks
  const onProductSyncedRef = useRef(onProductSynced);
  const onSyncErrorRef = useRef(onSyncError);

  useEffect(() => {
    onProductSyncedRef.current = onProductSynced;
    onSyncErrorRef.current = onSyncError;
  }, [onProductSynced, onSyncError]);

  /**
   * Invalidate all product-related queries for storefront
   */
  const invalidateStorefrontQueries = useCallback(
    (productId?: string) => {
      logger.debug('[ProductSync] Invalidating storefront queries', { productId, storeId });

      // Invalidate admin product queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.byTenant(tenantId),
        });
      }

      // Invalidate storefront product queries
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });

      if (storeId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.list(storeId),
        });

        if (productId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.shopProducts.detail(storeId, productId),
          });
        }

        // Invalidate related sections
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.carousels(storeId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.categories(storeId),
        });
      }

      // Invalidate storefront config and banners
      queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });

      // Invalidate inventory (stock changes)
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

      // Invalidate menus that may display products
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });

      // Invalidate POS products
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.pos.products(tenantId),
        });
      }
    },
    [queryClient, tenantId, storeId]
  );

  /**
   * Update sync status for a product
   */
  const updateSyncStatus = useCallback(
    (productId: string, status: ProductSyncStatus) => {
      setProductSyncStatus((prev) => {
        const next = new Map(prev);
        next.set(productId, status);
        return next;
      });

      if (status === 'synced') {
        setLastSyncAt(new Date().toISOString());
        setSyncCount((prev) => prev + 1);
      }
    },
    []
  );

  /**
   * Handle product update from eventBus
   */
  const handleProductUpdate = useCallback(
    (payload: { productId: string; tenantId: string; changes?: Record<string, unknown> }) => {
      logger.info('[ProductSync] Received product_updated event', payload);

      const { productId, changes } = payload;

      // Update status to syncing
      updateSyncStatus(productId, 'syncing');

      try {
        // Invalidate queries to trigger refetch
        invalidateStorefrontQueries(productId);

        // Update status to synced
        updateSyncStatus(productId, 'synced');

        // Call success callback
        const syncEvent: ProductSyncEvent = {
          productId,
          tenantId: payload.tenantId,
          syncedAt: new Date().toISOString(),
          source: 'eventBus',
          changes,
          status: 'success',
        };

        onProductSyncedRef.current?.(syncEvent);

        logger.info('[ProductSync] Product synced successfully', { productId });
      } catch (error) {
        logger.error('[ProductSync] Failed to sync product', error);
        updateSyncStatus(productId, 'error');
        onSyncErrorRef.current?.(error as Error, productId);
      }
    },
    [invalidateStorefrontQueries, updateSyncStatus]
  );

  /**
   * Handle price change event
   */
  const handlePriceChange = useCallback(
    (payload: {
      productId: string;
      tenantId: string;
      wholesalePriceOld: number | null;
      wholesalePriceNew: number | null;
      retailPriceOld: number | null;
      retailPriceNew: number | null;
      changedAt: string;
    }) => {
      logger.info('[ProductSync] Received price_changed event', payload);

      handleProductUpdate({
        productId: payload.productId,
        tenantId: payload.tenantId,
        changes: {
          wholesale_price: { old: payload.wholesalePriceOld, new: payload.wholesalePriceNew },
          retail_price: { old: payload.retailPriceOld, new: payload.retailPriceNew },
        },
      });
    },
    [handleProductUpdate]
  );

  /**
   * Handle inventory change event
   */
  const handleInventoryChange = useCallback(
    (payload: {
      productId: string;
      tenantId: string;
      locationId?: string;
      quantityChange: number;
      newQuantity: number;
    }) => {
      logger.info('[ProductSync] Received inventory_changed event', payload);

      handleProductUpdate({
        productId: payload.productId,
        tenantId: payload.tenantId,
        changes: {
          quantity_change: payload.quantityChange,
          new_quantity: payload.newQuantity,
          location_id: payload.locationId,
        },
      });
    },
    [handleProductUpdate]
  );

  // Subscribe to eventBus events
  useEventBus('product_updated', handleProductUpdate);
  useEventBus('price_changed', handlePriceChange);
  useEventBus('inventory_changed', handleInventoryChange);

  // Subscribe to realtime database changes
  const { status: connectionStatus } = useRealTimeSubscription({
    table: 'products',
    tenantId,
    enabled: enableRealtime && !!tenantId,
    event: 'UPDATE',
    callback: (payload) => {
      const productId = (payload.new as Record<string, unknown>)?.id as string;
      if (productId) {
        logger.debug('[ProductSync] Realtime product update received', { productId });
        handleProductUpdate({
          productId,
          tenantId: tenantId!,
          changes: payload.new as Record<string, unknown>,
        });
      }
    },
  });

  /**
   * Manually trigger sync for a specific product
   */
  const syncProduct = useCallback(
    async (productId: string) => {
      if (!tenantId) {
        logger.warn('[ProductSync] Cannot sync product: No tenantId');
        return;
      }

      updateSyncStatus(productId, 'syncing');

      try {
        // Fetch the latest product data to trigger cache refresh
        await queryClient.refetchQueries({
          queryKey: queryKeys.products.detail(tenantId, productId),
        });

        // Invalidate storefront queries
        invalidateStorefrontQueries(productId);

        updateSyncStatus(productId, 'synced');

        const syncEvent: ProductSyncEvent = {
          productId,
          tenantId,
          syncedAt: new Date().toISOString(),
          source: 'admin',
          status: 'success',
        };

        onProductSyncedRef.current?.(syncEvent);
      } catch (error) {
        logger.error('[ProductSync] Manual sync failed', error);
        updateSyncStatus(productId, 'error');
        onSyncErrorRef.current?.(error as Error, productId);
        throw error;
      }
    },
    [tenantId, queryClient, invalidateStorefrontQueries, updateSyncStatus]
  );

  /**
   * Log a product change for audit trail
   */
  const logProductChange = useCallback(
    async (change: ProductChange) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Use an anonymous insert that relies on RLS
        const { error } = await supabase.from('activity_logs').insert({
          tenant_id: change.tenantId,
          user_id: user?.id,
          entity_type: 'product',
          entity_id: change.productId,
          action: 'product.field_updated',
          old_data: { [change.field]: change.oldValue },
          new_data: { [change.field]: change.newValue },
          metadata: {
            field: change.field,
            sync_source: 'admin_update',
          },
        });

        if (error) {
          logger.error('[ProductSync] Failed to log product change', error);
        } else {
          logger.debug('[ProductSync] Product change logged', change);
        }
      } catch (error) {
        logger.error('[ProductSync] Error logging product change', error);
      }
    },
    []
  );

  /**
   * Get sync status for a specific product
   */
  const getProductSyncStatus = useCallback(
    (productId: string): ProductSyncStatus => {
      return productSyncStatus.get(productId) ?? 'synced';
    },
    [productSyncStatus]
  );

  return {
    connectionStatus,
    productSyncStatus,
    lastSyncAt,
    syncCount,
    syncProduct,
    logProductChange,
    getProductSyncStatus,
  };
}

export default useStorefrontProductSync;
