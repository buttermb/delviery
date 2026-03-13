/**
 * MenuBulkItemAdd Component
 * Task 284: Create menu bulk item add
 *
 * Allows adding multiple menu items at once with category filtering and selection
 */

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Search from 'lucide-react/dist/esm/icons/search';
import Package from 'lucide-react/dist/esm/icons/package';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Check from 'lucide-react/dist/esm/icons/check';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

interface Product {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  image_url?: string | null;
  description?: string | null;
  stock_quantity?: number;
}

interface MenuBulkItemAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  existingProductIds?: string[];
  onAddProducts: (productIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function MenuBulkItemAdd({
  open,
  onOpenChange,
  products,
  existingProductIds = [],
  onAddProducts,
  isLoading = false,
}: MenuBulkItemAddProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Get unique categories
  const categories = useMemo(() => {
    const cats = ['all', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
    return cats as string[];
  }, [products]);

  // Filter products
  const availableProducts = useMemo(() => {
    return products.filter((p) => !existingProductIds.includes(p.id));
  }, [products, existingProductIds]);

  const filteredProducts = useMemo(() => {
    return availableProducts.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [availableProducts, searchQuery, selectedCategory]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedProductIds(new Set());
  };

  const handleAdd = async () => {
    if (selectedProductIds.size === 0) return;
    await onAddProducts(Array.from(selectedProductIds));
    setSelectedProductIds(new Set());
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const handleCancel = () => {
    setSelectedProductIds(new Set());
    setSearchQuery('');
    setSelectedCategory('all');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Products to Menu</DialogTitle>
          <DialogDescription>
            Select multiple products to add to your menu at once
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          {categories.length > 1 && (
            <div>
              <Label className="text-sm mb-2 block">Category</Label>
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="w-full justify-start overflow-x-auto">
                  {categories.map((cat) => (
                    <TabsTrigger key={cat} value={cat} className="capitalize">
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedProductIds.size} of {filteredProducts.length} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Product List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {availableProducts.length === 0
                    ? 'All products have been added to this menu'
                    : 'No products found matching your search'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const isSelected = selectedProductIds.has(product.id);
                const isOutOfStock = product.stock_quantity !== undefined && product.stock_quantity <= 0;

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      isSelected && 'ring-2 ring-primary',
                      isOutOfStock && 'opacity-50'
                    )}
                    onClick={() => !isOutOfStock && toggleProduct(product.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          disabled={isOutOfStock}
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => !isOutOfStock && toggleProduct(product.id)}
                        />

                        {/* Product Image */}
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-16 h-16 rounded object-cover shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate mb-1">
                                {product.name}
                              </h4>
                              {product.category && (
                                <Badge variant="outline" className="text-xs mb-1">
                                  {product.category}
                                </Badge>
                              )}
                              {product.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-primary">
                                ${product.price.toFixed(2)}
                              </p>
                              {isOutOfStock && (
                                <Badge variant="destructive" className="text-[10px] mt-1">
                                  Out of Stock
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Selected Indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <div className="bg-primary text-primary-foreground rounded-full p-1">
                              <Check className="h-3 w-3" />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedProductIds.size === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add {selectedProductIds.size} Product{selectedProductIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
