import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeStorage } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';

export interface GuestCartItem {
  product_id: string;
  quantity: number;
  selected_weight: string;
  product?: Record<string, unknown>;
}

/**
 * Extracts tenant/store slug from the current URL path.
 * Customer portal routes follow /:tenantSlug/shop/... pattern.
 */
function getSlugFromUrl(): string | null {
  try {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // Routes: /:tenantSlug/shop/... or /:tenantSlug/...
    if (parts.length >= 1) {
      return parts[0];
    }
  } catch {
    // SSR or unavailable
  }
  return null;
}

/**
 * Returns the store-scoped localStorage key for the guest cart.
 */
function getCartKey(storeSlug: string | undefined): string {
  if (storeSlug) {
    return `${STORAGE_KEYS.GUEST_CART}_${storeSlug}`;
  }
  const slug = getSlugFromUrl();
  if (slug) {
    return `${STORAGE_KEYS.GUEST_CART}_${slug}`;
  }
  // Fallback to unscoped key (backwards compat)
  return STORAGE_KEYS.GUEST_CART;
}

function readCartFromStorage(cartKey: string): GuestCartItem[] {
  const saved = safeStorage.getItem(cartKey);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    safeStorage.removeItem(cartKey);
    return [];
  }
}

interface UseGuestCartOptions {
  storeSlug?: string;
}

export const useGuestCart = (options?: UseGuestCartOptions) => {
  const cartKey = useMemo(() => getCartKey(options?.storeSlug), [options?.storeSlug]);
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>([]);

  // Load cart from localStorage
  const loadCart = useCallback(() => {
    const parsed = readCartFromStorage(cartKey);
    setGuestCart(parsed);
    return parsed;
  }, [cartKey]);

  // Load cart on mount
  useEffect(() => {
    loadCart();

    // Migrate unscoped cart to scoped key if applicable
    if (cartKey !== STORAGE_KEYS.GUEST_CART) {
      try {
        const unscopedData = safeStorage.getItem(STORAGE_KEYS.GUEST_CART);
        if (unscopedData) {
          const unscopedItems = JSON.parse(unscopedData);
          if (Array.isArray(unscopedItems) && unscopedItems.length > 0) {
            const scopedData = safeStorage.getItem(cartKey);
            if (!scopedData) {
              // Migrate to scoped key
              safeStorage.setItem(cartKey, unscopedData);
              setGuestCart(unscopedItems);
              logger.info('Migrated unscoped guest cart to store-scoped key', { cartKey });
            }
            safeStorage.removeItem(STORAGE_KEYS.GUEST_CART);
          }
        }
      } catch {
        // Migration is best-effort
      }
    }
  }, [cartKey, loadCart]);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => {
      loadCart();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, [loadCart]);

  // Listen for localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== cartKey) return;
      loadCart();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [cartKey, loadCart]);

  // Save to localStorage whenever cart changes
  const saveCart = useCallback((cart: GuestCartItem[]) => {
    try {
      safeStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      logger.warn('Failed to persist guest cart');
    }
    setGuestCart(cart);
  }, [cartKey]);

  const addToGuestCart = useCallback((productId: string, quantity: number, selectedWeight: string) => {
    const currentCart = readCartFromStorage(cartKey);

    const existingIndex = currentCart.findIndex(
      (item: GuestCartItem) => item.product_id === productId && item.selected_weight === selectedWeight
    );

    let newCart: GuestCartItem[];
    if (existingIndex >= 0) {
      newCart = [...currentCart];
      newCart[existingIndex].quantity += quantity;
    } else {
      newCart = [...currentCart, { product_id: productId, quantity, selected_weight: selectedWeight }];
    }

    saveCart(newCart);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: newCart } }));
  }, [cartKey, saveCart]);

  const updateGuestCartItem = useCallback((productId: string, selectedWeight: string, quantity: number) => {
    const currentCart = readCartFromStorage(cartKey);

    const newCart = currentCart.map((item: GuestCartItem) =>
      item.product_id === productId && item.selected_weight === selectedWeight
        ? { ...item, quantity }
        : item
    );
    saveCart(newCart);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: newCart } }));
  }, [cartKey, saveCart]);

  const removeFromGuestCart = useCallback((productId: string, selectedWeight: string) => {
    const currentCart = readCartFromStorage(cartKey);

    const newCart = currentCart.filter(
      (item: GuestCartItem) => !(item.product_id === productId && item.selected_weight === selectedWeight)
    );
    saveCart(newCart);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: newCart } }));
  }, [cartKey, saveCart]);

  const clearGuestCart = useCallback(() => {
    safeStorage.removeItem(cartKey);
    setGuestCart([]);
  }, [cartKey]);

  const getGuestCartCount = useCallback(() => {
    const currentCart = readCartFromStorage(cartKey);
    return currentCart.reduce((sum: number, item: GuestCartItem) => sum + item.quantity, 0);
  }, [cartKey]);

  return {
    guestCart,
    addToGuestCart,
    updateGuestCartItem,
    removeFromGuestCart,
    clearGuestCart,
    getGuestCartCount,
  };
};
