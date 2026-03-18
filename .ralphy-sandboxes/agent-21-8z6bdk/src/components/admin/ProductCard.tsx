import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Copy,
  Edit,
  Trash2,
  Package,
  TrendingUp,
  Eye,
  EyeOff,
} from "lucide-react";
import { InventoryStatusBadge } from "@/components/admin/InventoryStatusBadge";
import { InlineEditableCell } from "@/components/admin/products/InlineEditableCell";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Printer, Store } from "lucide-react";
import { useProductThumbnail } from "@/hooks/useOptimizedImage";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import LongPressMenu from "@/components/mobile/LongPressMenu";
import { TruncatedText } from "@/components/shared/TruncatedText";

interface Product {
  id: string;
  name: string;
  category?: string;
  price?: number;
  stock_quantity?: number;
  available_quantity?: number;
  in_stock?: boolean;
  image_url?: string;
  sku?: string;
  low_stock_alert?: number;
  strain_name?: string;
  cost_per_unit?: number;
  wholesale_price?: number;
  menu_visibility?: boolean;
}

interface ProductCardProps {
  product: Product;
  onEdit?: (productId: string) => void;
  onDelete?: (productId: string) => void;
  onAddToMenu?: (productId: string) => void;
  onPrintLabel?: () => void;
  onPublish?: (productId: string) => void;
  onDuplicate?: (productId: string) => void;
  onToggleStorefrontVisibility?: (productId: string) => void;
  isTogglingVisibility?: boolean;
  onStockUpdate?: (newValue: string) => Promise<void>;
}

export function ProductCard({
  product,
  onEdit,
  onDelete,
  onAddToMenu,
  onPrintLabel,
  onPublish,
  onDuplicate,
  onToggleStorefrontVisibility,
  isTogglingVisibility,
  onStockUpdate,
}: ProductCardProps) {
  const availableQty = Number(product.available_quantity || 0);
  const isInStock = availableQty > 0;
  const reorderPoint = typeof product.low_stock_alert === 'number' ? product.low_stock_alert : 10;
  const stockQuantity = availableQty;

  // Optimized image for mobile performance
  const { src: optimizedImageSrc, srcSet } = useProductThumbnail(product.image_url);

  const profitMargin = (cost: number, price: number) => {
    if (!cost || !price) return 0;
    return (((price - cost) / price) * 100).toFixed(1);
  };

  const costPerUnit = Number(product.cost_per_unit || 0);
  const wholesalePrice = Number(product.wholesale_price || 0);
  const margin = profitMargin(costPerUnit, wholesalePrice);

  // Build long-press menu items for mobile
  const longPressItems = [
    ...(onEdit ? [{ label: 'Edit', icon: <Edit className="h-4 w-4" />, onSelect: () => onEdit(product.id) }] : []),
    ...(onDuplicate ? [{ label: 'Duplicate', icon: <Copy className="h-4 w-4" />, onSelect: () => onDuplicate(product.id) }] : []),
    ...(onAddToMenu ? [{ label: 'Add to Menu', icon: <Package className="h-4 w-4" />, onSelect: () => onAddToMenu(product.id) }] : []),
    ...(onPrintLabel && product.sku ? [{ label: 'Print Label', icon: <Printer className="h-4 w-4" />, onSelect: onPrintLabel }] : []),
    ...(onPublish ? [{ label: 'Publish to Store', icon: <Store className="h-4 w-4" />, onSelect: () => onPublish(product.id) }] : []),
    ...(onDelete ? [{ label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onSelect: () => onDelete(product.id), destructive: true }] : []),
  ];

  const cardContent = (
    <Card
      className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] hover:shadow-lg transition-all duration-300 overflow-hidden group hover:scale-[1.02] hover:border-[hsl(var(--tenant-primary))]/30"
    >
      {/* Product Image */}
      {product.image_url ? (
        <div className="relative aspect-square overflow-hidden bg-[hsl(var(--tenant-surface))]">
          <OptimizedImage
            src={optimizedImageSrc || product.image_url}
            srcSet={srcSet}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          {product.category && (
            <Badge className="absolute top-3 right-3 bg-[hsl(var(--tenant-bg))]/95 text-[hsl(var(--tenant-primary))] border-0 shadow-md backdrop-blur-sm max-w-[140px]">
              <TruncatedText text={product.category ?? ''} maxWidthClass="max-w-[120px]" />
            </Badge>
          )}
          {!isInStock && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <Badge variant="destructive">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="relative aspect-square bg-gradient-to-br from-[hsl(var(--tenant-surface))] to-[hsl(var(--tenant-surface))]/50 flex items-center justify-center">
          <Package className="h-16 w-16 text-[hsl(var(--tenant-text-light))]" />
          {!isInStock && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <Badge variant="destructive">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>
      )}

      <CardContent className="p-5">
        {/* Header with Actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <TruncatedText
              text={String(product.name || '')}
              className="font-bold text-lg text-[hsl(var(--tenant-text))] group-hover:text-[hsl(var(--tenant-primary))] transition-colors mb-1"
              as="p"
            />
            {product.strain_name && (
              <TruncatedText
                text={String(product.strain_name)}
                className="text-sm text-[hsl(var(--tenant-text-light))] mb-2"
                as="p"
              />
            )}
            {product.sku && (
              <TruncatedText
                text={String(product.sku)}
                className="text-xs text-[hsl(var(--tenant-text-light))] bg-[hsl(var(--tenant-surface))] px-2 py-1 rounded font-mono"
                maxWidthClass="max-w-[160px]"
              />
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="text-[hsl(var(--tenant-text-light))] hover:text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))] transition-colors duration-200"
                aria-label={`More actions for ${product.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(product.id)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(product.id)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
              )}
              {onAddToMenu && (
                <DropdownMenuItem onClick={() => onAddToMenu(product.id)}>
                  <Package className="h-4 w-4 mr-2" />
                  Add to Menu
                </DropdownMenuItem>
              )}
              {onPrintLabel && product.sku && (
                <DropdownMenuItem onClick={onPrintLabel}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Label
                </DropdownMenuItem>
              )}
              {onPublish && (
                <DropdownMenuItem onClick={() => onPublish(product.id)}>
                  <Store className="h-4 w-4 mr-2" />
                  Publish to Store
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(product.id)}
                  className="text-destructive focus-visible:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Pricing */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--tenant-text-light))]">Wholesale Price</span>
            <span className="text-lg font-bold text-[hsl(var(--tenant-primary))]">
              {formatCurrency(wholesalePrice)}
            </span>
          </div>
          {costPerUnit > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--tenant-text-light))]">Cost</span>
              <span className="text-[hsl(var(--tenant-text-light))]">
                {formatCurrency(costPerUnit)}
              </span>
            </div>
          )}
          {margin && Number(margin) > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--tenant-text-light))]">Margin</span>
              <span className="text-success font-semibold flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {margin}%
              </span>
            </div>
          )}
        </div>

        {/* Stock Status */}
        <div className="flex items-center justify-between p-3 bg-[hsl(var(--tenant-surface))] rounded-lg mb-2 transition-colors duration-200 group-hover:bg-[hsl(var(--tenant-surface))]/80">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[hsl(var(--tenant-text-light))]" />
            {onStockUpdate ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-sm text-[hsl(var(--tenant-text-light))]">Stock:</span>
                <InlineEditableCell
                  value={stockQuantity}
                  onSave={onStockUpdate}
                  type="number"
                  className="w-14"
                  valueClassName={
                    stockQuantity <= 0
                      ? "text-destructive font-bold"
                      : stockQuantity <= reorderPoint
                        ? "text-warning font-semibold"
                        : "text-success font-semibold"
                  }
                />
              </div>
            ) : (
              <span className={`text-sm font-semibold ${
                stockQuantity <= 0
                  ? "text-destructive"
                  : stockQuantity <= reorderPoint
                    ? "text-warning"
                    : "text-success"
              }`}>
                Stock: {String(stockQuantity)} units
              </span>
            )}
          </div>
          <InventoryStatusBadge
            quantity={stockQuantity}
            lowStockThreshold={reorderPoint}
          />
        </div>

        {/* Storefront Visibility Toggle */}
        {onToggleStorefrontVisibility && (
          <div
            className="flex items-center justify-between p-3 bg-[hsl(var(--tenant-surface))] rounded-lg mb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-[hsl(var(--tenant-text-light))]" />
              <span className="text-sm text-[hsl(var(--tenant-text))]">Storefront</span>
            </div>
            <Switch
              checked={product.menu_visibility === true}
              disabled={isTogglingVisibility}
              onCheckedChange={() => onToggleStorefrontVisibility(product.id)}
              aria-label={`Toggle storefront visibility for ${product.name}`}
            />
          </div>
        )}
        {/* Storefront Visibility */}
        <div className="flex items-center justify-between p-3 bg-[hsl(var(--tenant-surface))] rounded-lg mb-4 transition-colors duration-200 group-hover:bg-[hsl(var(--tenant-surface))]/80">
          <div className="flex items-center gap-2">
            {product.menu_visibility ? (
              <Eye className="h-4 w-4 text-green-500" />
            ) : (
              <EyeOff className="h-4 w-4 text-[hsl(var(--tenant-text-light))]" />
            )}
            <span className="text-sm font-medium text-[hsl(var(--tenant-text))]">
              Storefront
            </span>
          </div>
          <Badge
            variant="outline"
            className={product.menu_visibility
              ? "text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-700 dark:bg-green-950"
              : "text-muted-foreground border-muted bg-muted/30"
            }
          >
            {product.menu_visibility ? 'Listed' : 'Unlisted'}
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(product.id)}
              className="flex-1 border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-surface))] transition-all duration-200 hover:shadow-sm"
              aria-label={`Edit ${product.name}`}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {onAddToMenu && (
            <Button
              size="sm"
              onClick={() => onAddToMenu(product.id)}
              className="flex-1 bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white transition-all duration-200 hover:shadow-sm"
              aria-label={`Add ${product.name} to menu`}
            >
              <Package className="h-4 w-4 mr-2" />
              Menu
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Wrap with LongPressMenu for mobile context actions
  if (longPressItems.length > 0) {
    return (
      <LongPressMenu items={longPressItems}>
        {cardContent}
      </LongPressMenu>
    );
  }

  return cardContent;
}
