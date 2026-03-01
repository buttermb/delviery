/**
 * CartDrawer - Slide-in cart panel using shadcn Sheet
 * Shows cart items, quantities, delivery fee, minimum order notice, and checkout CTA
 */

import { motion } from 'framer-motion';
import { X, Minus, Plus, ShoppingBag, Trash2, ArrowRight, Truck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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
  onUpdateQuantity: (productId: string, quantity: number, variant?: string) => void;
  onRemoveItem: (productId: string, variant?: string) => void;
  accentColor?: string;
  deliveryFee?: number;
  freeDeliveryThreshold?: number;
  minimumOrderAmount?: number;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  accentColor = '#10b981',
  deliveryFee = 0,
  freeDeliveryThreshold,
  minimumOrderAmount,
}: CartDrawerProps) {
  const navigate = useNavigate();
  const { storeSlug } = useParams<{ storeSlug: string }>();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const qualifiesForFreeDelivery = freeDeliveryThreshold != null && subtotal >= freeDeliveryThreshold;
  const effectiveDeliveryFee = qualifiesForFreeDelivery ? 0 : deliveryFee;
  const total = subtotal + effectiveDeliveryFee;
  const belowMinimum = minimumOrderAmount != null && minimumOrderAmount > 0 && subtotal < minimumOrderAmount;

  const handleCheckout = () => {
    if (belowMinimum) return;
    onClose();
    navigate(`/shop/${storeSlug}/checkout`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-md sm:max-w-md bg-card border-l border-border p-0 flex flex-col gap-0 overflow-hidden [&>button:last-child]:hidden"
      >
        <SheetTitle className="sr-only">Shopping Cart</SheetTitle>
        <SheetDescription className="sr-only">
          Your shopping cart items and checkout
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-foreground" />
            <h2 className="text-foreground text-lg font-light tracking-wide">
              Your Cart
            </h2>
            {itemCount > 0 && (
              <span className="px-2 py-0.5 bg-white/10 rounded-full text-white/60 text-sm">
              <span className="px-2 py-0.5 bg-muted rounded-full text-muted-foreground text-xs">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Close cart"
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Cart Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-white/70 text-center mb-6">Your cart is empty</p>
            <p className="text-muted-foreground text-center mb-6">Your cart is empty</p>
            <Button
              onClick={onClose}
              variant="outline"
              className="rounded-full px-8"
            >
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-6 space-y-4">
                {items.map((item) => (
                  <motion.div
                    key={`${item.productId}-${item.variant ?? ''}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 sm:p-4 bg-white/[0.02] rounded-xl border border-white/5"
                  >
                    {/* Top row: Image + Details + Remove */}
                    <div className="flex gap-3 sm:gap-4">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                        <ProductImage
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    className="flex gap-4 p-4 bg-muted/30 rounded-xl border border-border"
                  >
                    {/* Image */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-foreground text-sm font-medium truncate mb-1">
                        {item.name}
                      </h3>
                      {item.variant && (
                        <p className="text-white/40 text-sm mb-2">{item.variant}</p>
                        <p className="text-white/70 text-xs mb-2">{item.variant}</p>
                        <p className="text-muted-foreground text-xs mb-2">{item.variant}</p>
                      )}
                      <p className="text-foreground/80 text-sm font-light">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white text-sm font-medium truncate mb-1">
                          {item.name}
                        </h3>
                        {item.variant && (
                          <p className="text-white/40 text-xs mb-1">{item.variant}</p>
                        )}
                        <p className="text-white/80 text-sm font-light">
                          {formatCurrency(item.price)}
                        </p>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.productId, item.variant)}
                        className="p-1 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Remove ${item.name} from cart`}
                        className="p-2 -mr-1 -mt-1 rounded-full hover:bg-white/10 transition-colors self-start"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4 text-white/70 hover:text-red-400 transition-colors" />
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                      </button>
                    </div>

                      <div className="flex items-center gap-1 bg-white/5 rounded-full p-0.5">
                        <button
                          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1, item.variant)}
                          disabled={item.quantity <= 1}
                          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Decrease ${item.name} quantity`}
                    {/* Bottom row: Quantity controls + line total */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
                        <button
                          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1, item.variant)}
                          disabled={item.quantity <= 1}
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5 text-white" />
                        </button>
                        <span className="text-white text-sm w-8 text-center font-medium">
                      <div className="flex items-center gap-2 bg-muted rounded-full p-1">
                        <button
                          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1, item.variant)}
                          disabled={item.quantity <= 1}
                          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="w-3 h-3 text-foreground" />
                        </button>
                        <span className="text-foreground text-sm w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.productId, item.quantity + 1, item.variant)}
                          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Increase ${item.name} quantity`}
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5 text-white" />
                          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted/80 transition-colors"
                        >
                          <Plus className="w-3 h-3 text-foreground" />
                        </button>
                      </div>
                      <span className="text-white text-sm font-medium">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-border space-y-3">
              {/* Minimum Order Notice */}
              {belowMinimum && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-300 text-sm">
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-warning text-xs">
                    Minimum order is {formatCurrency(minimumOrderAmount)}. Add{' '}
                    {formatCurrency(minimumOrderAmount! - subtotal)} more to checkout.
                  </p>
                </div>
              )}

              {/* Free delivery progress */}
              {freeDeliveryThreshold != null && !qualifiesForFreeDelivery && subtotal > 0 && (
                <div className="text-center">
                  <p className="text-emerald-400/80 text-sm">
                  <p className="text-success text-xs">
                    Add {formatCurrency(freeDeliveryThreshold - subtotal)} more for free delivery
                  </p>
                  <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((subtotal / freeDeliveryThreshold) * 100, 100)}%`,
                        backgroundColor: accentColor,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Subtotal */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Subtotal</span>
                <span className="text-foreground text-sm">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {/* Delivery Fee */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  Delivery
                </span>
                {qualifiesForFreeDelivery ? (
                  <span className="text-success text-sm font-medium">Free</span>
                ) : effectiveDeliveryFee > 0 ? (
                  <span className="text-foreground text-sm">{formatCurrency(effectiveDeliveryFee)}</span>
                ) : (
                  <span className="text-white/70 text-sm">Free</span>
                  <span className="text-muted-foreground text-sm">Free</span>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-foreground text-sm font-medium">Total</span>
                <span className="text-foreground text-xl font-light">
                  {formatCurrency(total)}
                </span>
              </div>

              <p className="text-white/40 text-sm text-center">
              <p className="text-white/70 text-xs text-center">
              <p className="text-muted-foreground text-xs text-center">
                Taxes calculated at checkout
              </p>

              {/* Checkout Button */}
              <Button
                onClick={handleCheckout}
                disabled={belowMinimum}
                className="w-full py-6 rounded-full text-sm font-medium tracking-widest uppercase transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: belowMinimum ? undefined : accentColor }}
              >
                <span className="flex items-center gap-2">
                  Checkout
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Button>

              {/* Continue Shopping */}
              <button
                onClick={onClose}
                className="w-full text-center text-white/70 text-sm hover:text-white/60 transition-colors"
                className="w-full text-center text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
