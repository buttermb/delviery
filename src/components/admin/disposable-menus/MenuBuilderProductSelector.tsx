/**
 * Menu Builder Product Selector
 *
 * Enhanced product selection for menu/disposable menu builder with:
 * - Live inventory connection with stock status badges
 * - Out-of-stock products grayed out
 * - Low-stock warning indicators
 * - Price override per menu (custom pricing)
 * - Category filtering matching product categories
 * - Search within product catalog
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { ProductForMenu } from '@/hooks/useProductsForMenu';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';
import Package from 'lucide-react/dist/esm/icons/package';
import Check from 'lucide-react/dist/esm/icons/check';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import PackageX from 'lucide-react/dist/esm/icons/package-x';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import { queryKeys } from '@/lib/queryKeys';

// Stock level thresholds
const LOW_STOCK_THRESHOLD = 10;

// Extended product interface with stock status
interface MenuProduct extends ProductForMenu {
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

// Selected product with optional price override
export interface SelectedMenuProduct {
  productId: string;
  customPrice?: number;
}

interface MenuBuilderProductSelectorProps {
  selectedProducts: SelectedMenuProduct[];
  onSelectionChange: (products: SelectedMenuProduct[]) => void;
  maxProducts?: number;
}

/**
 * Get stock status based on quantity
 */
function getStockStatus(quantity: number | undefined | null): MenuProduct['stock_status'] {
  if (quantity === undefined || quantity === null || quantity <= 0) {
    return 'out_of_stock';
  }
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return 'low_stock';
  }
  return 'in_stock';
}

/**
 * Stock Status Badge Component
 */
function StockStatusBadge({ status, quantity }: { status: MenuProduct['stock_status']; quantity?: number }) {
  if (status === 'out_of_stock') {
    return (
      <Badge variant="destructive" className="text-[10px] h-5 px-1.5 flex items-center gap-1">
        <PackageX className="w-3 h-3" />
        Out of Stock
      </Badge>
    );
  }

  if (status === 'low_stock') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Low Stock
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Only {quantity} units remaining</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      <Check className="w-3 h-3" />
      In Stock
    </Badge>
  );
}

/**
 * Price Override Input Component
 */
function PriceOverrideInput({
  basePrice,
  customPrice,
  onChange,
}: {
  basePrice: number;
  customPrice?: number;
  onChange: (price: number | undefined) => void;
}) {
  const [inputValue, setInputValue] = useState(customPrice?.toString() ?? '');
  const [isEditing, setIsEditing] = useState(false);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed);
    } else if (inputValue === '') {
      onChange(undefined);
    }
  }, [inputValue, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setInputValue(customPrice?.toString() ?? '');
      setIsEditing(false);
    }
  }, [handleBlur, customPrice]);

  const displayPrice = customPrice ?? basePrice;
  const hasOverride = customPrice !== undefined && customPrice !== basePrice;

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <DollarSign className="w-3 h-3 text-muted-foreground" />
        <Input
          type="number"
          min="0"
          step="0.01"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-label="Custom price"
          className="h-6 w-20 text-xs px-1"
          autoFocus
        />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              setInputValue(displayPrice.toString());
              setIsEditing(true);
            }}
            className={cn(
              'text-xs font-medium flex items-center gap-0.5 hover:underline cursor-pointer',
              hasOverride ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'
            )}
          >
            <DollarSign className="w-3 h-3" />
            {displayPrice.toFixed(2)}
            {hasOverride && (
              <span className="text-[10px] text-muted-foreground line-through ml-1">
                ${basePrice.toFixed(2)}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to set custom price for this menu</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Product Card Component
 */
function ProductCard({
  product,
  isSelected,
  isDisabled,
  customPrice,
  onToggle,
  onPriceChange,
}: {
  product: MenuProduct;
  isSelected: boolean;
  isDisabled: boolean;
  customPrice?: number;
  onToggle: () => void;
  onPriceChange: (price: number | undefined) => void;
}) {
  const isOutOfStock = product.stock_status === 'out_of_stock';
  const isLowStock = product.stock_status === 'low_stock';

  return (
    <Card
      className={cn(
        'transition-all duration-200 cursor-pointer',
        isSelected && 'ring-2 ring-primary bg-primary/5',
        isOutOfStock && 'opacity-50 cursor-not-allowed',
        isDisabled && !isOutOfStock && 'opacity-60 cursor-not-allowed',
        !isSelected && !isOutOfStock && !isDisabled && 'hover:bg-muted/50'
      )}
      onClick={() => !isDisabled && !isOutOfStock && onToggle()}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            disabled={isDisabled || isOutOfStock}
            className="mt-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() => !isDisabled && !isOutOfStock && onToggle()}
          />

          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className={cn(
                'w-12 h-12 rounded object-cover shrink-0',
                isOutOfStock && 'grayscale'
              )}
            />
          ) : (
            <div className={cn(
              'w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0',
              isOutOfStock && 'opacity-50'
            )}>
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn(
                  'font-medium text-sm truncate',
                  isOutOfStock && 'text-muted-foreground'
                )}>
                  {product.name}
                </p>
                {product.sku && (
                  <p className="text-xs text-muted-foreground truncate">
                    SKU: {product.sku}
                  </p>
                )}
              </div>

              {isSelected && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2 mt-2">
              <StockStatusBadge
                status={product.stock_status}
                quantity={product.stock_quantity}
              />

              {product.category && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {product.category}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between mt-2">
              {isSelected ? (
                <PriceOverrideInput
                  basePrice={product.price}
                  customPrice={customPrice}
                  onChange={onPriceChange}
                />
              ) : (
                <span className="text-xs font-medium">
                  ${product.price.toFixed(2)}
                </span>
              )}

              {product.stock_quantity !== undefined && product.stock_quantity > 0 && (
                <span className={cn(
                  'text-[10px]',
                  isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                )}>
                  {product.stock_quantity} units
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Selected Products Summary Component
 */
function SelectedProductsSummary({
  products,
  selectedProducts,
  onRemove,
  onClearAll,
  maxProducts,
}: {
  products: MenuProduct[];
  selectedProducts: SelectedMenuProduct[];
  onRemove: (productId: string) => void;
  onClearAll: () => void;
  maxProducts?: number;
}) {
  if (selectedProducts.length === 0) return null;

  const selectedProductDetails = selectedProducts
    .map(sp => {
      const product = products.find(p => p.id === sp.productId);
      return product ? { ...product, customPrice: sp.customPrice } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div className="space-y-3 border-b pb-4 mb-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-green-500" />
          Selected ({selectedProducts.length}
          {maxProducts ? `/${maxProducts}` : ''})
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-7"
          onClick={onClearAll}
        >
          Clear All
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedProductDetails.map(product => (
          <Badge
            key={product.id}
            variant="secondary"
            className="flex items-center gap-1.5 pr-1 h-7"
          >
            <span className="max-w-[150px] truncate">{product.name}</span>
            {product.customPrice && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                ${product.customPrice.toFixed(2)}
              </span>
            )}
            {product.stock_status === 'low_stock' && (
              <AlertTriangle className="w-3 h-3 text-amber-500" />
            )}
            <button
              onClick={() => onRemove(product.id)}
              className="hover:bg-muted rounded p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

/**
 * Main Menu Builder Product Selector Component
 */
export function MenuBuilderProductSelector({
  selectedProducts,
  onSelectionChange,
  maxProducts,
}: MenuBuilderProductSelectorProps) {
  const { tenant } = useTenantAdminAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch products with live inventory data
  const { data: rawProducts, isLoading, error } = useQuery({
    queryKey: queryKeys.menuProducts.builder(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('wholesale_inventory')
        .select('id, product_name, base_price, sku, description, image_url, category, quantity_units')
        .eq('tenant_id', tenant.id)
        .order('product_name');

      if (error) {
        logger.error('Failed to fetch products for menu builder', error, {
          component: 'MenuBuilderProductSelector',
        });
        throw error;
      }

      interface InventoryRow { id: string; product_name: string; base_price?: number; sku?: string; description?: string; image_url?: string; category?: string; quantity_units?: number }
      return (data ?? []).map((item: InventoryRow) => ({
        id: item.id,
        name: item.product_name,
        price: item.base_price ?? 0,
        sku: item.sku,
        description: item.description,
        image_url: item.image_url,
        category: item.category,
        stock_quantity: item.quantity_units,
      })) as ProductForMenu[];
    },
    enabled: !!tenant?.id,
  });

  // Transform products with stock status
  const products: MenuProduct[] = useMemo(() => {
    if (!rawProducts) return [];
    return rawProducts.map(p => ({
      ...p,
      stock_status: getStockStatus(p.stock_quantity),
    }));
  }, [rawProducts]);

  // Get unique categories
  const categories = useMemo(() => {
    if (!products) return ['all'];
    const uniqueCategories = Array.from(
      new Set(products.map(p => p.category).filter(Boolean))
    ) as string[];
    return ['all', ...uniqueCategories.sort()];
  }, [products]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    return products.filter(p => {
      // Search filter
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category filter
      const matchesCategory =
        selectedCategory === 'all' || p.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Sort: in-stock first, then low-stock, then out-of-stock
  const sortedProducts = useMemo(() => {
    const stockOrder = { in_stock: 0, low_stock: 1, out_of_stock: 2 };
    return [...filteredProducts].sort((a, b) => {
      return stockOrder[a.stock_status] - stockOrder[b.stock_status];
    });
  }, [filteredProducts]);

  // Toggle product selection
  const toggleProduct = useCallback((productId: string) => {
    const isSelected = selectedProducts.some(sp => sp.productId === productId);

    if (isSelected) {
      onSelectionChange(selectedProducts.filter(sp => sp.productId !== productId));
    } else if (!maxProducts || selectedProducts.length < maxProducts) {
      onSelectionChange([...selectedProducts, { productId }]);
    }
  }, [selectedProducts, onSelectionChange, maxProducts]);

  // Update custom price for a product
  const updateProductPrice = useCallback((productId: string, customPrice: number | undefined) => {
    onSelectionChange(
      selectedProducts.map(sp =>
        sp.productId === productId
          ? { ...sp, customPrice }
          : sp
      )
    );
  }, [selectedProducts, onSelectionChange]);

  // Remove product from selection
  const removeProduct = useCallback((productId: string) => {
    onSelectionChange(selectedProducts.filter(sp => sp.productId !== productId));
  }, [selectedProducts, onSelectionChange]);

  // Clear all selections
  const clearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8">
        <PackageX className="w-10 h-10 mx-auto text-destructive mb-2" />
        <p className="text-sm text-destructive">Failed to load products</p>
        <p className="text-xs text-muted-foreground mt-1">Please try again later</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected Products Summary */}
      <SelectedProductsSummary
        products={products}
        selectedProducts={selectedProducts}
        onRemove={removeProduct}
        onClearAll={clearAll}
        maxProducts={maxProducts}
      />

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name, SKU, or category..."
          aria-label="Search products"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      {categories.length > 1 && (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
            {categories.map(cat => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="capitalize text-xs"
              >
                {cat === 'all' ? 'All Categories' : cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Max products warning */}
      {maxProducts && selectedProducts.length >= maxProducts && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Maximum of {maxProducts} products reached. Remove a product to add a new one.
        </div>
      )}

      {/* Product Grid */}
      <div className="max-h-[400px] overflow-y-auto">
        {sortedProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No products found</p>
            {searchQuery && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-1"
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sortedProducts.map(product => {
              const selectedItem = selectedProducts.find(sp => sp.productId === product.id);
              const isSelected = !!selectedItem;
              const isDisabled =
                !isSelected &&
                maxProducts !== undefined &&
                selectedProducts.length >= maxProducts;

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  customPrice={selectedItem?.customPrice}
                  onToggle={() => toggleProduct(product.id)}
                  onPriceChange={(price) => updateProductPrice(product.id, price)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Stock legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
          In Stock
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
          Low Stock (&le;{LOW_STOCK_THRESHOLD})
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
          Out of Stock
        </div>
      </div>
    </div>
  );
}
