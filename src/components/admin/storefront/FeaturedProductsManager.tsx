/**
 * Featured Products Manager
 * Select and manage which products appear as featured on the storefront
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';
import {
  Search,
  Star,
  GripVertical,
  X,
  Package,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
  in_stock: boolean;
}

interface FeaturedProductsManagerProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxFeatured?: number;
}

export function FeaturedProductsManager({
  selectedIds,
  onSelectionChange,
  maxFeatured = 8,
}: FeaturedProductsManagerProps) {
  const { tenant } = useTenantAdminAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all products for this tenant
  const { data: products, isLoading } = useQuery({
    queryKey: ['storefront-products-list', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { eq: (col: string, val: boolean) => { order: (col: string) => Promise<{ data: Product[] | null; error: unknown }> } } } } })
        .from('products')
        .select('id, name, price, image_url, category, in_stock')
        .eq('tenant_id', tenant.id)
        .eq('in_stock', true)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for featured selection', error, {
          component: 'FeaturedProductsManager',
        });
        throw error;
      }
      return (data || []) as Product[];
    },
    enabled: !!tenant?.id,
  });

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  // Get selected products in order
  const selectedProducts = useMemo(() => {
    if (!products) return [];
    return selectedIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p);
  }, [products, selectedIds]);

  const toggleProduct = (productId: string) => {
    if (selectedIds.includes(productId)) {
      onSelectionChange(selectedIds.filter((id) => id !== productId));
    } else if (selectedIds.length < maxFeatured) {
      onSelectionChange([...selectedIds, productId]);
    }
  };

  const removeProduct = (productId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== productId));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected Products */}
      {selectedProducts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Featured ({selectedProducts.length}/{maxFeatured})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => onSelectionChange([])}
            >
              Clear All
            </Button>
          </div>
          <div className="space-y-2">
            {selectedProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-2 bg-primary/5 border border-primary/20 rounded-lg"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono text-muted-foreground w-4">
                  {index + 1}
                </span>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ${product.price.toFixed(2)}
                    {product.category && ` · ${product.category}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeProduct(product.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Product List */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-lg p-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isSelected = selectedIds.includes(product.id);
              const isDisabled = !isSelected && selectedIds.length >= maxFeatured;

              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary/5'
                      : isDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-muted/50'
                  }`}
                  onClick={() => !isDisabled && toggleProduct(product.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    className="shrink-0"
                  />
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-8 h-8 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.category && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {product.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {selectedIds.length >= maxFeatured && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
            Maximum of {maxFeatured} featured products reached. Remove a product to add a new one.
          </p>
        )}
      </div>
    </div>
  );
}
