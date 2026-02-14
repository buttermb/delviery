/**
 * ProductQuickViewModal - Quick view dialog for product details
 * Shows key product information: image, pricing, stock, category, and description
 */

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  DollarSign,
  Layers,
  Tag,
  AlertTriangle,
  Leaf,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { QuickViewModal } from './QuickViewModal';

interface ProductQuickViewData {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  cost_per_unit?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  category?: string | null;
  image_url?: string | null;
  description?: string | null;
  in_stock?: boolean;
  thc_percent?: number | null;
  cbd_percent?: number | null;
  strain_name?: string | null;
  brand?: string | null;
}

interface ProductQuickViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductQuickViewData | null;
  onViewFullDetails?: () => void;
}

export function ProductQuickViewModal({
  open,
  onOpenChange,
  product,
  onViewFullDetails,
}: ProductQuickViewModalProps) {
  if (!product) return null;

  const isLowStock =
    product.stock_quantity !== undefined &&
    product.low_stock_threshold !== undefined &&
    product.stock_quantity <= product.low_stock_threshold;

  const isOutOfStock =
    product.in_stock === false ||
    (product.stock_quantity !== undefined && product.stock_quantity <= 0);

  const margin =
    product.price && product.cost_per_unit
      ? (((product.price - product.cost_per_unit) / product.price) * 100).toFixed(1)
      : null;

  return (
    <QuickViewModal
      open={open}
      onOpenChange={onOpenChange}
      title={product.name}
      description={product.sku ? `SKU: ${product.sku}` : undefined}
      onViewFullDetails={onViewFullDetails}
    >
      {/* Product Image & Status */}
      <div className="flex gap-4">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-20 w-20 rounded-lg object-cover border bg-muted flex-shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Stock Status Badge */}
          <div>
            {isOutOfStock ? (
              <Badge variant="destructive" className="text-xs">
                Out of Stock
              </Badge>
            ) : isLowStock ? (
              <Badge variant="outline" className="text-xs text-warning border-warning/50 bg-warning/10">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Low Stock
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-success border-success/50 bg-success/10">
                In Stock
              </Badge>
            )}
          </div>

          {/* Brand */}
          {product.brand && (
            <p className="text-xs text-muted-foreground truncate">
              Brand: <span className="font-medium">{product.brand}</span>
            </p>
          )}

          {/* Category */}
          {product.category && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="h-3 w-3" />
              <span>{product.category}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>
      )}

      <Separator />

      {/* Price & Stock Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-sm font-semibold">
              {product.price !== undefined ? formatCurrency(product.price) : 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers className={cn(
            'h-4 w-4',
            isOutOfStock ? 'text-destructive' : isLowStock ? 'text-warning' : 'text-muted-foreground'
          )} />
          <div>
            <p className="text-xs text-muted-foreground">Stock</p>
            <p className={cn(
              'text-sm font-semibold',
              isOutOfStock ? 'text-destructive' : isLowStock ? 'text-warning' : ''
            )}>
              {product.stock_quantity ?? 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Margin & Cost */}
      {(product.cost_per_unit !== undefined || margin) && (
        <div className="grid grid-cols-2 gap-3">
          {product.cost_per_unit !== undefined && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Cost</p>
                <p className="text-sm font-medium">
                  {formatCurrency(product.cost_per_unit)}
                </p>
              </div>
            </div>
          )}
          {margin && (
            <div>
              <p className="text-xs text-muted-foreground">Margin</p>
              <p className={cn(
                'text-sm font-semibold',
                parseFloat(margin) >= 30 ? 'text-success' : parseFloat(margin) >= 15 ? 'text-warning' : 'text-destructive'
              )}>
                {margin}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cannabis-Specific Info */}
      {(product.thc_percent != null || product.cbd_percent != null || product.strain_name) && (
        <>
          <Separator />
          <div className="space-y-2">
            {product.strain_name && (
              <div className="flex items-center gap-2 text-sm">
                <Leaf className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Strain:</span>
                <span className="font-medium">{product.strain_name}</span>
              </div>
            )}
            <div className="flex gap-4">
              {product.thc_percent != null && (
                <div>
                  <p className="text-xs text-muted-foreground">THC</p>
                  <p className="text-sm font-semibold">{product.thc_percent}%</p>
                </div>
              )}
              {product.cbd_percent != null && (
                <div>
                  <p className="text-xs text-muted-foreground">CBD</p>
                  <p className="text-sm font-semibold">{product.cbd_percent}%</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </QuickViewModal>
  );
}
