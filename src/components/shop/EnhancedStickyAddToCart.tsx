/**
 * Enhanced Mobile Sticky Add to Cart Bar
 * Shows after scrolling with stock warnings and touch-optimized controls
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Minus, Plus, Check, Heart, AlertTriangle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { useInventoryCheck } from '@/hooks/useInventoryCheck';

interface EnhancedStickyAddToCartProps {
  product: {
    product_id: string;
    name: string;
    display_price: number;
    compare_at_price?: number | null;
    in_stock: boolean;
    image_url?: string | null;
  };
  primaryColor: string;
  onAddToCart: (quantity: number) => Promise<void> | void;
  onToggleWishlist: () => void;
  isWishlisted: boolean;
  isVisible?: boolean;
  maxQuantity?: number;
}

export function EnhancedStickyAddToCart({
  product,
  primaryColor,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
  isVisible = true,
  maxQuantity = 99,
}: EnhancedStickyAddToCartProps) {
  const [quantity, setQuantity] = useState(1);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [stockStatus, setStockStatus] = useState<{ available: number; isLowStock: boolean } | null>(null);
  
  const { checkProductStock } = useInventoryCheck();

  // Check stock on mount (use quantity=1 to get total availability)
  useEffect(() => {
    const checkStock = async () => {
      const status = await checkProductStock(product.product_id, 1);
      if (status) {
        setStockStatus({
          available: status.available,
          isLowStock: status.isLowStock,
        });
      }
    };
    checkStock();
  }, [product.product_id, checkProductStock]);

  // Show bar only after scrolling past the main add-to-cart button
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle quantity change with haptic feedback simulation
  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity((prev) => {
      const max = stockStatus ? Math.min(stockStatus.available, maxQuantity) : maxQuantity;
      return Math.max(1, Math.min(max, prev + delta));
    });
    
    // Trigger vibration if available (mobile)
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [stockStatus, maxQuantity]);

  const handleAddToCart = async () => {
    // Check stock first
    const currentStock = await checkProductStock(product.product_id, quantity);
    
    if (!currentStock?.isAvailable) {
      return; // Stock warning will be shown
    }

    setIsAdding(true);
    
    try {
      await onAddToCart(quantity);
      setShowAddedFeedback(true);
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
      
      setTimeout(() => {
        setShowAddedFeedback(false);
        setQuantity(1);
      }, 1500);
    } finally {
      setIsAdding(false);
    }
  };

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.display_price;
  const effectiveMax = stockStatus ? Math.min(stockStatus.available, maxQuantity) : maxQuantity;
  const isOutOfStock = !product.in_stock || (stockStatus && stockStatus.available <= 0);
  const isLowStock = stockStatus?.isLowStock && !isOutOfStock;
  const insufficientStock = stockStatus && quantity > stockStatus.available;

  if (!isVisible || !isScrolled) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-lg z-50 safe-area-pb">
      {/* Low Stock Warning Bar */}
      {isLowStock && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-sm text-amber-700 font-medium">
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-1.5 flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          <span className="text-xs text-warning font-medium">
            Only {stockStatus?.available} left in stock
          </span>
        </div>
      )}
      
      <div className="flex items-center gap-3 p-3">
        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{product.name}</p>
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: primaryColor }}>
              {formatCurrency(product.display_price * quantity)}
            </span>
            {hasDiscount && quantity === 1 && (
              <span className="text-sm text-muted-foreground line-through">
                {formatCurrency(product.compare_at_price!)}
              </span>
            )}
          </div>
        </div>

        {/* Touch-optimized Quantity Selector */}
        <div className="flex items-center border rounded-xl bg-muted/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-l-xl rounded-r-none active:scale-95 transition-transform"
            onClick={() => handleQuantityChange(-1)}
            disabled={quantity <= 1 || isOutOfStock}
            aria-label="Decrease quantity"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-r-xl rounded-l-none active:scale-95 transition-transform"
            onClick={() => handleQuantityChange(1)}
            disabled={quantity >= effectiveMax || isOutOfStock}
            aria-label="Increase quantity"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Wishlist Button */}
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'h-10 w-10 rounded-xl active:scale-95 transition-transform',
            isWishlisted && 'text-destructive border-destructive/20 bg-destructive/10'
          )}
          onClick={onToggleWishlist}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={cn('w-4 h-4', isWishlisted && 'fill-destructive')} />
        </Button>

        {/* Add to Cart Button */}
        <Button
          className="h-10 px-5 rounded-xl active:scale-95 transition-transform"
          style={{ backgroundColor: primaryColor }}
          disabled={isOutOfStock || showAddedFeedback || isAdding || insufficientStock}
          onClick={handleAddToCart}
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : showAddedFeedback ? (
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
      {isOutOfStock && (
        <div className="absolute inset-0 bg-background/90 flex items-center justify-center">
          <Badge variant="secondary" className="text-sm py-1.5 px-3">
            Out of Stock
          </Badge>
        </div>
      )}
    </div>
  );
}

export default EnhancedStickyAddToCart;
