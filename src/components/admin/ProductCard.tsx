import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Trash2, 
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface ProductCardProps {
  product: any;
  onEdit?: (productId: string) => void;
  onDelete?: (productId: string) => void;
  onAddToMenu?: (productId: string) => void;
}

export function ProductCard({ 
  product, 
  onEdit, 
  onDelete,
  onAddToMenu 
}: ProductCardProps) {
  const isInStock = (product.available_quantity || 0) > 0;
  const isLowStock = isInStock && product.available_quantity < 10;
  const stockQuantity = product.available_quantity || 0;

  const profitMargin = (cost: number, price: number) => {
    if (!cost || !price) return 0;
    return (((price - cost) / price) * 100).toFixed(1);
  };

  const margin = profitMargin(product.cost_per_unit, product.wholesale_price);

  return (
    <Card 
      className="bg-white border-[hsl(var(--tenant-border))] hover:shadow-lg transition-all duration-300 overflow-hidden group hover:scale-[1.02] hover:border-[hsl(var(--tenant-primary))]/30"
    >
      {/* Product Image */}
      {product.image_url ? (
        <div className="relative aspect-square overflow-hidden bg-[hsl(var(--tenant-surface))]">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          {product.category && (
            <Badge className="absolute top-3 right-3 bg-white/95 text-[hsl(var(--tenant-primary))] border-0 shadow-md backdrop-blur-sm">
              {product.category}
            </Badge>
          )}
          {!isInStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="outline" className="bg-red-500 text-white border-0">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="relative aspect-square bg-gradient-to-br from-[hsl(var(--tenant-surface))] to-[hsl(var(--tenant-surface))]/50 flex items-center justify-center">
          <Package className="h-16 w-16 text-[hsl(var(--tenant-text-light))]" />
          {!isInStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="outline" className="bg-red-500 text-white border-0">
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
            <h3 className="font-bold text-lg text-[hsl(var(--tenant-text))] group-hover:text-[hsl(var(--tenant-primary))] transition-colors mb-1">
              {product.name}
            </h3>
            {product.strain_name && (
              <p className="text-sm text-[hsl(var(--tenant-text-light))] mb-2">
                {product.strain_name}
              </p>
            )}
            {product.sku && (
              <code className="text-xs text-[hsl(var(--tenant-text-light))] bg-[hsl(var(--tenant-surface))] px-2 py-1 rounded">
                {product.sku}
              </code>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-[hsl(var(--tenant-text-light))] hover:text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]"
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
              {onAddToMenu && (
                <DropdownMenuItem onClick={() => onAddToMenu(product.id)}>
                  <Package className="h-4 w-4 mr-2" />
                  Add to Menu
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(product.id)}
                  className="text-red-600 focus:text-red-600"
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
              {formatCurrency(product.wholesale_price || 0)}
            </span>
          </div>
          {product.cost_per_unit && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--tenant-text-light))]">Cost</span>
              <span className="text-[hsl(var(--tenant-text-light))]">
                {formatCurrency(product.cost_per_unit)}
              </span>
            </div>
          )}
          {margin && Number(margin) > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--tenant-text-light))]">Margin</span>
              <span className="text-green-600 font-semibold flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {margin}%
              </span>
            </div>
          )}
        </div>

        {/* Stock Status */}
        <div className="flex items-center justify-between p-3 bg-[hsl(var(--tenant-surface))] rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[hsl(var(--tenant-text-light))]" />
            <span className="text-sm font-medium text-[hsl(var(--tenant-text))]">
              Stock: {stockQuantity} units
            </span>
          </div>
          {isLowStock && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Low Stock
            </Badge>
          )}
          {!isInStock && (
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
              Out of Stock
            </Badge>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(product.id)}
              className="flex-1 border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-surface))]"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {onAddToMenu && (
            <Button
              size="sm"
              onClick={() => onAddToMenu(product.id)}
              className="flex-1 bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white"
            >
              <Package className="h-4 w-4 mr-2" />
              Menu
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
