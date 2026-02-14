import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setMenuToken: (token: string | null) => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useMenuCartStore = create<MenuCartStore>()(
  persist(
    (set, get) => ({
      items: [],
      menuToken: null,
      
      addItem: (item) => {
        const existing = get().items.find(i => i.productId === item.productId && i.weight === item.weight);
        if (existing) {
          set((state) => ({
            items: state.items.map(i =>
              i.productId === item.productId && i.weight === item.weight
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          }));
        } else {
          set((state) => ({
            items: [...state.items, { ...item, quantity: 1 }],
          }));
        }
      },
      
      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter(i => i.productId !== productId),
        }));
      },
      
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map(i =>
            i.productId === productId
              ? { ...i, quantity }
              : i
          ),
        }));
      },
      
      clearCart: () => {
        set({ items: [], menuToken: null });
      },
      
      setMenuToken: (token) => {
        set({ menuToken: token });
        // Clear cart if switching menus
        if (token !== get().menuToken) {
          set({ items: [] });
        }
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
      partialize: (state) => ({ items: state.items, menuToken: state.menuToken }),
    }
  )
);

