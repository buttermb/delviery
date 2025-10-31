import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface StickyAddToCartProps {
  productName: string;
  price: number;
  quantity: number;
  onQuantityChange: (newQuantity: number) => void;
  onAddToCart: () => void;
  loading?: boolean;
  added?: boolean;
  className?: string;
}

const StickyAddToCart = ({
  productName,
  price,
  quantity,
  onQuantityChange,
  onAddToCart,
  loading = false,
  added = false,
  className
}: StickyAddToCartProps) => {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <div className={cn(
      "fixed bottom-16 left-0 right-0 z-40 bg-background border-t border-border shadow-2xl",
      "safe-area-bottom",
      className
    )}>
      <div className="container px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{productName}</p>
            <p className="text-lg font-bold text-primary">${(price * quantity).toFixed(2)}</p>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-8 text-center font-semibold">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onQuantityChange(quantity + 1)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Add to Cart Button */}
          <Button
            variant={added ? "outline" : "hero"}
            size="lg"
            onClick={onAddToCart}
            disabled={loading || added}
            className="min-w-[120px] h-12"
          >
            {loading ? (
              "Adding..."
            ) : added ? (
              <>
                <span className="mr-2">✓</span>
                Added
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StickyAddToCart;
