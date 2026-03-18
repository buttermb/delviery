import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  selectedWeight?: string;
}

interface MenuCartContextType {
  items: CartItem[];
  addItem: (product: { id: string; name: string; price: number; image_url?: string; selectedWeight?: string }) => void;
  removeItem: (productId: string, selectedWeight?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedWeight?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
}

const MenuCartContext = createContext<MenuCartContextType | undefined>(undefined);

export function MenuCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (product: { id: string; name: string; price: number; image_url?: string; selectedWeight?: string }) => {
    setItems(prev => {
      // Create a unique key based on product ID and weight
      const existing = prev.find(item => 
        item.productId === product.id && 
        item.selectedWeight === product.selectedWeight
      );
      
      if (existing) {
        return prev.map(item =>
          (item.productId === product.id && item.selectedWeight === product.selectedWeight)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: 1,
        imageUrl: product.image_url,
        selectedWeight: product.selectedWeight,
      }];
    });
  };

  const removeItem = (productId: string, selectedWeight?: string) => {
    setItems(prev => prev.filter(item => 
      !(item.productId === productId && item.selectedWeight === selectedWeight)
    ));
  };

  const updateQuantity = (productId: string, quantity: number, selectedWeight?: string) => {
    if (quantity <= 0) {
      removeItem(productId, selectedWeight);
      return;
    }
    setItems(prev =>
      prev.map(item =>
        (item.productId === productId && item.selectedWeight === selectedWeight) 
          ? { ...item, quantity } 
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  return (
    <MenuCartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalAmount,
      }}
    >
      {children}
    </MenuCartContext.Provider>
  );
}

export function useMenuCart() {
  const context = useContext(MenuCartContext);
  if (!context) {
    throw new Error('useMenuCart must be used within MenuCartProvider');
  }
  return context;
}
