/**
 * Real-time Inventory Sync Hook for Storefront
 * Listens to product and inventory changes and invalidates storefront product queries
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';

interface UseStorefrontInventorySyncProps {
  storeId: string | undefined;
  tenantId?: string;
  enabled?: boolean;
  showNotifications?: boolean;
}

interface ProductChangePayload {
  new: {
    id: string;
    name: string;
    stock_quantity?: number;
    available_quantity?: number;
    in_stock?: boolean;
    tenant_id?: string;
  };
  old: {
    id: string;
    stock_quantity?: number;
    available_quantity?: number;
    in_stock?: boolean;
  };
}

interface InventoryBatchPayload {
  new: {
    id: string;
    product_id: string;
    current_quantity: number;
    tenant_id: string;
  };
  old: {
    current_quantity: number;
  };
}

export function useStorefrontInventorySync({
  storeId,
  tenantId,
  enabled = true,
  showNotifications = false,
}: UseStorefrontInventorySyncProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Memoized handler for product changes
  const handleProductChange = useCallback(
    (payload: ProductChangePayload) => {
      const { new: newProduct, old: oldProduct } = payload;

      const oldStock = oldProduct.stock_quantity ?? oldProduct.available_quantity ?? 0;
      const newStock = newProduct.stock_quantity ?? newProduct.available_quantity ?? 0;

      // Only invalidate if stock actually changed
      if (oldStock !== newStock || oldProduct.in_stock !== newProduct.in_stock) {
        logger.info('Storefront: Product stock changed, invalidating queries', {
          productId: newProduct.id,
          productName: newProduct.name,
          oldStock,
          newStock,
        });

        // Invalidate the storefront product list
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.list(storeId),
        });

        // Invalidate specific product detail if cached
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.detail(storeId, newProduct.id),
        });

        // Invalidate product stock query
        queryClient.invalidateQueries({
          queryKey: ['product-stock', newProduct.id],
        });

        // Show notification for out-of-stock events
        if (showNotifications && newStock === 0 && oldStock > 0) {
          toast({
            title: 'Product Unavailable',
            description: `${newProduct.name} is now out of stock.`,
            variant: 'destructive',
          });
        }
      }
    },
    [storeId, queryClient, toast, showNotifications]
  );

  // Memoized handler for inventory batch changes
  const handleInventoryBatchChange = useCallback(
    (payload: InventoryBatchPayload) => {
      const { new: newBatch, old: oldBatch } = payload;

      // Only invalidate if quantity changed
      if (oldBatch.current_quantity !== newBatch.current_quantity) {
        logger.info('Storefront: Inventory batch changed, invalidating queries', {
          productId: newBatch.product_id,
          oldQuantity: oldBatch.current_quantity,
          newQuantity: newBatch.current_quantity,
        });

        // Invalidate the storefront product list
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.list(storeId),
        });

        // Invalidate specific product detail
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProducts.detail(storeId, newBatch.product_id),
        });

        // Invalidate product stock query
        queryClient.invalidateQueries({
          queryKey: ['product-stock', newBatch.product_id],
        });
      }
    },
    [storeId, queryClient]
  );

  // Memoized handler for marketplace product settings changes
  const handleProductSettingsChange = useCallback(
    (payload: { new: { product_id: string; is_visible: boolean } }) => {
      logger.info('Storefront: Product settings changed, invalidating queries', {
        productId: payload.new.product_id,
        isVisible: payload.new.is_visible,
      });

      // Invalidate the storefront product list when visibility changes
      queryClient.invalidateQueries({
        queryKey: queryKeys.shopProducts.list(storeId),
      });
    },
    [storeId, queryClient]
  );

  useEffect(() => {
    if (!enabled || !storeId) return;

    // Create a unique channel name for this store
    const channelName = `storefront-inventory-${storeId}`;

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(channelName);

    // Listen to products table changes
    if (tenantId) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => handleProductChange(payload as unknown as { new: ProductChangePayload['new']; old: ProductChangePayload['old'] })
      );

      // Listen to inventory_batches changes
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_batches',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            handleInventoryBatchChange(payload as unknown as { new: InventoryBatchPayload['new']; old: InventoryBatchPayload['old'] });
          }
        }
      );
    }

    // Listen to marketplace_product_settings changes for this store
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'marketplace_product_settings',
        filter: `store_id=eq.${storeId}`,
      },
      (payload) => handleProductSettingsChange(payload as unknown as { new: { product_id: string; is_visible: boolean } })
    );

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('Storefront inventory sync channel subscribed', { storeId });
      } else if (status === 'CHANNEL_ERROR') {
        logger.warn('Storefront inventory sync channel error', { storeId });
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount or when dependencies change
    return () => {
      if (channelRef.current) {
        logger.info('Cleaning up storefront inventory sync channel', { storeId });
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    storeId,
    tenantId,
    enabled,
    handleProductChange,
    handleInventoryBatchChange,
    handleProductSettingsChange,
  ]);

  // Manual refresh function
  const refreshProducts = useCallback(() => {
    if (storeId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shopProducts.list(storeId),
      });
    }
  }, [storeId, queryClient]);

  return {
    refreshProducts,
    isConnected: enabled && !!storeId,
  };
}

/**
 * Hook to validate cart items against current inventory
 * Call this before checkout to ensure stock is still available
 */
export function useValidateCartInventory(storeId: string | undefined) {
  const queryClient = useQueryClient();

  const validateItems = useCallback(
    async (
      items: Array<{ productId: string; quantity: number; name: string }>
    ): Promise<{
      valid: boolean;
      outOfStock: Array<{ productId: string; name: string; available: number; requested: number }>;
      lowStock: Array<{ productId: string; name: string; available: number }>;
    }> => {
      if (!storeId || items.length === 0) {
        return { valid: true, outOfStock: [], lowStock: [] };
      }

      try {
        const productIds = items.map((item) => item.productId);

        const { data, error } = await supabase
          .from('products')
          .select('id, name, stock_quantity, available_quantity')
          .in('id', productIds);

        if (error) {
          logger.warn('Failed to validate cart inventory', error);
          // Don't block checkout on validation failure
          return { valid: true, outOfStock: [], lowStock: [] };
        }

        const outOfStock: Array<{ productId: string; name: string; available: number; requested: number }> = [];
        const lowStock: Array<{ productId: string; name: string; available: number }> = [];

        for (const item of items) {
          const product = data?.find((p) => p.id === item.productId);
          const available = product?.available_quantity ?? product?.stock_quantity ?? 0;

          if (available < item.quantity) {
            outOfStock.push({
              productId: item.productId,
              name: item.name,
              available,
              requested: item.quantity,
            });
          } else if (available > 0 && available <= 5) {
            lowStock.push({
              productId: item.productId,
              name: item.name,
              available,
            });
          }
        }

        return {
          valid: outOfStock.length === 0,
          outOfStock,
          lowStock,
        };
      } catch (err) {
        logger.error('Error validating cart inventory', err);
        return { valid: true, outOfStock: [], lowStock: [] };
      }
    },
    [storeId]
  );

  return { validateItems };
}
