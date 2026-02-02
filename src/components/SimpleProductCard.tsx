import { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle } from 'lucide-react';
import ProductImage from '@/components/ProductImage';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cleanProductName } from '@/utils/productName';

export interface SimpleProductCardProduct {
  id: string;
  name: string;
  image_url?: string | null;
  price?: number | string | null;
  stock_quantity?: number | null;
  in_stock?: boolean | null;
  category?: string | null;
}

export interface SimpleProductCardProps {
  product: SimpleProductCardProduct;
  onClick?: (product: SimpleProductCardProduct) => void;
  className?: string;
  showCategory?: boolean;
}

/**
 * SimpleProductCard - A lightweight, reusable product card component
 * Displays: product image, name, price, and stock badge
 * Use this for grids, lists, or anywhere a compact product display is needed
 */
export const SimpleProductCard = memo(function SimpleProductCard({
  product,
  onClick,
  className,
  showCategory = false,
}: SimpleProductCardProps) {
  const cleanedName = cleanProductName(product.name);

  // Determine stock status
  const stockQuantity = product.stock_quantity ?? 0;
  const isOutOfStock = product.in_stock === false || stockQuantity <= 0;
  const isLowStock = !isOutOfStock && stockQuantity > 0 && stockQuantity <= 5;

  // Parse price value
  const priceValue = typeof product.price === 'string'
    ? parseFloat(product.price)
    : product.price ?? 0;

  // Memoize formatted currency value
  const formattedPrice = useMemo(() => formatCurrency(priceValue), [priceValue]);

  const handleClick = () => {
    if (onClick) {
      onClick(product);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      onClick(product);
    }
  };

  return (
    <Card
      className={cn(
        'group overflow-hidden transition-all duration-300 cursor-pointer',
        'border border-border/50 hover:border-border',
        'hover:shadow-lg hover:-translate-y-1',
        isOutOfStock && 'opacity-75',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={`${cleanedName} - ${formattedPrice}`}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        <ProductImage
          src={product.image_url}
          alt={cleanedName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Stock Badge - Top Right */}
        <div className="absolute top-3 right-3 z-10">
          {isOutOfStock ? (
            <Badge
              variant="destructive"
              className="flex items-center gap-1 shadow-md"
            >
              <Package className="h-3 w-3" aria-hidden="true" />
              Out of Stock
            </Badge>
          ) : isLowStock ? (
            <Badge
              className="flex items-center gap-1 shadow-md bg-orange-500 text-white hover:bg-orange-600"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Only {stockQuantity} left
            </Badge>
          ) : (
            <Badge
              className="flex items-center gap-1 shadow-md bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <Package className="h-3 w-3" aria-hidden="true" />
              In Stock
            </Badge>
          )}
        </div>

        {/* Category Badge - Top Left */}
        {showCategory && product.category && (
          <div className="absolute top-3 left-3 z-10">
            <Badge
              variant="secondary"
              className="uppercase text-xs font-semibold shadow-md"
            >
              {product.category}
            </Badge>
          </div>
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-neutral-900 text-white px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg shadow-xl transform -rotate-3">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-2">
        {/* Product Name */}
        <h3
          className="font-semibold text-base leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors"
          title={cleanedName}
        >
          {cleanedName}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-primary">
            {formattedPrice}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

SimpleProductCard.displayName = 'SimpleProductCard';
