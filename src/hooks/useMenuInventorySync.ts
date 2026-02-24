/**
 * Menu Live Inventory Sync Hook
 *
 * Real-time subscription for syncing menu product availability with inventory.
 * When a product goes out of stock, it's automatically hidden/grayed on active menus.
 * When stock is restored, product becomes available again.
 * Notifies admin when products are auto-hidden due to stock changes.
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { publish } from '@/lib/eventBus';

/**
 * Stock status for menu products
 */
export type MenuProductStockStatus = 'available' | 'low_stock' | 'out_of_stock';

/**
 * Product stock change event
 */
export interface ProductStockChange {
  productId: string;
  productName: string;
  previousQuantity: number;
  newQuantity: number;
  previousStatus: MenuProductStockStatus;
  newStatus: MenuProductStockStatus;
  menuId?: string;
  timestamp: Date;
}

/**
 * Options for the menu inventory sync hook
 */
export interface UseMenuInventorySyncOptions {
  /** Menu ID to sync inventory for (optional - syncs all if not provided) */
  menuId?: string;
  /** Tenant ID for filtering */
  tenantId: string | null;
  /** Product IDs to monitor (optional - monitors all menu products if not provided) */
  productIds?: string[];
  /** Low stock threshold (default: 10) */
  lowStockThreshold?: number;
  /** Whether the subscription is enabled */
  enabled?: boolean;
  /** Callback when product stock changes */
  onStockChange?: (change: ProductStockChange) => void;
  /** Callback when product becomes unavailable */
  onProductUnavailable?: (change: ProductStockChange) => void;
  /** Callback when product becomes available again */
  onProductRestored?: (change: ProductStockChange) => void;
}

/**
 * Return type for the hook
 */
export interface UseMenuInventorySyncResult {
  /** Current stock status map (productId -> status) */
  stockStatus: Map<string, MenuProductStockStatus>;
  /** Whether the realtime connection is active */
  isConnected: boolean;
  /** Recent stock changes */
  recentChanges: ProductStockChange[];
  /** Products that are currently out of stock */
  outOfStockProducts: string[];
  /** Products that are low on stock */
  lowStockProducts: string[];
  /** Manually refresh stock status */
  refreshStock: () => Promise<void>;
  /** Get stock status for a specific product */
  getProductStatus: (productId: string) => MenuProductStockStatus;
  /** Check if a product is available for ordering */
  isProductAvailable: (productId: string) => boolean;
}

const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const MAX_RECENT_CHANGES = 50;

/**
 * Determine stock status based on quantity
 */
function getStockStatus(quantity: number | null | undefined, threshold: number): MenuProductStockStatus {
  if (quantity === null || quantity === undefined || quantity <= 0) {
    return 'out_of_stock';
  }
  if (quantity <= threshold) {
    return 'low_stock';
  }
  return 'available';
}

/**
 * Hook for real-time menu inventory synchronization
 *
 * @param options - Configuration options
 * @returns Stock status and control functions
 *
 * @example
 * ```tsx
 * const { stockStatus, isProductAvailable, outOfStockProducts } = useMenuInventorySync({
 *   tenantId,
 *   menuId: 'menu-123',
 *   onProductUnavailable: (change) => {
 *     toast({ title: 'Product unavailable', description: change.productName });
 *   },
 * });
 *
 * // Check if product can be ordered
 * if (!isProductAvailable(productId)) {
 *   // Gray out the product
 * }
 * ```
 */
export function useMenuInventorySync(
  options: UseMenuInventorySyncOptions
): UseMenuInventorySyncResult {
  const {
    menuId,
    tenantId,
    productIds,
    lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD,
    enabled = true,
    onStockChange,
    onProductUnavailable,
    onProductRestored,
  } = options;

  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  // State
  const [stockStatus, setStockStatus] = useState<Map<string, MenuProductStockStatus>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [recentChanges, setRecentChanges] = useState<ProductStockChange[]>([]);

  // Store callback refs to avoid re-subscriptions
  const onStockChangeRef = useRef(onStockChange);
  const onProductUnavailableRef = useRef(onProductUnavailable);
  const onProductRestoredRef = useRef(onProductRestored);

  useEffect(() => {
    onStockChangeRef.current = onStockChange;
    onProductUnavailableRef.current = onProductUnavailable;
    onProductRestoredRef.current = onProductRestored;
  }, [onStockChange, onProductUnavailable, onProductRestored]);

  // Computed values
  const outOfStockProducts = useMemo(() => {
    return Array.from(stockStatus.entries())
      .filter(([, status]) => status === 'out_of_stock')
      .map(([productId]) => productId);
  }, [stockStatus]);

  const lowStockProducts = useMemo(() => {
    return Array.from(stockStatus.entries())
      .filter(([, status]) => status === 'low_stock')
      .map(([productId]) => productId);
  }, [stockStatus]);

  /**
   * Get stock status for a specific product
   */
  const getProductStatus = useCallback((productId: string): MenuProductStockStatus => {
    return stockStatus.get(productId) ?? 'available';
  }, [stockStatus]);

  /**
   * Check if a product is available for ordering
   */
  const isProductAvailable = useCallback((productId: string): boolean => {
    const status = stockStatus.get(productId);
    return status !== 'out_of_stock';
  }, [stockStatus]);

  /**
   * Process a stock change and notify relevant callbacks
   */
  const processStockChange = useCallback((
    productId: string,
    productName: string,
    previousQuantity: number,
    newQuantity: number
  ) => {
    const previousStatus = getStockStatus(previousQuantity, lowStockThreshold);
    const newStatus = getStockStatus(newQuantity, lowStockThreshold);

    // Only process if status actually changed
    if (previousStatus === newStatus) {
      return;
    }

    const change: ProductStockChange = {
      productId,
      productName,
      previousQuantity,
      newQuantity,
      previousStatus,
      newStatus,
      menuId,
      timestamp: new Date(),
    };

    logger.info('[MenuInventorySync] Stock status changed', {
      productId,
      productName,
      previousStatus,
      newStatus,
      previousQuantity,
      newQuantity,
    });

    // Update stock status map
    setStockStatus(prev => {
      const next = new Map(prev);
      next.set(productId, newStatus);
      return next;
    });

    // Add to recent changes
    setRecentChanges(prev => {
      const next = [change, ...prev];
      return next.slice(0, MAX_RECENT_CHANGES);
    });

    // Call callbacks
    if (onStockChangeRef.current) {
      onStockChangeRef.current(change);
    }

    // Product became unavailable
    if (newStatus === 'out_of_stock' && previousStatus !== 'out_of_stock') {
      if (onProductUnavailableRef.current) {
        onProductUnavailableRef.current(change);
      }

      // Publish events for notification system
      if (tenantId) {
        // General inventory change event
        publish('inventory_changed', {
          productId,
          tenantId,
          quantityChange: newQuantity - previousQuantity,
          newQuantity,
        });

        // Menu-specific product hidden event (for admin notifications)
        if (menuId) {
          publish('menu_product_hidden', {
            menuId,
            productId,
            productName,
            tenantId,
            reason: 'out_of_stock',
            hiddenAt: new Date().toISOString(),
          });
        }
      }
    }

    // Product restored (was out of stock, now has stock)
    if (previousStatus === 'out_of_stock' && newStatus !== 'out_of_stock') {
      if (onProductRestoredRef.current) {
        onProductRestoredRef.current(change);
      }

      // Publish menu-specific restore event
      if (tenantId && menuId) {
        publish('menu_product_restored', {
          menuId,
          productId,
          productName,
          tenantId,
          restoredAt: new Date().toISOString(),
        });
      }
    }
  }, [lowStockThreshold, menuId, tenantId]);

  /**
   * Fetch initial stock status for products
   */
  const refreshStock = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    try {
      logger.debug('[MenuInventorySync] Fetching initial stock status', {
        tenantId,
        menuId,
        productIds,
      });

      let query = supabase
        .from('wholesale_inventory')
        .select('id, product_name, quantity_units')
        .eq('tenant_id', tenantId);

      if (productIds && productIds.length > 0) {
        query = query.in('id', productIds);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('[MenuInventorySync] Failed to fetch stock status', error);
        return;
      }

      if (!mountedRef.current) return;

      const newStatusMap = new Map<string, MenuProductStockStatus>();
      (data ?? []).forEach((item) => {
        newStatusMap.set(
          item.id,
          getStockStatus(item.quantity_units, lowStockThreshold)
        );
      });

      setStockStatus(newStatusMap);

      logger.debug('[MenuInventorySync] Stock status initialized', {
        productCount: newStatusMap.size,
        outOfStock: Array.from(newStatusMap.values()).filter(s => s === 'out_of_stock').length,
        lowStock: Array.from(newStatusMap.values()).filter(s => s === 'low_stock').length,
      });
    } catch (err) {
      logger.error('[MenuInventorySync] Error fetching stock status', err);
    }
  }, [tenantId, menuId, productIds, lowStockThreshold]);

  /**
   * Handle realtime inventory changes
   */
  const handleInventoryChange = useCallback((payload: {
    eventType: string;
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  }) => {
    if (!mountedRef.current) return;

    const newRecord = payload.new as {
      id?: string;
      product_name?: string;
      quantity_units?: number;
    } | null;

    const oldRecord = payload.old as {
      id?: string;
      product_name?: string;
      quantity_units?: number;
    } | null;

    const productId = newRecord?.id || oldRecord?.id;
    const productName = newRecord?.product_name || oldRecord?.product_name || 'Unknown Product';

    if (!productId) {
      return;
    }

    // If we're monitoring specific products, check if this is one of them
    if (productIds && productIds.length > 0 && !productIds.includes(productId)) {
      return;
    }

    const previousQuantity = oldRecord?.quantity_units ?? 0;
    const newQuantity = newRecord?.quantity_units ?? 0;

    logger.debug('[MenuInventorySync] Inventory change detected', {
      eventType: payload.eventType,
      productId,
      productName,
      previousQuantity,
      newQuantity,
    });

    processStockChange(productId, productName, previousQuantity, newQuantity);

    // Invalidate menu queries to refresh UI
    if (menuId && tenantId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.products(tenantId, menuId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
  }, [productIds, menuId, tenantId, processStockChange, queryClient]);

  /**
   * Set up realtime subscription
   */
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !tenantId) {
      logger.debug('[MenuInventorySync] Subscription disabled or missing tenantId', {
        enabled,
        tenantId,
      });
      return;
    }

    // Fetch initial stock status
    refreshStock();

    // Set up realtime subscription
    const channelName = menuId
      ? `menu-inventory-sync:${tenantId}:${menuId}`
      : `menu-inventory-sync:${tenantId}`;

    logger.debug('[MenuInventorySync] Setting up realtime subscription', {
      channelName,
      tenantId,
    });

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_inventory',
          filter: `tenant_id=eq.${tenantId}`,
        },
        handleInventoryChange
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          logger.info('[MenuInventorySync] Subscribed to inventory changes', {
            tenantId,
            menuId,
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          logger.warn('[MenuInventorySync] Subscription error', { status });
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        logger.debug('[MenuInventorySync] Cleaning up subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, tenantId, menuId, handleInventoryChange, refreshStock]);

  return {
    stockStatus,
    isConnected,
    recentChanges,
    outOfStockProducts,
    lowStockProducts,
    refreshStock,
    getProductStatus,
    isProductAvailable,
  };
}

export default useMenuInventorySync;
