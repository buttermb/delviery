import { useState, useEffect } from 'react';
import { safeStorage } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export interface GuestCartItem {
  product_id: string;
  quantity: number;
  selected_weight: string;
  product?: Record<string, unknown>;
}

const GUEST_CART_KEY = STORAGE_KEYS.GUEST_CART;

function readCartFromStorage(): GuestCartItem[] {
  const saved = safeStorage.getItem(GUEST_CART_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved) as GuestCartItem[];
  } catch {
    safeStorage.removeItem(GUEST_CART_KEY);
    return [];
  }
}

export const useGuestCart = () => {
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>([]);

  // Load cart from localStorage
  const loadCart = () => {
    const parsed = readCartFromStorage();
    setGuestCart(parsed);
    return parsed;
  };

  // Load cart on mount
  useEffect(() => {
    loadCart();
  }, []);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => {
      loadCart();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => window.removeEventListener('cartUpdated', handleCartUpdate);
  }, []);

  // Save to localStorage whenever cart changes
  const saveCart = (cart: GuestCartItem[]) => {
    safeStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
    setGuestCart(cart);
  };

  const addToGuestCart = (productId: string, quantity: number, selectedWeight: string) => {
    // Always read fresh data from localStorage
    const currentCart = readCartFromStorage();

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

    // Trigger custom event for cart update
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: newCart } }));
  };

  const updateGuestCartItem = (productId: string, selectedWeight: string, quantity: number) => {
    // Read fresh data from localStorage
    const currentCart = readCartFromStorage();

    const newCart = currentCart.map((item: GuestCartItem) =>
      item.product_id === productId && item.selected_weight === selectedWeight
        ? { ...item, quantity }
        : item
    );
    saveCart(newCart);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: newCart } }));
  };

  const removeFromGuestCart = (productId: string, selectedWeight: string) => {
    // Read fresh data from localStorage
    const currentCart = readCartFromStorage();

    const newCart = currentCart.filter(
      (item: GuestCartItem) => !(item.product_id === productId && item.selected_weight === selectedWeight)
    );
    saveCart(newCart);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart: newCart } }));
  };

  const clearGuestCart = () => {
    safeStorage.removeItem(GUEST_CART_KEY);
    setGuestCart([]);
  };

  const getGuestCartCount = () => {
    // Always read fresh data from localStorage
    const currentCart = readCartFromStorage();
    return currentCart.reduce((sum: number, item: GuestCartItem) => sum + item.quantity, 0);
  };

  return {
    guestCart,
    addToGuestCart,
    updateGuestCartItem,
    removeFromGuestCart,
    clearGuestCart,
    getGuestCartCount,
  };
};
