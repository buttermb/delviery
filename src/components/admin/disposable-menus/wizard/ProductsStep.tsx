import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { InventoryProduct } from '@/components/admin/disposable-menus/wizard/types';

import { Search, X, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductsStepProps {
  isForumMenu: boolean;
  selectedProducts: string[];
  onToggleProduct: (productId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filteredProducts: InventoryProduct[];
  inventoryLoading: boolean;
  minOrder: string;
  onMinOrderChange: (value: string) => void;
  maxOrder: string;
  onMaxOrderChange: (value: string) => void;
}

export const ProductsStep = ({
  isForumMenu,
  selectedProducts,
  onToggleProduct,
  searchQuery,
  onSearchQueryChange,
  filteredProducts,
  inventoryLoading,
  minOrder,
  onMinOrderChange,
  maxOrder,
  onMaxOrderChange,
}: ProductsStepProps) => {
  if (isForumMenu) {
    return <ForumMenuInfo />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select Products</h3>
        <Badge variant="secondary">
          {selectedProducts.length} selected
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name, strain, category, or brand..."
          aria-label="Search products"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="pl-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => onSearchQueryChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Product List */}
      {inventoryLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="border rounded-lg max-h-[400px] overflow-y-auto">
          <div className="grid gap-2 p-4">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No products found' : 'No products available'}
              </div>
            ) : (
              filteredProducts.map((product: InventoryProduct) => {
                const isSelected = selectedProducts.includes(product.id);

                return (
                  <div
                    key={product.id}
                    className={cn(
                      'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                      isSelected && 'bg-primary/5 border-primary'
                    )}
                    onClick={() => onToggleProduct(product.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleProduct(product.id)}
                      className="mt-1"
                    />
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {product.sku && <Badge variant="outline">{product.sku}</Badge>}
                        {product.category && <Badge variant="outline">{product.category}</Badge>}
                        <span className="text-primary font-medium">${product.price}</span>
                        {product.stock_quantity !== undefined && (
                          <span className="text-xs">Stock: {product.stock_quantity}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Order Limits */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div className="space-y-2">
          <Label htmlFor="minOrder">Min Order (lbs)</Label>
          <Input
            id="minOrder"
            type="number"
            min="0"
            value={minOrder}
            onChange={(e) => onMinOrderChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxOrder">Max Order (lbs)</Label>
          <Input
            id="maxOrder"
            type="number"
            min="0"
            value={maxOrder}
            onChange={(e) => onMaxOrderChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

/** Forum menu variant shown in place of the product selector. */
const ForumMenuInfo = () => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="h-6 w-6 text-green-600 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Forum Menu</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This menu will redirect customers to the community forum where they can:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground mb-4">
              <li>Browse and discuss products</li>
              <li>Share reviews and experiences</li>
              <li>Ask questions and get answers</li>
              <li>Connect with other customers</li>
            </ul>
            <div className="rounded-md bg-primary/10 p-3">
              <p className="text-sm font-medium">
                Customers will be redirected to: <code className="text-xs bg-background px-2 py-1 rounded">/community</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
