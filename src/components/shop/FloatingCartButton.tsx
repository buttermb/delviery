/**
 * Floating Cart Button
 * Animated cart FAB with badge for shop pages
 * Uses shop context for cart data instead of menu cart context
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShop } from '@/pages/shop/ShopLayout';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface FloatingCartButtonProps {
  primaryColor?: string;
  onCheckout?: () => void;
}

export function FloatingCartButton({ primaryColor = '#10b981', onCheckout }: FloatingCartButtonProps) {
  const navigate = useNavigate();
  const { storeSlug } = useParams();
  const { store, cartItemCount } = useShop();

  // Calculate cart total from localStorage
  const getCartTotal = (): number => {
    if (!store?.id) return 0;
    try {
      const savedCart = localStorage.getItem(`shop_cart_${store.id}`);
      if (savedCart) {
        const items = JSON.parse(savedCart);
        return items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      }
    } catch {
      // Invalid cart data
    }
    return 0;
  };

  const handleClick = () => {
    if (onCheckout) {
      onCheckout();
    } else {
      navigate(`/shop/${storeSlug}/cart`);
    }
  };

  if (cartItemCount === 0) return null;

  const totalAmount = getCartTotal();
  const themeColor = primaryColor || store?.primary_color || '#10b981';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="fixed bottom-24 right-6 z-50 md:bottom-8"
      >
        <Button
          onClick={handleClick}
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
  );
}
