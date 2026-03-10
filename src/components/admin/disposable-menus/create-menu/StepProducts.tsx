import { logger } from '@/lib/logger';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import type { InventoryProduct } from './types';

interface StepProductsProps {
  inventory: InventoryProduct[] | undefined;
  selectedProducts: string[];
  onSelectedProductsChange: (products: string[]) => void;
  productSearch: string;
  onProductSearchChange: (search: string) => void;
  minOrder: string;
  onMinOrderChange: (value: string) => void;
  maxOrder: string;
  onMaxOrderChange: (value: string) => void;
  bulkGenerateImages: {
    isPending: boolean;
    mutateAsync: (products: { id: string; name: string; category: string; strain_type?: string }[]) => Promise<unknown>;
  };
}

export function StepProducts({
  inventory,
  selectedProducts,
  onSelectedProductsChange,
  productSearch,
  onProductSearchChange,
  minOrder,
  onMinOrderChange,
  maxOrder,
  onMaxOrderChange,
  bulkGenerateImages,
}: StepProductsProps) {
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    if (!productSearch.trim()) return inventory;
    const query = productSearch.toLowerCase();
    return inventory.filter(
      (p) =>
        p.product_name.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.strain_type?.toLowerCase().includes(query)
    );
  }, [inventory, productSearch]);

  const toggleProduct = (productId: string) => {
    onSelectedProductsChange(
      selectedProducts.includes(productId)
        ? selectedProducts.filter((id) => id !== productId)
        : [...selectedProducts, productId]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = filteredInventory.map((p) => p.id);
    const combined = new Set([...selectedProducts, ...visibleIds]);
    onSelectedProductsChange(Array.from(combined));
  };

  const deselectAll = () => {
    onSelectedProductsChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select Products</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAllVisible}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Deselect All
          </Button>
          {inventory &&
            inventory.filter(
              (p) => !(p.image_url || p.images?.[0])
            ).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const productsWithoutImages = inventory
                      .filter((p) => !(p.image_url || p.images?.[0]))
                      .map((p) => ({
                        id: p.id,
                        name: p.product_name,
                        category: p.category?.toLowerCase() || 'flower',
                        strain_type: p.strain_type || undefined,
                      }));
                    if (productsWithoutImages.length === 0) {
                      toast.error('No products need images');
                      return;
                    }
                    toast.info(
                      `Generating images for ${productsWithoutImages.length} product(s)...`
                    );
                    await bulkGenerateImages.mutateAsync(productsWithoutImages);
                  } catch (error) {
                    logger.error('Button click error', error, {
                      component: 'StepProducts',
                    });
                    toast.error('Failed to start image generation', { description: humanizeError(error) });
                  }
                }}
                disabled={bulkGenerateImages.isPending}
              >
                {bulkGenerateImages.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Images
                  </>
                )}
              </Button>
            )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name, category, or strain..."
          aria-label="Search products"
          value={productSearch}
          onChange={(e) => onProductSearchChange(e.target.value)}
          className="pl-9"
        />
        {productSearch && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => onProductSearchChange('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="border rounded-lg divide-y max-h-[350px] overflow-y-auto">
          {filteredInventory.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No products match your search</p>
            </div>
          ) : (
            filteredInventory.map((product) => {
              const imageUrl = product.image_url || product.images?.[0];
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleProduct(product.id)}
                >
                  <Checkbox
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => toggleProduct(product.id)}
                  />
                  {imageUrl && (
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={imageUrl}
                        alt={product.product_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{product.product_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {product.category && (
                        <Badge variant="outline" className="text-xs mr-2">
                          {product.category}
                        </Badge>
                      )}
                      {String(product.quantity_lbs ?? 0)} lbs available
                      {product.base_price
                        ? ` | $${product.base_price}/lb`
                        : ''}
                    </div>
                    {!imageUrl && (
                      <Badge variant="outline" className="text-xs mt-1">
                        No image
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {selectedProducts.length} product(s) selected
          {productSearch && ` (showing ${filteredInventory.length} of ${inventory?.length ?? 0})`}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minOrder">Min Order (lbs)</Label>
          <Input
            id="minOrder"
            type="number"
            value={minOrder}
            onChange={(e) => onMinOrderChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxOrder">Max Order (lbs)</Label>
          <Input
            id="maxOrder"
            type="number"
            value={maxOrder}
            onChange={(e) => onMaxOrderChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
