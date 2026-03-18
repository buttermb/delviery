/**
 * Cart Page Prefetch Hook
 * Prefetches cart page data (deals, stock, upsells) when the cart has items.
 * Used in ShopLayout to warm TanStack Query cache before cart page navigation.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { safeStorage } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import type { ShopCartItem } from '@/hooks/useShopCart';

interface UseCartPagePrefetchOptions {
  storeId: string | undefined;
  cartItemCount: number;
}

/**
 * Reads cart items from localStorage for prefetch queries.
 * Returns empty array if cart is empty or unreadable.
 */
function readCartItems(storeId: string): ShopCartItem[] {
  try {
    const raw = safeStorage.getItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${storeId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const STALE_TIME_DEALS = 5 * 60 * 1000; // 5 minutes — matches useDeals.ts
const STALE_TIME_STOCK = 30_000; // 30 seconds for real-time stock data
const STALE_TIME_UPSELLS = 2 * 60 * 1000; // 2 minutes

export function useCartPagePrefetch({ storeId, cartItemCount }: UseCartPagePrefetchOptions) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storeId || cartItemCount === 0) {
      prefetchedRef.current = null;
      return;
    }

    // Skip if we already prefetched for this store — TanStack Query handles staleness
    if (prefetchedRef.current === storeId) return;
    prefetchedRef.current = storeId;

    const cartItems = readCartItems(storeId);
    if (cartItems.length === 0) return;

    logger.debug('[PREFETCH] Warming cart page cache', { storeId, itemCount: cartItems.length });

    // 1. Prefetch active deals for the store
    void queryClient.prefetchQuery({
      queryKey: queryKeys.activeDeals.byStore(storeId),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('marketplace_deals')
          .select('*')
          .eq('store_id', storeId)
          .eq('is_active', true);

        if (error) {
          logger.warn('[PREFETCH] Failed to prefetch deals', error);
          return [];
        }
        return data ?? [];
      },
      staleTime: STALE_TIME_DEALS,
    });

    // 2. Prefetch stock check for cart items
    const productIds = cartItems.map(item => item.productId);
    const itemsKey = cartItems.map(i => `${i.productId}:${i.quantity}`).join(',');

    void queryClient.prefetchQuery({
      queryKey: queryKeys.cartStockCheck.byItems(itemsKey),
      queryFn: async () => {
        const { data: products, error } = await supabase
          .from('products')
          .select('id, name, stock_quantity, available_quantity')
          .in('id', productIds);

        if (error) {
          logger.warn('[PREFETCH] Failed to prefetch stock', error);
          return { hasInsufficientStock: false, insufficientItems: [] };
        }

        const insufficientItems: Array<{
          productId: string;
          name: string;
          requested: number;
          available: number;
        }> = [];

        for (const item of cartItems) {
          const product = products?.find(p => p.id === item.productId);
          if (product) {
            const available = product.available_quantity ?? product.stock_quantity ?? 0;
            if (available < item.quantity) {
              insufficientItems.push({
                productId: item.productId,
                name: item.name,
                requested: item.quantity,
                available,
              });
            }
          }
        }

        return {
          hasInsufficientStock: insufficientItems.length > 0,
          insufficientItems,
        };
      },
      staleTime: STALE_TIME_STOCK,
    });

    // 3. Prefetch upsell products
    void queryClient.prefetchQuery({
      queryKey: queryKeys.upsellProducts.byStore(storeId),
      queryFn: async () => {
        const { data, error } = await supabase
          .rpc('get_marketplace_products', { p_store_id: storeId });

        if (error) {
          logger.warn('[PREFETCH] Failed to prefetch upsells', error);
          return [];
        }
        return data ?? [];
      },
      staleTime: STALE_TIME_UPSELLS,
    });
  }, [storeId, cartItemCount, queryClient]);
}
