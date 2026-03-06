import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface CartItem {
  productId: string;
  quantity: number;
  weight: string;
  price: number;
  productName: string;
}

interface MenuCartStore {
  items: CartItem[];
  menuToken: string | null;
  addItem: (item: Omit<CartItem, 'quantity'>, maxQuantity?: number) => void;
  removeItem: (productId: string, weight?: string) => void;
  updateQuantity: (productId: string, quantity: number, weight?: string, maxQuantity?: number) => void;
  clearCart: () => void;
  setMenuToken: (token: string | null) => void;
  getTotal: () => number;
  getItemCount: () => number;
}

/** Storage key prefix for menu-scoped carts */
const MENU_CART_PREFIX = `${STORAGE_KEYS.CART_ITEMS}_menu_`;

/**
 * Custom storage that scopes menu cart data by menu token.
 * Each menu token gets its own localStorage entry so carts don't collide.
 */
const menuScopedStorage = createJSONStorage(() => ({
  getItem: (name: string): string | null => {
    try {
      // Read the base key to find the current token
      const baseData = localStorage.getItem(name);
      if (!baseData) return null;

      const parsed = JSON.parse(baseData) as { state?: { menuToken?: string } };
      const token = parsed?.state?.menuToken;

      if (token) {
        // Prefer the token-scoped entry
        const scopedData = localStorage.getItem(`${MENU_CART_PREFIX}${token}`);
        if (scopedData) return scopedData;
      }

      return baseData;
    } catch {
      return null;
    }
  },

  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value) as { state?: { menuToken?: string } };
      const token = parsed?.state?.menuToken;

      // Always write to base key (tracks current token)
      localStorage.setItem(name, value);

      // Also write to token-scoped key for persistence across sessions
      if (token) {
        localStorage.setItem(`${MENU_CART_PREFIX}${token}`, value);
      }
    } catch {
      logger.warn('Failed to persist menu cart');
    }
  },

  removeItem: (name: string): void => {
    try {
      const baseData = localStorage.getItem(name);
      if (baseData) {
        const parsed = JSON.parse(baseData) as { state?: { menuToken?: string } };
        const token = parsed?.state?.menuToken;
        if (token) {
          localStorage.removeItem(`${MENU_CART_PREFIX}${token}`);
        }
      }
      localStorage.removeItem(name);
    } catch {
      // Storage unavailable
    }
  },
}));

export const useMenuCartStore = create<MenuCartStore>()(
  persist(
    (set, get) => ({
      items: [],
      menuToken: null,

      addItem: (item, maxQuantity) => {
        const currentCount = get().items.reduce((sum, i) => sum + i.quantity, 0);
        if (maxQuantity != null && maxQuantity > 0 && currentCount >= maxQuantity) {
          logger.warn('Max order quantity reached', { maxQuantity, currentCount });
          return;
        }

        const existing = get().items.find(i => i.productId === item.productId && i.weight === item.weight);
        if (existing) {
          const newQty = existing.quantity + 1;
          const cappedQty = (maxQuantity != null && maxQuantity > 0)
            ? Math.min(newQty, maxQuantity - currentCount + existing.quantity)
            : newQty;
          set((state) => ({
            items: state.items.map(i =>
              i.productId === item.productId && i.weight === item.weight
                ? { ...i, quantity: cappedQty }
                : i
            ),
          }));
        } else {
          set((state) => ({
            items: [...state.items, { ...item, quantity: 1 }],
          }));
        }
      },

      removeItem: (productId, weight) => {
        set((state) => ({
          items: state.items.filter(i =>
            !(i.productId === productId && (weight === undefined || i.weight === weight))
          ),
        }));
      },

      updateQuantity: (productId, quantity, weight, maxQuantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, weight);
          return;
        }

        // Calculate what the new total would be if we apply this quantity
        const items = get().items;
        const currentItem = items.find(
          i => i.productId === productId && (weight === undefined || i.weight === weight)
        );
        const currentItemQty = currentItem?.quantity ?? 0;
        const otherItemsTotal = items.reduce((sum, i) => sum + i.quantity, 0) - currentItemQty;
        const cappedQty = (maxQuantity != null && maxQuantity > 0)
          ? Math.min(quantity, maxQuantity - otherItemsTotal)
          : quantity;

        if (cappedQty <= 0) {
          get().removeItem(productId, weight);
          return;
        }

        set((state) => ({
          items: state.items.map(i =>
            i.productId === productId && (weight === undefined || i.weight === weight)
              ? { ...i, quantity: cappedQty }
              : i
          ),
        }));
      },

      clearCart: () => {
        set({ items: [], menuToken: null });
      },

      setMenuToken: (token) => {
        const currentToken = get().menuToken;
        if (token === currentToken) return;

        // Load cart for the new token from localStorage
        if (token) {
          try {
            const scopedData = localStorage.getItem(`${MENU_CART_PREFIX}${token}`);
            if (scopedData) {
              const parsed = JSON.parse(scopedData) as { state?: { items?: CartItem[] } };
              const savedItems = parsed?.state?.items;
              if (Array.isArray(savedItems)) {
                set({ menuToken: token, items: savedItems });
                return;
              }
            }
          } catch {
            logger.warn('Failed to load scoped menu cart', { token });
          }
        }

        // No saved cart for this token — start fresh
        set({ menuToken: token, items: [] });
      },

      getTotal: () => {
        return get().items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'menu-cart-storage',
      storage: menuScopedStorage,
      partialize: (state) => ({ items: state.items, menuToken: state.menuToken }),
    }
  )
);
