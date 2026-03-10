import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ShoppingCart, ArrowRight, ArrowLeft,
  Package, Minus, Plus, Trash2, Check, Tag,
} from 'lucide-react';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { formatWeight } from '@/utils/productHelpers';
import { toast } from 'sonner';

// Swipeable Cart Item
function SwipeableCartItem({
  item,
  product,
  onUpdateQuantity,
  onRemove
}: {
  item: { productId: string; productName: string; weight?: string; price: number; quantity: number };
  product?: { image_url?: string };
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const deleteThreshold = -80;

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startX;
    setSwipeX(Math.min(0, Math.max(-100, diff)));
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < deleteThreshold) {
      onRemove();
    }
    setSwipeX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center">
        <Trash2 className="h-6 w-6 text-white" />
      </div>

      {/* Card content */}
      <Card
        className="relative bg-card transition-transform touch-pan-y"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <CardContent className="p-3">
          <div className="flex gap-3">
            {/* Product Image */}
            {product?.image_url ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                <img
                  src={product.image_url}
                  alt={item.productName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                <Package className="h-6 w-6 text-primary/50" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{item.productName}</div>
              <div className="flex items-center gap-2 mt-1">
                {item.weight && (
                  <Badge variant="secondary" className="text-xs">
                    {formatWeight(item.weight)}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  ${item.price.toFixed(2)}
                </span>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 bg-muted rounded-full p-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full"
                    onClick={() => onUpdateQuantity(item.quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full"
                    onClick={() => onUpdateQuantity(item.quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="font-bold text-primary">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Cart Step
export function CartStep({
  onNext,
  onClose,
  products,
  maxOrder,
}: {
  onNext: () => void;
  onClose: () => void;
  products?: Array<{ id: string; name: string; image_url?: string }>;
  maxOrder?: number;
}) {
  const cartItems = useMenuCartStore((state) => state.items);
  const removeItem = useMenuCartStore((state) => state.removeItem);
  const updateQuantity = useMenuCartStore((state) => state.updateQuantity);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);

  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);

  const totalAmount = getTotal();
  const totalItems = getItemCount();
  const serviceFee = totalAmount * 0.05; // 5% service fee
  const finalTotal = totalAmount + serviceFee - promoDiscount;

  const exceedsMaxOrder = maxOrder != null && maxOrder > 0 && totalItems > maxOrder;

  const handleApplyPromo = () => {
    // Mock promo code validation
    if (promoCode.toUpperCase() === 'FIRST10') {
      setPromoDiscount(totalAmount * 0.1);
      setPromoApplied(true);
      toast.success('Promo code applied! 10% off');
    } else if (promoCode.toUpperCase() === 'SAVE20') {
      setPromoDiscount(20);
      setPromoApplied(true);
      toast.success('Promo code applied! $20 off');
    } else {
      toast.error('Invalid promo code');
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <ShoppingCart className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold mb-2">Your cart is empty</h3>
        <p className="text-muted-foreground mb-6">Add some products to get started</p>
        <Button onClick={onClose} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {cartItems.map((item) => {
          const product = products?.find(p => p.id === item.productId);
          return (
            <SwipeableCartItem
              key={`${item.productId}-${item.weight}`}
              item={item}
              product={product}
              onUpdateQuantity={(qty) => {
                if (qty <= 0) {
                  removeItem(item.productId, item.weight);
                } else {
                  updateQuantity(item.productId, qty, item.weight, maxOrder);
                }
              }}
              onRemove={() => removeItem(item.productId, item.weight)}
            />
          );
        })}

        {/* Add more items button */}
        <Button
          variant="outline"
          className="w-full gap-2 border-dashed"
          onClick={onClose}
        >
          <Plus className="h-4 w-4" />
          Add More Items
        </Button>
      </div>

      {/* Fixed bottom section */}
      <div className="border-t bg-card/95 backdrop-blur-sm px-4 py-4 space-y-4">
        {/* Promo code */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="pl-10 h-11"
              disabled={promoApplied}
              aria-label="Promo code"
            />
          </div>
          <Button
            onClick={handleApplyPromo}
            disabled={!promoCode || promoApplied}
            variant={promoApplied ? "secondary" : "default"}
            className="h-11"
          >
            {promoApplied ? <Check className="h-4 w-4" /> : 'Apply'}
          </Button>
        </div>

        {/* Max order warning */}
        {exceedsMaxOrder && (
          <Alert className="border-red-500/30 bg-red-50 dark:bg-red-950/30">
            <AlertDescription className="text-red-600 dark:text-red-400 text-sm">
              Maximum {maxOrder} items per order. Please remove {totalItems - maxOrder!} item{totalItems - maxOrder! !== 1 ? 's' : ''}.
            </AlertDescription>
          </Alert>
        )}

        {/* Price breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal ({totalItems} items)</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Service fee</span>
            <span>${serviceFee.toFixed(2)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Promo discount</span>
              <span>-${promoDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">${finalTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Continue button */}
        <Button
          onClick={onNext}
          disabled={exceedsMaxOrder}
          className="w-full h-14 text-lg font-semibold gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90"
          size="lg"
        >
          Continue to Details
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
