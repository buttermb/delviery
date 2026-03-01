/**
 * Mobile Fixed Add to Cart Bar
 * Always-visible bottom bar on mobile product detail pages
 * Positioned above the MobileBottomNav (z-40 vs z-50)
 */

import { Minus, Plus, ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

interface MobileFixedAddToCartProps {
  product: {
    name: string;
    display_price: number;
    in_stock: boolean;
    image_url?: string | null;
  };
  quantity: number;
  onQuantityChange: (qty: number) => void;
  maxQuantity: number;
  onAddToCart: () => void;
  isAddingToCart: boolean;
  primaryColor: string;
}

export function MobileFixedAddToCart({
  product,
  quantity,
  onQuantityChange,
  maxQuantity,
  onAddToCart,
  isAddingToCart,
  primaryColor,
}: MobileFixedAddToCartProps) {
  return (
    <div
      className="sm:hidden fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Price */}
        <div className="flex-shrink-0">
          <span className="text-lg font-bold" style={{ color: primaryColor }}>
            {formatCurrency(product.display_price * quantity)}
          </span>
        </div>

        {/* Quantity selector */}
        <div className="flex items-center border rounded-xl bg-muted/50 flex-shrink-0">
          <button
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            disabled={quantity <= 1 || !product.in_stock}
            aria-label="Decrease quantity"
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-l-xl transition-colors active:scale-95',
              (quantity <= 1 || !product.in_stock) && 'opacity-30 cursor-not-allowed'
            )}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">
            {quantity}
          </span>
          <button
            onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
            disabled={quantity >= maxQuantity || !product.in_stock}
            aria-label="Increase quantity"
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-r-xl transition-colors active:scale-95',
              (quantity >= maxQuantity || !product.in_stock) && 'opacity-30 cursor-not-allowed'
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Add to Cart button */}
        <Button
          className="flex-1 h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
          style={{ backgroundColor: product.in_stock ? primaryColor : undefined }}
          disabled={!product.in_stock || isAddingToCart}
          onClick={onAddToCart}
        >
          {isAddingToCart ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              Adding...
            </>
          ) : product.in_stock ? (
            <>
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              Add to Bag
            </>
          ) : (
            'Out of Stock'
          )}
        </Button>
      </div>
    </div>
  );
}
