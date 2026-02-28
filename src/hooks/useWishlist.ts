/**
 * useWishlist - Wishlist management hook
 * Stores wishlist in localStorage for unauthenticated users
 * Can be extended to sync with database for authenticated users
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { safeStorage } from '@/utils/safeStorage';

export interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  addedAt: number;
}

interface UseWishlistOptions {
  storeId?: string;
}

export function useWishlist({ storeId }: UseWishlistOptions = {}) {
  const storageKey = storeId ? `wishlist_${storeId}` : 'wishlist_global';
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load wishlist from localStorage on mount
  useEffect(() => {
    try {
      const saved = safeStorage.getItem(storageKey);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (error) {
      logger.warn('Failed to load wishlist', error);
    }
    setIsLoaded(true);
  }, [storageKey]);

  // Save to localStorage whenever items change
  useEffect(() => {
    if (isLoaded) {
      try {
        safeStorage.setItem(storageKey, JSON.stringify(items));
      } catch (error) {
        logger.warn('Failed to save wishlist', error);
      }
    }
  }, [items, storageKey, isLoaded]);

  const addItem = useCallback((item: Omit<WishlistItem, 'addedAt'>) => {
    setItems(prev => {
      // Don't add duplicates
      if (prev.some(i => i.productId === item.productId)) {
        return prev;
      }
      return [...prev, { ...item, addedAt: Date.now() }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const toggleItem = useCallback((item: Omit<WishlistItem, 'addedAt'>) => {
    setItems(prev => {
      const exists = prev.some(i => i.productId === item.productId);
      if (exists) {
        return prev.filter(i => i.productId !== item.productId);
      }
      return [...prev, { ...item, addedAt: Date.now() }];
    });
  }, []);

  const isInWishlist = useCallback((productId: string) => {
    return items.some(i => i.productId === productId);
  }, [items]);

  const clearWishlist = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    itemCount: items.length,
    addItem,
    removeItem,
    toggleItem,
    isInWishlist,
    clearWishlist,
    isLoaded,
  };
}
