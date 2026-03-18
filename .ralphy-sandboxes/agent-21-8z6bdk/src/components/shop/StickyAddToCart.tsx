/**
 * Sticky Add to Cart Bar
 * Mobile-friendly sticky bar at bottom of product pages
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Minus, Plus, Check, Heart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

interface StickyAddToCartProps {
  product: {
    product_id: string;
    name: string;
    display_price: number;
    compare_at_price?: number | null;
    in_stock: boolean;
    image_url?: string | null;
  };
  primaryColor: string;
  onAddToCart: (quantity: number) => void;
  onToggleWishlist: () => void;
  isWishlisted: boolean;
  isVisible?: boolean;
}

export function StickyAddToCart({
  product,
  primaryColor,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
  isVisible = true,
}: StickyAddToCartProps) {
  const [quantity, setQuantity] = useState(1);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Show bar only after scrolling past the main add-to-cart button
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAddToCart = () => {
    onAddToCart(quantity);
    setShowAddedFeedback(true);
    setTimeout(() => {
      setShowAddedFeedback(false);
      setQuantity(1);
    }, 1500);
  };

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.display_price;

  if (!isVisible || !isScrolled) return null;

  return (
    <div className="md:hidden fixed bottom-16 left-0 right-0 bg-white dark:bg-zinc-950 border-t shadow-lg z-sticky safe-area-pb">
      <div className="flex items-center gap-3 p-3">
        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{product.name}</p>
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: primaryColor }}>
              {formatCurrency(product.display_price)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatCurrency(product.compare_at_price!)}
              </span>
            )}
          </div>
        </div>

        {/* Quantity Selector (Compact) */}
        <div className="flex items-center border rounded-lg">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-r-none"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || !product.in_stock}
            aria-label="Decrease quantity"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="w-8 text-center text-sm font-medium">{quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-l-none"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            disabled={!product.in_stock}
            aria-label="Increase quantity"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Wishlist Button */}
        <Button
          variant="outline"
          size="icon"
          className={cn('h-11 w-11', isWishlisted && 'text-red-500 border-red-200')}
          onClick={onToggleWishlist}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={cn('w-4 h-4', isWishlisted && 'fill-red-500')} />
        </Button>

        {/* Add to Cart Button */}
        <Button
          className="h-10 px-4"
          style={{ backgroundColor: primaryColor }}
          disabled={!product.in_stock || showAddedFeedback}
          onClick={handleAddToCart}
        >
          {showAddedFeedback ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              Added
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4 mr-1" />
              Add
            </>
          )}
        </Button>
      </div>

      {/* Out of Stock Overlay */}
      {!product.in_stock && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <Badge variant="secondary">Out of Stock</Badge>
        </div>
      )}
    </div>
  );
}

export default StickyAddToCart;


