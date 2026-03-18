/**
 * Product Velocity Hook
 *
 * Calculates how fast a product sells based on order history.
 * Used in product detail, inventory dashboard, and reorder suggestions.
 *
 * Returns:
 * - units_per_day: Average units sold per day (from last 30 days)
 * - days_until_stockout: Estimated days until stock reaches zero
 * - reorder_urgency: normal | soon | urgent | overdue
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type ReorderUrgency = 'normal' | 'soon' | 'urgent' | 'overdue';

export interface ProductVelocity {
  productId: string;
  productName: string;
  currentStock: number;
  unitsPerDay: number;
  weeklyUnits: number;
  monthlyUnits: number;
  daysUntilStockout: number;
  reorderUrgency: ReorderUrgency;
  lastSaleDate: string | null;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
}

export interface UseProductVelocityOptions {
  productId: string | undefined;
  enabled?: boolean;
}

export interface UseProductVelocityResult {
  velocity: ProductVelocity | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseBulkProductVelocityOptions {
  productIds: string[];
  enabled?: boolean;
}

export interface UseBulkProductVelocityResult {
  velocities: Map<string, ProductVelocity>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ============================================================================
// Query Key Factory
// ============================================================================

const velocityQueryKeys = {
  all: ['product-velocity'] as const,
  single: (tenantId?: string, productId?: string) =>
    [...velocityQueryKeys.all, 'single', tenantId, productId] as const,
  bulk: (tenantId?: string, productIds?: string[]) =>
    [...velocityQueryKeys.all, 'bulk', tenantId, productIds?.join(',')] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateReorderUrgency(
  daysUntilStockout: number,
  currentStock: number
): ReorderUrgency {
  // Already out of stock
  if (currentStock <= 0) {
    return 'overdue';
  }

  // Will run out in 3 days or less
  if (daysUntilStockout <= 3) {
    return 'urgent';
  }

  // Will run out in 7 days or less
  if (daysUntilStockout <= 7) {
    return 'soon';
  }

  return 'normal';
}

function calculateTrendDirection(
  firstHalfSales: number,
  secondHalfSales: number
): 'increasing' | 'decreasing' | 'stable' {
  // Compare first 15 days vs last 15 days of the 30-day period
  const threshold = 0.1; // 10% difference considered significant

  if (firstHalfSales === 0 && secondHalfSales === 0) {
    return 'stable';
  }

  if (firstHalfSales === 0) {
    return 'increasing';
  }

  const changeRatio = (secondHalfSales - firstHalfSales) / firstHalfSales;

  if (changeRatio > threshold) {
    return 'increasing';
  }

  if (changeRatio < -threshold) {
    return 'decreasing';
  }

  return 'stable';
}

// ============================================================================
// Main Hook: useProductVelocity
// ============================================================================

/**
 * Hook to calculate sales velocity for a single product.
 * Returns units_per_day, days_until_stockout, and reorder_urgency.
 */
export function useProductVelocity({
  productId,
  enabled = true,
}: UseProductVelocityOptions): UseProductVelocityResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: velocityQueryKeys.single(tenantId, productId),
    queryFn: async (): Promise<ProductVelocity | null> => {
      if (!tenantId || !productId) {
        return null;
      }

      logger.debug('Calculating product velocity', {
        component: 'useProductVelocity',
        productId,
        tenantId,
      });

      // Fetch product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, available_quantity, stock_quantity')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (productError) {
        logger.error('Failed to fetch product for velocity calculation', productError, {
          component: 'useProductVelocity',
          productId,
        });
        throw productError;
      }

      if (!product) {
        logger.warn('Product not found for velocity calculation', {
          component: 'useProductVelocity',
          productId,
        });
        return null;
      }

      // Calculate date ranges
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Fetch order items for this product from the last 30 days
      const { data: orderItems, error: orderError } = await supabase
        .from('unified_order_items')
        .select(`
          quantity,
          created_at,
          order:unified_orders!inner(
            id,
            tenant_id,
            status,
            created_at
          )
        `)
        .eq('product_id', productId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (orderError) {
        logger.error('Failed to fetch order items for velocity calculation', orderError, {
          component: 'useProductVelocity',
          productId,
        });
        throw orderError;
      }

      // Filter by tenant_id and calculate sales
      let monthlyUnits = 0;
      let weeklyUnits = 0;
      let firstHalfUnits = 0;
      let secondHalfUnits = 0;
      let lastSaleDate: string | null = null;

      const validStatuses = ['completed', 'delivered', 'processing', 'confirmed'];

      for (const item of orderItems ?? []) {
        const order = item.order as unknown as {
          id: string;
          tenant_id: string;
          status: string;
          created_at: string;
        };

        // Filter by tenant
        if (order.tenant_id !== tenantId) {
          continue;
        }

        // Only count orders that are in valid statuses
        if (!validStatuses.includes(order.status?.toLowerCase() ?? '')) {
          continue;
        }

        const orderDate = new Date(order.created_at);
        const quantity = item.quantity ?? 0;

        monthlyUnits += quantity;

        // Track weekly sales
        if (orderDate >= sevenDaysAgo) {
          weeklyUnits += quantity;
        }

        // Track first half vs second half for trend analysis
        if (orderDate < fifteenDaysAgo) {
          firstHalfUnits += quantity;
        } else {
          secondHalfUnits += quantity;
        }

        // Track most recent sale
        if (!lastSaleDate || order.created_at > lastSaleDate) {
          lastSaleDate = order.created_at;
        }
      }

      // Calculate velocity metrics
      const unitsPerDay = monthlyUnits / 30;
      const currentStock =
        (product as { available_quantity: number | null; stock_quantity: number | null })
          .available_quantity ??
        (product as { available_quantity: number | null; stock_quantity: number | null })
          .stock_quantity ??
        0;

      // Calculate days until stockout
      // If no sales, use infinity (999 days as practical max)
      const daysUntilStockout =
        unitsPerDay > 0 ? Math.round(currentStock / unitsPerDay) : 999;

      // Determine urgency and trend
      const reorderUrgency = calculateReorderUrgency(daysUntilStockout, currentStock);
      const trendDirection = calculateTrendDirection(firstHalfUnits, secondHalfUnits);

      const velocity: ProductVelocity = {
        productId: product.id,
        productName: product.name,
        currentStock,
        unitsPerDay: Math.round(unitsPerDay * 100) / 100, // 2 decimal places
        weeklyUnits,
        monthlyUnits,
        daysUntilStockout,
        reorderUrgency,
        lastSaleDate,
        trendDirection,
      };

      logger.debug('Product velocity calculated', {
        component: 'useProductVelocity',
        productId,
        velocity,
      });

      return velocity;
    },
    enabled: enabled && !!tenantId && !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    velocity: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Bulk Hook: useBulkProductVelocity
// ============================================================================

/**
 * Hook to calculate sales velocity for multiple products at once.
 * More efficient than calling useProductVelocity multiple times.
 */
export function useBulkProductVelocity({
  productIds,
  enabled = true,
}: UseBulkProductVelocityOptions): UseBulkProductVelocityResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: velocityQueryKeys.bulk(tenantId, productIds),
    queryFn: async (): Promise<Map<string, ProductVelocity>> => {
      const velocityMap = new Map<string, ProductVelocity>();

      if (!tenantId || productIds.length === 0) {
        return velocityMap;
      }

      logger.debug('Calculating bulk product velocity', {
        component: 'useBulkProductVelocity',
        productCount: productIds.length,
        tenantId,
      });

      // Fetch all products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, available_quantity, stock_quantity')
        .in('id', productIds)
        .eq('tenant_id', tenantId);

      if (productsError) {
        logger.error('Failed to fetch products for bulk velocity calculation', productsError, {
          component: 'useBulkProductVelocity',
        });
        throw productsError;
      }

      if (!products || products.length === 0) {
        return velocityMap;
      }

      // Create product lookup
      const productLookup = new Map(
        products.map((p) => [
          p.id,
          {
            name: p.name,
            stock:
              (p as { available_quantity: number | null; stock_quantity: number | null })
                .available_quantity ??
              (p as { available_quantity: number | null; stock_quantity: number | null })
                .stock_quantity ??
              0,
          },
        ])
      );

      // Calculate date ranges
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Fetch all order items for these products
      const { data: orderItems, error: orderError } = await supabase
        .from('unified_order_items')
        .select(`
          product_id,
          quantity,
          created_at,
          order:unified_orders!inner(
            id,
            tenant_id,
            status,
            created_at
          )
        `)
        .in('product_id', productIds)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (orderError) {
        logger.error('Failed to fetch order items for bulk velocity calculation', orderError, {
          component: 'useBulkProductVelocity',
        });
        throw orderError;
      }

      // Aggregate sales data per product
      const salesData = new Map<
        string,
        {
          monthlyUnits: number;
          weeklyUnits: number;
          firstHalfUnits: number;
          secondHalfUnits: number;
          lastSaleDate: string | null;
        }
      >();

      // Initialize for all products
      for (const productId of productIds) {
        salesData.set(productId, {
          monthlyUnits: 0,
          weeklyUnits: 0,
          firstHalfUnits: 0,
          secondHalfUnits: 0,
          lastSaleDate: null,
        });
      }

      const validStatuses = ['completed', 'delivered', 'processing', 'confirmed'];

      for (const item of orderItems ?? []) {
        const order = item.order as unknown as {
          id: string;
          tenant_id: string;
          status: string;
          created_at: string;
        };

        // Filter by tenant
        if (order.tenant_id !== tenantId) {
          continue;
        }

        // Only count valid orders
        if (!validStatuses.includes(order.status?.toLowerCase() ?? '')) {
          continue;
        }

        const productId = item.product_id;
        const productSales = salesData.get(productId);
        if (!productSales) continue;

        const orderDate = new Date(order.created_at);
        const quantity = item.quantity ?? 0;

        productSales.monthlyUnits += quantity;

        if (orderDate >= sevenDaysAgo) {
          productSales.weeklyUnits += quantity;
        }

        if (orderDate < fifteenDaysAgo) {
          productSales.firstHalfUnits += quantity;
        } else {
          productSales.secondHalfUnits += quantity;
        }

        if (!productSales.lastSaleDate || order.created_at > productSales.lastSaleDate) {
          productSales.lastSaleDate = order.created_at;
        }
      }

      // Build velocity objects
      for (const productId of productIds) {
        const productInfo = productLookup.get(productId) as { name: string; stock: number } | undefined;
        const sales = salesData.get(productId);

        if (!productInfo || !sales) continue;

        const unitsPerDay = sales.monthlyUnits / 30;
        const daysUntilStockout =
          unitsPerDay > 0 ? Math.round(productInfo.stock / unitsPerDay) : 999;
        const reorderUrgency = calculateReorderUrgency(daysUntilStockout, productInfo.stock);
        const trendDirection = calculateTrendDirection(
          sales.firstHalfUnits,
          sales.secondHalfUnits
        );

        velocityMap.set(productId, {
          productId,
          productName: productInfo.name,
          currentStock: productInfo.stock,
          unitsPerDay: Math.round(unitsPerDay * 100) / 100,
          weeklyUnits: sales.weeklyUnits,
          monthlyUnits: sales.monthlyUnits,
          daysUntilStockout,
          reorderUrgency,
          lastSaleDate: sales.lastSaleDate,
          trendDirection,
        });
      }

      logger.debug('Bulk product velocity calculated', {
        component: 'useBulkProductVelocity',
        productCount: velocityMap.size,
      });

      return velocityMap;
    },
    enabled: enabled && !!tenantId && productIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    velocities: data ?? new Map(),
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Utility Hook: useProductVelocityLabel
// ============================================================================

/**
 * Returns human-readable labels for velocity data.
 * Useful for UI display.
 */
export function getVelocityUrgencyLabel(urgency: ReorderUrgency): string {
  switch (urgency) {
    case 'overdue':
      return 'Out of Stock';
    case 'urgent':
      return 'Reorder Urgent';
    case 'soon':
      return 'Reorder Soon';
    case 'normal':
      return 'Stock OK';
    default:
      return 'Unknown';
  }
}

export function getVelocityUrgencyColor(urgency: ReorderUrgency): string {
  switch (urgency) {
    case 'overdue':
      return 'destructive';
    case 'urgent':
      return 'destructive';
    case 'soon':
      return 'warning';
    case 'normal':
      return 'default';
    default:
      return 'secondary';
  }
}

export function getTrendLabel(trend: ProductVelocity['trendDirection']): string {
  switch (trend) {
    case 'increasing':
      return 'Sales Increasing';
    case 'decreasing':
      return 'Sales Decreasing';
    case 'stable':
      return 'Sales Stable';
    default:
      return 'Unknown';
  }
}

export function getTrendIcon(trend: ProductVelocity['trendDirection']): string {
  switch (trend) {
    case 'increasing':
      return '↑';
    case 'decreasing':
      return '↓';
    case 'stable':
      return '→';
    default:
      return '?';
  }
}
