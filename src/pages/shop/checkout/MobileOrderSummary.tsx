/**
 * MobileOrderSummary
 * Collapsible order summary shown on mobile (above the form)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ChevronUp, ChevronDown } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/formatters';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface MobileOrderSummaryProps {
  cartCount: number;
  cartItems: CartItem[];
  subtotal: number;
  effectiveDeliveryFee: number;
  couponDiscount: number;
  total: number;
  themeColor: string;
  isLuxuryTheme: boolean;
  expanded: boolean;
  onToggle: () => void;
}

export function MobileOrderSummary({
  cartCount,
  cartItems,
  subtotal,
  effectiveDeliveryFee,
  couponDiscount,
  total,
  themeColor,
  isLuxuryTheme,
  expanded,
  onToggle,
}: MobileOrderSummaryProps) {
  return (
    <div className="lg:hidden mb-4 sm:mb-6">
      <button
        onClick={onToggle}
        className={`w-full p-3 sm:p-4 rounded-lg border flex items-center justify-between transition-colors ${isLuxuryTheme
          ? 'bg-white/5 border-white/10 text-white'
          : 'bg-muted/50 border-border'
          }`}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: themeColor }} />
          <span className="font-medium text-sm sm:text-base">
            {cartCount} {cartCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-bold text-sm sm:text-base" style={{ color: themeColor }}>
            {formatCurrency(total)}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`p-3 sm:p-4 mt-2 rounded-lg border space-y-2 sm:space-y-3 ${isLuxuryTheme ? 'bg-white/5 border-white/10' : 'bg-card border-border'
              }`}>
              {/* Cart Items */}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between text-sm">
                    <span className={`truncate max-w-[60%] ${isLuxuryTheme ? 'text-white/80' : ''}`}>
                      {item.quantity}x {item.name}
                    </span>
                    <span className={isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}>
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className={isLuxuryTheme ? 'bg-white/10' : ''} />

              {/* Summary */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className={isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}>Subtotal</span>
                  <span className={isLuxuryTheme ? 'text-white' : ''}>{formatCurrency(subtotal)}</span>
                </div>
                {effectiveDeliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className={isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}>Delivery</span>
                    <span className={isLuxuryTheme ? 'text-white' : ''}>{formatCurrency(effectiveDeliveryFee)}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(couponDiscount)}</span>
                  </div>
                )}
              </div>

              <Separator className={isLuxuryTheme ? 'bg-white/10' : ''} />

              <div className="flex justify-between font-bold">
                <span className={isLuxuryTheme ? 'text-white' : ''}>Total</span>
                <span style={{ color: themeColor }}>{formatCurrency(total)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
