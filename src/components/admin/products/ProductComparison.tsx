/**
 * ProductComparison Component
 *
 * Compare 2-4 products side by side with the following metrics:
 * - Price (wholesale/retail)
 * - Stock levels
 * - Sales velocity (units per day)
 * - Revenue (30-day)
 * - Vendor information
 * - Category
 * - Compliance status
 *
 * Highlights differences between products to help with decisions
 * about which products to promote or discontinue.
 *
 * Task 115: Create product comparison view
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import X from 'lucide-react/dist/esm/icons/x';
import GitCompare from 'lucide-react/dist/esm/icons/git-compare';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import Minus from 'lucide-react/dist/esm/icons/minus';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Package from 'lucide-react/dist/esm/icons/package';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import Building from 'lucide-react/dist/esm/icons/building';
import Tag from 'lucide-react/dist/esm/icons/tag';
import Shield from 'lucide-react/dist/esm/icons/shield';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBulkProductVelocity } from '@/hooks/useProductVelocity';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ProductComparisonProps {
  productIds: string[];
  open: boolean;
  onClose: () => void;
}

interface ProductData {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  category: string | null;
  vendor_name: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  available_quantity: number | null;
  low_stock_alert: number | null;
  coa_url: string | null;
  lab_results_url: string | null;
  test_date: string | null;
}

interface ProductRevenue {
  productId: string;
  revenue30d: number;
  unitsSold30d: number;
}

type ComparisonMetric = 'highest' | 'lowest' | 'neutral';

// ============================================================================
// Query Keys
// ============================================================================

const comparisonQueryKeys = {
  all: ['product-comparison'] as const,
  products: (tenantId: string, productIds: string[]) =>
    [...comparisonQueryKeys.all, 'products', tenantId, productIds.join(',')] as const,
  revenue: (tenantId: string, productIds: string[]) =>
    [...comparisonQueryKeys.all, 'revenue', tenantId, productIds.join(',')] as const,
};

// ============================================================================
// Hooks
// ============================================================================

function useComparisonProducts(productIds: string[]) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: comparisonQueryKeys.products(tenant?.id ?? '', productIds),
    queryFn: async (): Promise<ProductData[]> => {
      if (!tenant?.id || productIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          image_url,
          category,
          vendor_name,
          wholesale_price,
          retail_price,
          available_quantity,
          low_stock_alert,
          coa_url,
          lab_results_url,
          test_date
        `)
        .eq('tenant_id', tenant.id)
        .in('id', productIds);

      if (error) {
        logger.error('Failed to fetch comparison products', error, {
          component: 'ProductComparison',
          productIds,
        });
        throw error;
      }

      return (data ?? []) as ProductData[];
    },
    enabled: !!tenant?.id && productIds.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

function useProductRevenueData(productIds: string[]) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: comparisonQueryKeys.revenue(tenant?.id ?? '', productIds),
    queryFn: async (): Promise<Map<string, ProductRevenue>> => {
      const revenueMap = new Map<string, ProductRevenue>();

      if (!tenant?.id || productIds.length === 0) {
        return revenueMap;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('order_items')
        .select(`
          product_id,
          quantity,
          total,
          orders!inner(tenant_id, created_at, status)
        `)
        .in('product_id', productIds)
        .eq('orders.tenant_id', tenant.id)
        .gte('orders.created_at', thirtyDaysAgo.toISOString());

      if (error) {
        logger.error('Failed to fetch product revenue data', error, {
          component: 'ProductComparison',
        });
        throw error;
      }

      // Initialize all products with zero values
      for (const productId of productIds) {
        revenueMap.set(productId, {
          productId,
          revenue30d: 0,
          unitsSold30d: 0,
        });
      }

      // Aggregate revenue data
      const validStatuses = ['completed', 'delivered', 'processing', 'confirmed'];
      for (const item of data ?? []) {
        const order = item.orders as unknown as {
          tenant_id: string;
          created_at: string;
          status: string;
        };

        if (!validStatuses.includes(order.status?.toLowerCase() ?? '')) {
          continue;
        }

        const existing = revenueMap.get(item.product_id);
        if (existing) {
          existing.revenue30d += item.total ?? 0;
          existing.unitsSold30d += item.quantity ?? 0;
        }
      }

      return revenueMap;
    },
    enabled: !!tenant?.id && productIds.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getComplianceStatus(product: ProductData): 'compliant' | 'warning' | 'missing' {
  const hasCoa = Boolean(product.coa_url || product.lab_results_url);
  const hasTestDate = Boolean(product.test_date);

  if (!hasCoa && !hasTestDate) {
    return 'missing';
  }

  if (hasTestDate) {
    const testDate = new Date(product.test_date!);
    const daysSinceTest = Math.floor(
      (Date.now() - testDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceTest > 365) {
      return 'warning';
    }
  }

  return 'compliant';
}

function getMetricHighlight(
  value: number,
  allValues: number[],
  higherIsBetter: boolean
): ComparisonMetric {
  if (allValues.length < 2 || allValues.every((v) => v === value)) {
    return 'neutral';
  }

  const maxValue = Math.max(...allValues);
  const minValue = Math.min(...allValues);

  if (higherIsBetter) {
    if (value === maxValue) return 'highest';
    if (value === minValue) return 'lowest';
  } else {
    if (value === minValue) return 'highest';
    if (value === maxValue) return 'lowest';
  }

  return 'neutral';
}

function getMetricClasses(metric: ComparisonMetric): string {
  switch (metric) {
    case 'highest':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
    case 'lowest':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
    default:
      return '';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function ComparisonRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 font-medium text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </div>
      <div className="grid divide-x" style={{ gridTemplateColumns: `repeat(${Array.isArray(children) ? (children as React.ReactNode[]).filter(Boolean).length : 1}, 1fr)` }}>
        {children}
      </div>
    </div>
  );
}

function MetricCell({
  value,
  subValue,
  highlight,
  className,
}: {
  value: React.ReactNode;
  subValue?: React.ReactNode;
  highlight?: ComparisonMetric;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'px-4 py-3 text-center',
        highlight && getMetricClasses(highlight),
        className
      )}
    >
      <div className="font-semibold">{value}</div>
      {subValue && (
        <div className="text-xs text-muted-foreground mt-1">{subValue}</div>
      )}
    </div>
  );
}

function ComplianceBadge({ status }: { status: 'compliant' | 'warning' | 'missing' }) {
  switch (status) {
    case 'compliant':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <ShieldCheck className="h-3 w-3 mr-1" />
          Compliant
        </Badge>
      );
    case 'warning':
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <ShieldAlert className="h-3 w-3 mr-1" />
          Expired Tests
        </Badge>
      );
    case 'missing':
      return (
        <Badge variant="secondary">
          <AlertCircle className="h-3 w-3 mr-1" />
          No Data
        </Badge>
      );
  }
}

function TrendIndicator({ direction }: { direction: 'increasing' | 'decreasing' | 'stable' }) {
  switch (direction) {
    case 'increasing':
      return <TrendingUp className="h-4 w-4 text-green-600 inline ml-1" />;
    case 'decreasing':
      return <TrendingDown className="h-4 w-4 text-red-600 inline ml-1" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground inline ml-1" />;
  }
}

function ProductHeader({
  product,
  onRemove,
}: {
  product: ProductData;
  onRemove: () => void;
}) {
  return (
    <div className="relative p-4 text-center border-b">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={onRemove}
        aria-label="Remove"
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="w-16 h-16 mx-auto mb-2 rounded-lg overflow-hidden bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
      {product.sku && (
        <p className="text-xs text-muted-foreground mt-1">SKU: {product.sku}</p>
      )}
    </div>
  );
}

function LoadingState({ productCount }: { productCount: number }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${productCount}, 1fr)` }}>
        {Array.from({ length: productCount }).map((_, i) => (
          <div key={i} className="space-y-3 p-4">
            <Skeleton className="h-16 w-16 mx-auto rounded-lg" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-3 w-1/2 mx-auto" />
          </div>
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProductComparison({
  productIds,
  open,
  onClose,
}: ProductComparisonProps) {
  const [localProductIds, setLocalProductIds] = useState<string[]>(productIds);

  // Update local state when productIds prop changes
  useMemo(() => {
    setLocalProductIds(productIds);
  }, [productIds]);

  // Fetch product data
  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsError,
  } = useComparisonProducts(localProductIds);

  // Fetch velocity data
  const {
    velocities,
    isLoading: velocitiesLoading,
  } = useBulkProductVelocity({
    productIds: localProductIds,
    enabled: localProductIds.length >= 2,
  });

  // Fetch revenue data
  const {
    data: revenueData = new Map(),
    isLoading: revenueLoading,
  } = useProductRevenueData(localProductIds);

  const isLoading = productsLoading || velocitiesLoading || revenueLoading;

  // Order products to match the order of productIds
  const orderedProducts = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    return localProductIds
      .map((id) => productMap.get(id))
      .filter((p): p is ProductData => p !== undefined);
  }, [products, localProductIds]);

  // Calculate metric arrays for highlighting
  const prices = orderedProducts.map((p) => p.wholesale_price ?? 0);
  const stocks = orderedProducts.map((p) => p.available_quantity ?? 0);
  const revenues = orderedProducts.map((p) => revenueData.get(p.id)?.revenue30d ?? 0);
  const velocityValues = orderedProducts.map(
    (p) => velocities.get(p.id)?.unitsPerDay ?? 0
  );

  // Handle removing a product from comparison
  const handleRemoveProduct = (productId: string) => {
    const newIds = localProductIds.filter((id) => id !== productId);
    if (newIds.length < 2) {
      onClose();
    } else {
      setLocalProductIds(newIds);
    }
  };

  // Validate product count
  if (productIds.length < 2) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product Comparison</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select at least 2 products to compare</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (productIds.length > 4) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product Comparison</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select up to 4 products to compare</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Product Comparison
          </DialogTitle>
          <DialogDescription>
            Comparing {localProductIds.length} products side by side
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="p-6 pt-4">
            {isLoading ? (
              <LoadingState productCount={localProductIds.length} />
            ) : productsError ? (
              <div className="text-center py-8 text-destructive">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p>Failed to load product data</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                {/* Product Headers */}
                <div
                  className="grid divide-x bg-card"
                  style={{
                    gridTemplateColumns: `repeat(${orderedProducts.length}, 1fr)`,
                  }}
                >
                  {orderedProducts.map((product) => (
                    <ProductHeader
                      key={product.id}
                      product={product}
                      onRemove={() => handleRemoveProduct(product.id)}
                    />
                  ))}
                </div>

                {/* Comparison Rows */}
                <div className="divide-y">
                  {/* Price */}
                  <ComparisonRow label="Wholesale Price" icon={DollarSign}>
                    {orderedProducts.map((product, _idx) => (
                      <MetricCell
                        key={product.id}
                        value={
                          product.wholesale_price
                            ? formatCurrency(product.wholesale_price)
                            : '-'
                        }
                        subValue={
                          product.retail_price
                            ? `Retail: ${formatCurrency(product.retail_price)}`
                            : undefined
                        }
                        highlight={getMetricHighlight(
                          product.wholesale_price ?? 0,
                          prices,
                          false // Lower price is better for cost
                        )}
                      />
                    ))}
                  </ComparisonRow>

                  {/* Stock */}
                  <ComparisonRow label="Stock Level" icon={Package}>
                    {orderedProducts.map((product, _idx) => {
                      const qty = product.available_quantity ?? 0;
                      const threshold = product.low_stock_alert ?? 10;
                      const isLow = qty > 0 && qty <= threshold;
                      const isOut = qty <= 0;

                      return (
                        <MetricCell
                          key={product.id}
                          value={
                            <span className={isOut ? 'text-destructive' : isLow ? 'text-amber-600' : ''}>
                              {qty} units
                            </span>
                          }
                          subValue={
                            isOut ? (
                              <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-100 text-amber-800 text-xs">Low Stock</Badge>
                            ) : undefined
                          }
                          highlight={getMetricHighlight(qty, stocks, true)}
                        />
                      );
                    })}
                  </ComparisonRow>

                  {/* Sales Velocity */}
                  <ComparisonRow label="Sales Velocity" icon={TrendingUp}>
                    {orderedProducts.map((product) => {
                      const velocity = velocities.get(product.id);
                      return (
                        <MetricCell
                          key={product.id}
                          value={
                            <span>
                              {velocity?.unitsPerDay?.toFixed(1) ?? '0'} /day
                              {velocity && (
                                <TrendIndicator direction={velocity.trendDirection} />
                              )}
                            </span>
                          }
                          subValue={
                            velocity
                              ? `${velocity.weeklyUnits} weekly / ${velocity.monthlyUnits} monthly`
                              : 'No sales data'
                          }
                          highlight={getMetricHighlight(
                            velocity?.unitsPerDay ?? 0,
                            velocityValues,
                            true
                          )}
                        />
                      );
                    })}
                  </ComparisonRow>

                  {/* Revenue */}
                  <ComparisonRow label="Revenue (30 days)" icon={ShoppingCart}>
                    {orderedProducts.map((product) => {
                      const revenue = revenueData.get(product.id);
                      return (
                        <MetricCell
                          key={product.id}
                          value={formatCurrency(revenue?.revenue30d ?? 0)}
                          subValue={`${revenue?.unitsSold30d ?? 0} units sold`}
                          highlight={getMetricHighlight(
                            revenue?.revenue30d ?? 0,
                            revenues,
                            true
                          )}
                        />
                      );
                    })}
                  </ComparisonRow>

                  {/* Vendor */}
                  <ComparisonRow label="Vendor" icon={Building}>
                    {orderedProducts.map((product) => (
                      <MetricCell
                        key={product.id}
                        value={product.vendor_name || '-'}
                      />
                    ))}
                  </ComparisonRow>

                  {/* Category */}
                  <ComparisonRow label="Category" icon={Tag}>
                    {orderedProducts.map((product) => (
                      <MetricCell
                        key={product.id}
                        value={
                          product.category ? (
                            <Badge variant="outline" className="capitalize">
                              {product.category}
                            </Badge>
                          ) : (
                            '-'
                          )
                        }
                      />
                    ))}
                  </ComparisonRow>

                  {/* Compliance */}
                  <ComparisonRow label="Compliance Status" icon={Shield}>
                    {orderedProducts.map((product) => {
                      const status = getComplianceStatus(product);
                      return (
                        <MetricCell
                          key={product.id}
                          value={<ComplianceBadge status={status} />}
                          className={
                            status === 'compliant'
                              ? 'bg-green-50 dark:bg-green-900/10'
                              : status === 'warning'
                              ? 'bg-amber-50 dark:bg-amber-900/10'
                              : ''
                          }
                        />
                      );
                    })}
                  </ComparisonRow>

                  {/* Days Until Stockout */}
                  <ComparisonRow label="Days Until Stockout" icon={AlertCircle}>
                    {orderedProducts.map((product) => {
                      const velocity = velocities.get(product.id);
                      const days = velocity?.daysUntilStockout ?? 999;
                      const isUrgent = days <= 7;
                      const isSoon = days <= 14 && days > 7;

                      return (
                        <MetricCell
                          key={product.id}
                          value={
                            <span
                              className={
                                isUrgent
                                  ? 'text-destructive font-bold'
                                  : isSoon
                                  ? 'text-amber-600 font-medium'
                                  : ''
                              }
                            >
                              {days >= 999 ? '∞' : `${days} days`}
                            </span>
                          }
                          subValue={
                            velocity?.reorderUrgency === 'urgent' ? (
                              <Badge variant="destructive" className="text-xs">Reorder Now</Badge>
                            ) : velocity?.reorderUrgency === 'soon' ? (
                              <Badge className="bg-amber-100 text-amber-800 text-xs">Reorder Soon</Badge>
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </ComparisonRow>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                Best value
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                Needs attention
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProductComparison;
