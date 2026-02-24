/**
 * CustomerPreferredProducts Component
 *
 * Displays frequently ordered products for a customer based on order history.
 * Shows product name, times ordered, last ordered date, total quantity.
 * Clickable to product detail. Useful for staff recommendations during order creation.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Heart, Package, TrendingUp, Calendar, ShoppingCart } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { ProductLink } from '@/components/admin/cross-links';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface CustomerPreferredProductsProps {
  customerId: string;
  /** Compact mode for embedding in other views like order creation */
  compact?: boolean;
  /** Callback when a product is selected (for order creation flow) */
  onProductSelect?: (productId: string, productName: string) => void;
  /** Maximum number of products to display */
  limit?: number;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  products: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    category: string | null;
  } | null;
}

interface PreferredProduct {
  productId: string;
  productName: string;
  timesOrdered: number;
  totalQuantity: number;
  lastOrderedAt: string;
  imageUrl: string | null;
  category: string | null;
  price: number;
}

export function CustomerPreferredProducts({
  customerId,
  compact = false,
  onProductSelect,
  limit = 10,
}: CustomerPreferredProductsProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Fetch order items for this customer
  const {
    data: orderItems,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.customerDetail.preferredProducts(customerId, tenantId),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Get all order items for this customer's orders
      const { data, error: queryError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          quantity,
          created_at,
          products(id, name, price, image_url, category),
          orders!inner(customer_id, tenant_id)
        `)
        .eq('orders.customer_id', customerId)
        .eq('orders.tenant_id', tenantId);

      if (queryError) {
        logger.error('Failed to fetch customer order items', queryError, {
          customerId,
          tenantId,
          component: 'CustomerPreferredProducts',
        });
        throw queryError;
      }

      return data as unknown as OrderItem[];
    },
    enabled: !!customerId && !!tenantId,
  });

  // Aggregate products by frequency
  const preferredProducts = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return [];

    const productMap = new Map<string, PreferredProduct>();

    for (const item of orderItems) {
      if (!item.product_id || !item.products) continue;

      const existing = productMap.get(item.product_id);
      const itemDate = new Date(item.created_at);

      if (existing) {
        existing.timesOrdered += 1;
        existing.totalQuantity += item.quantity || 1;
        // Track the most recent order date
        if (new Date(existing.lastOrderedAt) < itemDate) {
          existing.lastOrderedAt = item.created_at;
        }
      } else {
        productMap.set(item.product_id, {
          productId: item.product_id,
          productName: item.products.name,
          timesOrdered: 1,
          totalQuantity: item.quantity || 1,
          lastOrderedAt: item.created_at,
          imageUrl: item.products.image_url,
          category: item.products.category,
          price: item.products.price,
        });
      }
    }

    // Sort by times ordered (descending), then by total quantity
    return Array.from(productMap.values())
      .sort((a, b) => {
        if (b.timesOrdered !== a.timesOrdered) {
          return b.timesOrdered - a.timesOrdered;
        }
        return b.totalQuantity - a.totalQuantity;
      })
      .slice(0, limit);
  }, [orderItems, limit]);

  // Calculate stats
  const stats = useMemo(() => {
    if (preferredProducts.length === 0) {
      return { uniqueProducts: 0, topCategory: null };
    }

    // Find most common category
    const categoryCount = new Map<string, number>();
    for (const product of preferredProducts) {
      if (product.category) {
        categoryCount.set(
          product.category,
          (categoryCount.get(product.category) || 0) + product.timesOrdered
        );
      }
    }

    let topCategory: string | null = null;
    let maxCount = 0;
    categoryCount.forEach((count, category) => {
      if (count > maxCount) {
        maxCount = count;
        topCategory = category;
      }
    });

    return {
      uniqueProducts: preferredProducts.length,
      topCategory,
    };
  }, [preferredProducts]);

  if (isLoading) {
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader className={compact ? 'pb-2' : undefined}>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))] flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            Preferred Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    logger.error(
      'Error displaying customer preferred products',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'CustomerPreferredProducts' }
    );
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader className={compact ? 'pb-2' : undefined}>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))] flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            Preferred Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load preferred products. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (preferredProducts.length === 0) {
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader className={compact ? 'pb-2' : undefined}>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))] flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            Preferred Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EnhancedEmptyState
            icon={Package}
            title="No Purchase History"
            description="This customer hasn't ordered any products yet. Their favorites will appear here once they place orders."
            compact
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))] flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            {compact ? 'Favorites' : 'Preferred Products'}
          </CardTitle>
          {!compact && stats.topCategory && (
            <Badge variant="secondary" className="text-xs">
              Top Category: {stats.topCategory}
            </Badge>
          )}
        </div>
        {!compact && (
          <p className="text-sm text-muted-foreground mt-1">
            Based on {stats.uniqueProducts} unique products from order history
          </p>
        )}
      </CardHeader>
      <CardContent className={compact ? 'pt-0' : undefined}>
        <div className="space-y-3">
          {preferredProducts.map((product, index) => (
            <div
              key={product.productId}
              className={`flex items-center gap-4 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors ${
                onProductSelect ? 'cursor-pointer' : ''
              }`}
              onClick={
                onProductSelect
                  ? () => onProductSelect(product.productId, product.productName)
                  : undefined
              }
            >
              {/* Rank badge */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : index === 1
                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    : index === 2
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {index + 1}
              </div>

              {/* Product image or placeholder */}
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  <ProductLink
                    productId={product.productId}
                    productName={product.productName}
                  />
                </div>
                {product.category && (
                  <span className="text-xs text-muted-foreground">{product.category}</span>
                )}
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 text-right space-y-1">
                <div className="flex items-center justify-end gap-1 text-sm">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-semibold">{product.timesOrdered}x</span>
                  <span className="text-muted-foreground">ordered</span>
                </div>
                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(product.lastOrderedAt), 'MMM d, yyyy')}
                </div>
                {!compact && (
                  <div className="text-xs text-muted-foreground">
                    {product.totalQuantity} total qty
                  </div>
                )}
              </div>

              {/* Add to cart button (for order creation) */}
              {onProductSelect && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProductSelect(product.productId, product.productName);
                  }}
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
