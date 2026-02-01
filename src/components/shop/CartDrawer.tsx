/**
 * CartDrawer - Slide-in cart panel
 * Shows cart items, quantities, and checkout CTA
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate, useParams } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import ProductImage from '@/components/ProductImage';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  variant?: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  accentColor?: string;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  accentColor = '#10b981',
}: CartDrawerProps) {
  const navigate = useNavigate();
  const { storeSlug } = useParams();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    onClose();
    navigate(`/shop/${storeSlug}/cart`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-neutral-950 border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-white" />
                <h2 className="text-white text-lg font-light tracking-wide">
                  Your Cart
                </h2>
                {itemCount > 0 && (
                  <span className="px-2 py-0.5 bg-white/10 rounded-full text-white/60 text-xs">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Cart Items */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40 text-center mb-6">Your cart is empty</p>
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10 rounded-full px-8"
                >
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-4">
                    {items.map((item) => (
                      <motion.div
                        key={item.productId}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="flex gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/5"
                      >
                        {/* Image */}
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                          <ProductImage
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white text-sm font-medium truncate mb-1">
                            {item.name}
                          </h3>
                          {item.variant && (
                            <p className="text-white/40 text-xs mb-2">{item.variant}</p>
                          )}
                          <p className="text-white/80 text-sm font-light">
                            {formatCurrency(item.price)}
                          </p>
                        </div>

                        {/* Quantity & Remove */}
                        <div className="flex flex-col items-end justify-between">
                          <button
                            onClick={() => onRemoveItem(item.productId)}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400 transition-colors" />
                          </button>

                          <div className="flex items-center gap-2 bg-white/5 rounded-full p-1">
                            <button
                              onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Minus className="w-3 h-3 text-white" />
                            </button>
                            <span className="text-white text-sm w-6 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                              <Plus className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 space-y-4">
                  {/* Subtotal */}
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">Subtotal</span>
                    <span className="text-white text-xl font-light">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>

                  <p className="text-white/40 text-xs text-center">
                    Shipping & taxes calculated at checkout
                  </p>

                  {/* Checkout Button */}
                  <Button
                    onClick={handleCheckout}
                    className="w-full py-6 rounded-full text-sm font-medium tracking-widest uppercase transition-all duration-300 group"
                    style={{ backgroundColor: accentColor }}
                  >
                    <span className="flex items-center gap-2">
                      Checkout
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Button>

                  {/* Continue Shopping */}
                  <button
                    onClick={onClose}
                    className="w-full text-center text-white/40 text-sm hover:text-white/60 transition-colors"
                  >
                    Continue Shopping
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
