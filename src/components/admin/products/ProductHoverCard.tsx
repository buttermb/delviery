/**
 * Product Hover Card
 * Quick preview of product details on hover
 */

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Package, DollarSign, Boxes, Tag, Beaker } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

interface ProductHoverCardProps {
  product: {
    id: string;
    name: string;
    sku?: string | null;
    category?: string | null;
    image_url?: string | null;
    wholesale_price?: number | null;
    retail_price?: number | null;
    available_quantity?: number | null;
    strain_type?: string | null;
    thc_percent?: number | null;
    cbd_percent?: number | null;
  };
  children: React.ReactNode;
}

export function ProductHoverCard({ product, children }: ProductHoverCardProps) {
  const isLowStock = (product.available_quantity ?? 0) <= 10;
  const isOutOfStock = (product.available_quantity ?? 0) === 0;

  return (
    <HoverCard openDelay={400}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer inline-block">
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-3">
          {/* Header with image */}
          <div className="flex items-start gap-3">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-16 w-16 rounded-lg object-cover border flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold truncate">{product.name}</h4>
              {product.sku && (
                <p className="text-xs text-muted-foreground font-mono">
                  SKU: {product.sku}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {product.category && (
                  <Badge variant="outline" className="capitalize text-xs">
                    {product.category}
                  </Badge>
                )}
                {product.strain_type && (
                  <Badge variant="secondary" className="capitalize text-xs">
                    {product.strain_type}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-2 border-t pt-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" />
                Wholesale
              </div>
              <p className="font-semibold text-sm">
                {product.wholesale_price
                  ? formatCurrency(product.wholesale_price)
                  : '—'}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Tag className="h-3 w-3" />
                Retail
              </div>
              <p className="font-semibold text-sm">
                {product.retail_price ? formatCurrency(product.retail_price) : '—'}
              </p>
            </div>
          </div>

          {/* Potency (Cannabis-specific) */}
          {(product.thc_percent !== null || product.cbd_percent !== null) && (
            <div className="border-t pt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Beaker className="h-3 w-3" />
                Potency
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {product.thc_percent !== null && (
                  <div>
                    <span className="text-muted-foreground">THC:</span>{' '}
                    <span className="font-medium">{product.thc_percent}%</span>
                  </div>
                )}
                {product.cbd_percent !== null && (
                  <div>
                    <span className="text-muted-foreground">CBD:</span>{' '}
                    <span className="font-medium">{product.cbd_percent}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stock Status */}
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Stock</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-sm font-semibold',
                  isOutOfStock
                    ? 'text-destructive'
                    : isLowStock
                      ? 'text-amber-600'
                      : 'text-foreground'
                )}
              >
                {product.available_quantity ?? 0}
              </span>
              {isOutOfStock ? (
                <Badge variant="destructive" className="text-xs">
                  Out of Stock
                </Badge>
              ) : isLowStock ? (
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-600 text-xs"
                >
                  Low Stock
                </Badge>
              ) : (
                <Badge variant="default" className="text-xs">
                  In Stock
                </Badge>
              )}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
