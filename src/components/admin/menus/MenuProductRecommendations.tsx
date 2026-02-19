/**
 * Menu Product Recommendation Engine
 *
 * Suggests products to add to menus based on:
 * - Popular products from other menus
 * - Products frequently bought together
 * - High-margin products
 * - New arrivals
 *
 * Based on order analytics and product performance data.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Package from 'lucide-react/dist/esm/icons/package';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Check from 'lucide-react/dist/esm/icons/check';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Lightbulb from 'lucide-react/dist/esm/icons/lightbulb';
import Info from 'lucide-react/dist/esm/icons/info';

// Recommendation reasons
type RecommendationReason = 'popular' | 'frequently_bought_together' | 'high_margin' | 'new_arrival';

interface RecommendedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  category?: string | null;
  sku?: string | null;
  reason: RecommendationReason;
  score: number;
  stats: {
    ordersCount?: number;
    revenue?: number;
    marginPercent?: number;
    createdDaysAgo?: number;
    frequentlyBoughtWith?: string[];
  };
}

interface MenuProductRecommendationsProps {
  menuId?: string;
  currentProductIds: string[];
  onAddProduct: (productId: string) => void;
  className?: string;
}

interface OrderItem {
  product_id?: string;
  product_name?: string;
  quantity?: number;
  price_per_unit?: number;
}

interface OrderData {
  items?: OrderItem[];
}

interface MenuOrderRow {
  id: string;
  order_data: unknown;
  total_amount: number | null;
  created_at: string;
}

interface ProductRow {
  id: string;
  product_name: string;
  base_price: number | null;
  cost_price: number | null;
  image_url: string | null;
  category: string | null;
  sku: string | null;
  created_at: string;
}

const REASON_CONFIG: Record<RecommendationReason, { label: string; icon: React.ElementType; color: string; description: string }> = {
  popular: {
    label: 'Popular',
    icon: TrendingUp,
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    description: 'Top seller across other menus',
  },
  frequently_bought_together: {
    label: 'Frequently Bought',
    icon: ShoppingCart,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    description: 'Often purchased with products in this menu',
  },
  high_margin: {
    label: 'High Margin',
    icon: DollarSign,
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    description: 'Great profit potential',
  },
  new_arrival: {
    label: 'New Arrival',
    icon: Sparkles,
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    description: 'Recently added to inventory',
  },
};

/**
 * Product Recommendation Card
 */
function RecommendationCard({
  product,
  isAdded,
  onAdd,
}: {
  product: RecommendedProduct;
  isAdded: boolean;
  onAdd: () => void;
}) {
  const config = REASON_CONFIG[product.reason];
  const Icon = config.icon;

  return (
    <Card className={cn(
      'transition-all duration-200',
      isAdded && 'bg-primary/5 border-primary/30'
    )}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Product Image */}
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-12 h-12 rounded object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {product.name}
                </p>
                {product.sku && (
                  <p className="text-xs text-muted-foreground">
                    SKU: {product.sku}
                  </p>
                )}
              </div>

              {/* Add Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isAdded ? 'ghost' : 'default'}
                      size="sm"
                      className={cn(
                        'h-7 shrink-0',
                        isAdded && 'text-green-600'
                      )}
                      disabled={isAdded}
                      onClick={onAdd}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isAdded ? 'Already in menu' : 'Add to menu'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Recommendation Badge */}
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn('text-[10px] h-5 px-1.5 flex items-center gap-1 cursor-help', config.color)}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{config.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {product.category && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {product.category}
                </Badge>
              )}
            </div>

            {/* Stats & Price */}
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="font-medium">
                {formatCurrency(product.price)}
              </span>

              <div className="flex items-center gap-3 text-muted-foreground">
                {product.stats.ordersCount !== undefined && product.stats.ordersCount > 0 && (
                  <span className="flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" />
                    {product.stats.ordersCount} orders
                  </span>
                )}
                {product.stats.marginPercent !== undefined && product.stats.marginPercent > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <DollarSign className="w-3 h-3" />
                    {product.stats.marginPercent.toFixed(0)}% margin
                  </span>
                )}
                {product.stats.createdDaysAgo !== undefined && product.stats.createdDaysAgo <= 14 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Sparkles className="w-3 h-3" />
                    {product.stats.createdDaysAgo}d ago
                  </span>
                )}
              </div>
            </div>

            {/* Frequently bought with */}
            {product.stats.frequentlyBoughtWith && product.stats.frequentlyBoughtWith.length > 0 && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                <span className="font-medium">Often bought with: </span>
                {product.stats.frequentlyBoughtWith.slice(0, 2).join(', ')}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main Menu Product Recommendations Component
 */
export function MenuProductRecommendations({
  menuId,
  currentProductIds,
  onAddProduct,
  className,
}: MenuProductRecommendationsProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const [activeTab, setActiveTab] = useState<RecommendationReason | 'all'>('all');

  // Fetch all products from inventory
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['menu-recommendations-products', tenantId],
    queryFn: async (): Promise<ProductRow[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('wholesale_inventory')
        .select('id, product_name, base_price, cost_price, image_url, category, sku, created_at')
        .eq('tenant_id', tenantId)
        .gt('quantity_units', 0)
        .order('product_name');

      if (error) {
        logger.error('Failed to fetch products for recommendations', error, {
          component: 'MenuProductRecommendations',
        });
        throw error;
      }

      return (data || []) as unknown as ProductRow[];
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // Fetch order data for analytics
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['menu-recommendations-orders', tenantId],
    queryFn: async (): Promise<MenuOrderRow[]> => {
      if (!tenantId) return [];

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const { data, error } = await supabase
        .from('menu_orders')
        .select('id, order_data, total_amount, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo)
        .in('status', ['completed', 'delivered', 'pending']);

      if (error) {
        logger.warn('Failed to fetch orders for recommendations', { error: error.message });
        return [];
      }

      return (data || []) as MenuOrderRow[];
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // Calculate recommendations
  const recommendations = useMemo((): RecommendedProduct[] => {
    if (!productsData || productsData.length === 0) return [];

    const allRecommendations: RecommendedProduct[] = [];
    const now = new Date();

    // Build product performance map from orders
    const productStats: Record<string, { orders: number; revenue: number; coOccurrences: Record<string, number> }> = {};

    if (ordersData && ordersData.length > 0) {
      ordersData.forEach((order) => {
        const orderData = order.order_data as OrderData | null;
        const items = orderData?.items || [];
        const productIdsInOrder = items.map((item) => item.product_id).filter(Boolean) as string[];

        items.forEach((item) => {
          if (!item.product_id) return;

          if (!productStats[item.product_id]) {
            productStats[item.product_id] = { orders: 0, revenue: 0, coOccurrences: {} };
          }

          productStats[item.product_id].orders += item.quantity || 1;
          productStats[item.product_id].revenue += (item.price_per_unit || 0) * (item.quantity || 1);

          // Track co-occurrences for frequently bought together
          productIdsInOrder.forEach((otherId) => {
            if (otherId !== item.product_id) {
              productStats[item.product_id].coOccurrences[otherId] =
                (productStats[item.product_id].coOccurrences[otherId] || 0) + 1;
            }
          });
        });
      });
    }

    // Process each product
    productsData.forEach((product) => {
      // Skip products already in menu
      if (currentProductIds.includes(product.id)) return;

      const stats = productStats[product.id];
      const basePrice = product.base_price || 0;
      const costPrice = product.cost_price || 0;
      const createdAt = new Date(product.created_at);
      const daysAgo = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate margin
      const marginPercent = basePrice > 0 && costPrice > 0
        ? ((basePrice - costPrice) / basePrice) * 100
        : 0;

      // Determine primary recommendation reason based on scoring
      let primaryReason: RecommendationReason = 'popular';
      let score = 0;

      // Check for new arrival (within 14 days)
      if (daysAgo <= 14) {
        primaryReason = 'new_arrival';
        score = 100 - daysAgo * 5; // Newer = higher score
      }

      // Check for high margin (> 40%)
      if (marginPercent >= 40) {
        if (score < marginPercent) {
          primaryReason = 'high_margin';
          score = marginPercent;
        }
      }

      // Check for popular (high order count)
      if (stats && stats.orders > 5) {
        const popularityScore = Math.min(stats.orders * 2, 100);
        if (score < popularityScore) {
          primaryReason = 'popular';
          score = popularityScore;
        }
      }

      // Check for frequently bought together with current menu products
      if (stats && currentProductIds.length > 0) {
        let coOccurrenceScore = 0;
        const frequentlyBoughtWith: string[] = [];

        currentProductIds.forEach((currentId) => {
          if (stats.coOccurrences[currentId] && stats.coOccurrences[currentId] >= 2) {
            coOccurrenceScore += stats.coOccurrences[currentId] * 10;
            const matchingProduct = productsData.find((p) => p.id === currentId);
            if (matchingProduct) {
              frequentlyBoughtWith.push(matchingProduct.product_name);
            }
          }
        });

        if (coOccurrenceScore > score && frequentlyBoughtWith.length > 0) {
          primaryReason = 'frequently_bought_together';
          score = coOccurrenceScore;

          allRecommendations.push({
            id: product.id,
            name: product.product_name,
            price: basePrice,
            imageUrl: product.image_url,
            category: product.category,
            sku: product.sku,
            reason: primaryReason,
            score,
            stats: {
              ordersCount: stats?.orders || 0,
              revenue: stats?.revenue || 0,
              marginPercent,
              createdDaysAgo: daysAgo,
              frequentlyBoughtWith,
            },
          });
          return;
        }
      }

      // Only add if it has some meaningful score
      if (score > 0 || stats?.orders || marginPercent > 20 || daysAgo <= 30) {
        allRecommendations.push({
          id: product.id,
          name: product.product_name,
          price: basePrice,
          imageUrl: product.image_url,
          category: product.category,
          sku: product.sku,
          reason: primaryReason,
          score: score || (stats?.orders || 0) * 2 + marginPercent,
          stats: {
            ordersCount: stats?.orders || 0,
            revenue: stats?.revenue || 0,
            marginPercent,
            createdDaysAgo: daysAgo,
          },
        });
      }
    });

    // Sort by score descending
    return allRecommendations.sort((a, b) => b.score - a.score);
  }, [productsData, ordersData, currentProductIds]);

  // Filter by active tab
  const filteredRecommendations = useMemo(() => {
    if (activeTab === 'all') {
      return recommendations.slice(0, 20);
    }
    return recommendations.filter((r) => r.reason === activeTab).slice(0, 10);
  }, [recommendations, activeTab]);

  // Count by reason
  const countByReason = useMemo(() => {
    const counts: Record<RecommendationReason, number> = {
      popular: 0,
      frequently_bought_together: 0,
      high_margin: 0,
      new_arrival: 0,
    };

    recommendations.forEach((r) => {
      counts[r.reason]++;
    });

    return counts;
  }, [recommendations]);

  // Handle add product
  const handleAddProduct = useCallback((productId: string) => {
    onAddProduct(productId);
    logger.debug('Product added from recommendations', { productId, menuId }, { component: 'MenuProductRecommendations' });
  }, [onAddProduct, menuId]);

  // Loading state
  const isLoading = productsLoading || ordersLoading;

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (productsError) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">Unable to load recommendations</p>
          <p className="text-xs mt-1">Please try again later</p>
        </div>
      </Card>
    );
  }

  // Empty state
  if (recommendations.length === 0) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center text-muted-foreground">
          <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">No recommendations available</p>
          <p className="text-xs mt-1">
            {currentProductIds.length === 0
              ? 'Add products to your menu to see recommendations'
              : 'All available products are already in your menu'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Product Recommendations</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-11 w-11 p-0">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Recommendations are based on order analytics, product margins, and purchase patterns.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Suggested products to optimize your menu for maximum revenue
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RecommendationReason | 'all')}>
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1 mb-4">
            <TabsTrigger value="all" className="text-xs">
              All ({recommendations.length})
            </TabsTrigger>
            {(Object.keys(REASON_CONFIG) as RecommendationReason[]).map((reason) => {
              const config = REASON_CONFIG[reason];
              const count = countByReason[reason];
              if (count === 0) return null;

              return (
                <TabsTrigger key={reason} value={reason} className="text-xs">
                  <config.icon className="w-3 h-3 mr-1" />
                  {config.label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="max-h-[400px]">
              {filteredRecommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recommendations in this category</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 pr-4">
                  {filteredRecommendations.map((product) => (
                    <RecommendationCard
                      key={product.id}
                      product={product}
                      isAdded={currentProductIds.includes(product.id)}
                      onAdd={() => handleAddProduct(product.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer tip */}
        <div className="mt-4 pt-3 border-t text-[10px] text-muted-foreground flex items-center gap-2">
          <RefreshCw className="w-3 h-3" />
          Recommendations update based on recent order data (last 30 days)
        </div>
      </CardContent>
    </Card>
  );
}
