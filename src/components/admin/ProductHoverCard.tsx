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
import { Package, DollarSign, TrendingUp, AlertTriangle, Tag, Layers } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

interface ProductHoverCardProps {
  product: {
    id: string;
    name: string;
    sku?: string;
    price?: number;
    cost_price?: number;
    stock_quantity?: number;
    low_stock_threshold?: number;
    category?: string;
    image_url?: string;
    description?: string;
    is_active?: boolean;
    recent_sales?: number;
    total_sold?: number;
  };
  children: React.ReactNode;
}

export function ProductHoverCard({ product, children }: ProductHoverCardProps) {
  const isLowStock = product.stock_quantity !== undefined && 
    product.low_stock_threshold !== undefined && 
    product.stock_quantity <= product.low_stock_threshold;
  
  const isOutOfStock = product.stock_quantity !== undefined && product.stock_quantity <= 0;
  
  const margin = product.price && product.cost_price 
    ? ((product.price - product.cost_price) / product.price * 100).toFixed(1)
    : null;

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
          <div className="flex gap-3">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-16 w-16 rounded-lg object-cover border bg-muted"
                loading="lazy"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold truncate">{product.name}</h4>
              {product.sku && (
                <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {product.is_active === false ? (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
                    Inactive
                  </Badge>
                ) : isOutOfStock ? (
                  <Badge variant="destructive" className="text-xs">
                    Out of Stock
                  </Badge>
                ) : isLowStock ? (
                  <Badge variant="outline" className="text-xs text-warning border-warning/50 bg-warning/10">
                    Low Stock
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-success border-success/50 bg-success/10">
                    In Stock
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {product.description}
            </p>
          )}

          {/* Category */}
          {product.category && (
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{product.category}</span>
            </div>
          )}

          {/* Stock & Price Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            {/* Stock */}
            <div className="flex items-center gap-2">
              <Layers className={cn(
                'h-4 w-4',
                isOutOfStock ? 'text-destructive' : isLowStock ? 'text-warning' : 'text-muted-foreground'
              )} />
              <div>
                <p className="text-xs text-muted-foreground">Stock</p>
                <p className={cn(
                  'text-sm font-medium',
                  isOutOfStock ? 'text-destructive' : isLowStock ? 'text-warning' : ''
                )}>
                  {product.stock_quantity ?? 'N/A'}
                  {isLowStock && !isOutOfStock && (
                    <AlertTriangle className="h-3 w-3 text-warning inline ml-1" />
                  )}
                </p>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="text-sm font-medium">
                  {product.price !== undefined ? formatCurrency(product.price) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Margin & Sales */}
          <div className="grid grid-cols-2 gap-3">
            {/* Margin */}
            {margin && (
              <div className="flex items-center gap-2">
                <TrendingUp className={cn(
                  'h-4 w-4',
                  parseFloat(margin) >= 30 ? 'text-success' : parseFloat(margin) >= 15 ? 'text-warning' : 'text-destructive'
                )} />
                <div>
                  <p className="text-xs text-muted-foreground">Margin</p>
                  <p className={cn(
                    'text-sm font-medium',
                    parseFloat(margin) >= 30 ? 'text-success' : parseFloat(margin) >= 15 ? 'text-warning' : 'text-destructive'
                  )}>
                    {margin}%
                  </p>
                </div>
              </div>
            )}

            {/* Recent Sales */}
            {product.recent_sales !== undefined && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Last 30d</p>
                  <p className="text-sm font-medium">{product.recent_sales} sold</p>
                </div>
              </div>
            )}
          </div>

          {/* Total Sold */}
          {product.total_sold !== undefined && (
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
              <span>Total sold all-time</span>
              <span className="font-medium">{product.total_sold} units</span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
