/**
 * Floating Cart Button
 * Animated cart FAB with badge that opens CartDrawer
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShop } from '@/pages/shop/ShopLayout';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { CartDrawer, type CartItem } from './CartDrawer';

interface FloatingCartButtonProps {
  primaryColor?: string;
  onCheckout?: () => void;
}

export function FloatingCartButton({ primaryColor = '#10b981', onCheckout: _onCheckout }: FloatingCartButtonProps) {
  const { storeSlug: _storeSlug } = useParams();
  const { store, cartItemCount } = useShop();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load cart items from localStorage
  useEffect(() => {
    if (!store?.id) return;
    
    const loadCart = () => {
      try {
        const savedCart = localStorage.getItem(`shop_cart_${store.id}`);
        if (savedCart) {
          setCartItems(JSON.parse(savedCart));
        } else {
          setCartItems([]);
        }
      } catch {
        setCartItems([]);
      }
    };

    loadCart();

    // Listen for cart changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `shop_cart_${store.id}`) {
        loadCart();
      }
    };

    // Custom event for same-tab updates
    const handleCartUpdate = () => loadCart();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cart-updated', handleCartUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, [store?.id]);

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (!store?.id) return;
    
    const updatedItems = cartItems.map(item =>
      item.productId === productId ? { ...item, quantity: Math.max(1, newQuantity) } : item
    );
    
    setCartItems(updatedItems);
    localStorage.setItem(`shop_cart_${store.id}`, JSON.stringify(updatedItems));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const handleRemoveItem = (productId: string) => {
    if (!store?.id) return;
    
    const updatedItems = cartItems.filter(item => item.productId !== productId);
    setCartItems(updatedItems);
    localStorage.setItem(`shop_cart_${store.id}`, JSON.stringify(updatedItems));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const themeColor = primaryColor || store?.primary_color || '#10b981';

  if (cartItemCount === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed bottom-24 right-6 z-40 md:bottom-8"
        >
          <Button
            onClick={() => setIsDrawerOpen(true)}
            className="group relative h-16 w-16 rounded-full shadow-2xl transition-all duration-300 hover:scale-110"
            style={{ backgroundColor: themeColor }}
          >
            {/* Glow effect */}
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity"
              style={{ backgroundColor: themeColor }}
            />

            {/* Icon */}
            <ShoppingBag className="h-6 w-6 text-white relative z-10" />

            {/* Badge */}
            <span className="absolute -top-1 -right-1 h-6 w-6 bg-white text-black text-xs font-medium rounded-full flex items-center justify-center shadow-lg">
              {cartItemCount > 9 ? '9+' : cartItemCount}
            </span>

            {/* Price pill - shows on hover on desktop */}
            {totalAmount > 0 && (
              <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-xl text-white px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden md:block">
                <span className="text-sm font-light">{formatCurrency(totalAmount)}</span>
              </div>
            )}
          </Button>
        </motion.div>
      </AnimatePresence>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        accentColor={themeColor}
      />
    </>
  );
}
