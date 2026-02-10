/**
 * Menu Live Inventory Sync Component
 *
 * Wraps menu display with real-time inventory synchronization.
 * Automatically updates product availability when stock changes.
 * Shows notification to admin when products are auto-hidden.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useMenuInventorySync } from '@/hooks/useMenuInventorySync';
import type { ProductStockChange, MenuProductStockStatus } from '@/hooks/useMenuInventorySync';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Check from 'lucide-react/dist/esm/icons/check';
import PackageX from 'lucide-react/dist/esm/icons/package-x';

/**
 * Props for MenuLiveInventorySync
 */
interface MenuLiveInventorySyncProps {
  /** Menu ID to sync */
  menuId: string;
  /** Tenant ID */
  tenantId: string | null;
  /** Product IDs currently displayed on the menu */
  productIds?: string[];
  /** Whether to show admin notifications (for admin views) */
  showAdminNotifications?: boolean;
  /** Low stock threshold */
  lowStockThreshold?: number;
  /** Callback when products become available */
  onProductAvailable?: (productId: string) => void;
  /** Callback when products become unavailable */
  onProductUnavailable?: (productId: string) => void;
  /** Callback when stock status changes */
  onStockChange?: (productId: string, status: MenuProductStockStatus) => void;
  /** Children to render */
  children: React.ReactNode;
}

/**
 * Provider component for menu inventory sync
 */
export function MenuLiveInventorySync({
  menuId,
  tenantId,
  productIds,
  showAdminNotifications = false,
  lowStockThreshold,
  onProductAvailable,
  onProductUnavailable,
  onStockChange,
  children,
}: MenuLiveInventorySyncProps) {
  const queryClient = useQueryClient();

  /**
   * Handle product becoming unavailable (out of stock)
   */
  const handleProductUnavailable = useCallback((change: ProductStockChange) => {
    logger.info('[MenuLiveInventorySync] Product auto-hidden due to out of stock', {
      productId: change.productId,
      productName: change.productName,
      menuId,
    });

    // Show admin notification if enabled
    if (showAdminNotifications) {
      toast({
        title: 'Product Auto-Hidden',
        description: `"${change.productName}" is now out of stock and has been hidden from the menu.`,
        variant: 'destructive',
      });
    }

    // Invalidate menu queries to refresh UI
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.products(tenantId, menuId) });
    }

    // Call custom callback
    if (onProductUnavailable) {
      onProductUnavailable(change.productId);
    }
  }, [menuId, tenantId, showAdminNotifications, onProductUnavailable, queryClient]);

  /**
   * Handle product becoming available again
   */
  const handleProductRestored = useCallback((change: ProductStockChange) => {
    logger.info('[MenuLiveInventorySync] Product restored on menu', {
      productId: change.productId,
      productName: change.productName,
      newQuantity: change.newQuantity,
      menuId,
    });

    // Show admin notification if enabled
    if (showAdminNotifications) {
      toast({
        title: 'Product Restored',
        description: `"${change.productName}" is back in stock and available on the menu.`,
      });
    }

    // Invalidate menu queries to refresh UI
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.products(tenantId, menuId) });
    }

    // Call custom callback
    if (onProductAvailable) {
      onProductAvailable(change.productId);
    }
  }, [menuId, tenantId, showAdminNotifications, onProductAvailable, queryClient]);

  /**
   * Handle any stock change
   */
  const handleStockChange = useCallback((change: ProductStockChange) => {
    // Call custom callback
    if (onStockChange) {
      onStockChange(change.productId, change.newStatus);
    }
  }, [onStockChange]);

  // Use the inventory sync hook
  const {
    stockStatus,
    isConnected,
    outOfStockProducts,
    lowStockProducts,
    getProductStatus,
    isProductAvailable,
  } = useMenuInventorySync({
    menuId,
    tenantId,
    productIds,
    lowStockThreshold,
    enabled: !!tenantId && !!menuId,
    onStockChange: handleStockChange,
    onProductUnavailable: handleProductUnavailable,
    onProductRestored: handleProductRestored,
  });

  // Log connection status changes
  useEffect(() => {
    logger.debug('[MenuLiveInventorySync] Connection status changed', {
      isConnected,
      menuId,
      tenantId,
    });
  }, [isConnected, menuId, tenantId]);

  // Log stock status summary
  useEffect(() => {
    if (stockStatus.size > 0) {
      logger.debug('[MenuLiveInventorySync] Stock status summary', {
        totalProducts: stockStatus.size,
        outOfStock: outOfStockProducts.length,
        lowStock: lowStockProducts.length,
      });
    }
  }, [stockStatus, outOfStockProducts, lowStockProducts]);

  return <>{children}</>;
}

/**
 * Stock status badge component
 */
interface StockStatusBadgeProps {
  status: MenuProductStockStatus;
  quantity?: number;
  className?: string;
}

export function StockStatusBadge({ status, quantity, className }: StockStatusBadgeProps) {
  if (status === 'out_of_stock') {
    return (
      <Badge
        variant="destructive"
        className={cn('flex items-center gap-1', className)}
      >
        <PackageX className="w-3 h-3" />
        Out of Stock
      </Badge>
    );
  }

  if (status === 'low_stock') {
    return (
      <Badge
        variant="secondary"
        className={cn(
          'flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
          className
        )}
      >
        <AlertTriangle className="w-3 h-3" />
        Low Stock{quantity !== undefined && ` (${quantity})`}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        className
      )}
    >
      <Check className="w-3 h-3" />
      In Stock
    </Badge>
  );
}

/**
 * Hook to access menu inventory sync context
 * Use inside MenuLiveInventorySync component
 */
export function useMenuLiveInventory(options: {
  menuId: string;
  tenantId: string | null;
  productIds?: string[];
  lowStockThreshold?: number;
}) {
  const {
    stockStatus,
    isConnected,
    outOfStockProducts,
    lowStockProducts,
    refreshStock,
    getProductStatus,
    isProductAvailable,
  } = useMenuInventorySync({
    ...options,
    enabled: !!options.tenantId && !!options.menuId,
  });

  /**
   * Enhanced availability check with status
   */
  const getProductAvailability = useCallback((productId: string) => {
    const status = stockStatus.get(productId);
    return {
      isAvailable: status !== 'out_of_stock',
      status: status ?? 'available',
      isLowStock: status === 'low_stock',
      isOutOfStock: status === 'out_of_stock',
    };
  }, [stockStatus]);

  /**
   * Get products that should be hidden or grayed out
   */
  const unavailableProducts = useMemo(() => {
    return new Set(outOfStockProducts);
  }, [outOfStockProducts]);

  /**
   * Filter products based on availability
   */
  const filterAvailableProducts = useCallback(<T extends { id: string }>(
    products: T[]
  ): T[] => {
    return products.filter(p => isProductAvailable(p.id));
  }, [isProductAvailable]);

  /**
   * Sort products with available first
   */
  const sortByAvailability = useCallback(<T extends { id: string }>(
    products: T[]
  ): T[] => {
    return [...products].sort((a, b) => {
      const aAvailable = isProductAvailable(a.id);
      const bAvailable = isProductAvailable(b.id);
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      return 0;
    });
  }, [isProductAvailable]);

  return {
    // Status
    isConnected,
    stockStatus,

    // Product lists
    outOfStockProducts,
    lowStockProducts,
    unavailableProducts,

    // Helpers
    getProductStatus,
    getProductAvailability,
    isProductAvailable,
    refreshStock,

    // List utilities
    filterAvailableProducts,
    sortByAvailability,
  };
}

export default MenuLiveInventorySync;
