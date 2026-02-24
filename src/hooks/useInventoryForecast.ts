/**
 * Inventory Forecast Hook
 *
 * Predicts when each product will go out of stock based on sales velocity.
 * Uses last 30 days order data for velocity calculation.
 *
 * Returns:
 * - forecast_stockout_date: Predicted date when stock will reach zero
 * - recommended_reorder_date: Date to place reorder (stockout - lead time buffer)
 * - recommended_reorder_quantity: Quantity to reorder based on velocity and buffer
 * - Warning badges for items approaching stockout
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type StockoutWarningLevel = 'critical' | 'warning' | 'soon' | 'healthy';

export interface InventoryForecast {
  productId: string;
  productName: string;
  sku: string | null;
  currentStock: number;
  reorderPoint: number;

  // Velocity metrics
  unitsPerDay: number;
  weeklyUnits: number;
  monthlyUnits: number;

  // Forecast dates
  forecastStockoutDate: Date | null;
  recommendedReorderDate: Date | null;
  daysUntilStockout: number;
  daysUntilReorderNeeded: number;

  // Reorder recommendation
  recommendedReorderQuantity: number;

  // Warning level
  warningLevel: StockoutWarningLevel;
  warningMessage: string;

  // Additional metadata
  hasRecentSales: boolean;
  lastSaleDate: Date | null;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
}

export interface UseInventoryForecastOptions {
  productId: string | undefined;
  leadTimeDays?: number; // Default buffer days before stockout to reorder
  targetStockDays?: number; // How many days of stock to maintain
  enabled?: boolean;
}

export interface UseInventoryForecastResult {
  forecast: InventoryForecast | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseBulkInventoryForecastOptions {
  productIds?: string[]; // If not provided, fetches all products
  leadTimeDays?: number;
  targetStockDays?: number;
  onlyAtRisk?: boolean; // Filter to only show at-risk items
  enabled?: boolean;
}

export interface UseBulkInventoryForecastResult {
  forecasts: InventoryForecast[];
  atRiskCount: number;
  criticalCount: number;
  warningCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LEAD_TIME_DAYS = 7; // Days needed to receive new stock
const DEFAULT_TARGET_STOCK_DAYS = 30; // Maintain 30 days of stock
const TREND_THRESHOLD = 0.15; // 15% change considered significant
const DAYS_IN_ANALYSIS_PERIOD = 30;

// ============================================================================
// Query Key Factory
// ============================================================================

const forecastQueryKeys = {
  all: ['inventory-forecast'] as const,
  single: (tenantId?: string, productId?: string) =>
    [...forecastQueryKeys.all, 'single', tenantId, productId] as const,
  bulk: (tenantId?: string, options?: { productIds?: string[]; onlyAtRisk?: boolean }) =>
    [...forecastQueryKeys.all, 'bulk', tenantId, options?.productIds?.join(','), options?.onlyAtRisk] as const,
  dashboard: (tenantId?: string) =>
    [...forecastQueryKeys.all, 'dashboard', tenantId] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateWarningLevel(
  daysUntilStockout: number,
  currentStock: number,
  reorderPoint: number
): StockoutWarningLevel {
  // Already out of stock or at zero
  if (currentStock <= 0) {
    return 'critical';
  }

  // Below reorder point
  if (currentStock <= reorderPoint) {
    return 'critical';
  }

  // Will run out in 3 days or less
  if (daysUntilStockout <= 3) {
    return 'critical';
  }

  // Will run out in 7 days or less
  if (daysUntilStockout <= 7) {
    return 'warning';
  }

  // Will run out in 14 days or less
  if (daysUntilStockout <= 14) {
    return 'soon';
  }

  return 'healthy';
}

function getWarningMessage(
  warningLevel: StockoutWarningLevel,
  daysUntilStockout: number,
  currentStock: number
): string {
  if (currentStock <= 0) {
    return 'Out of stock - immediate reorder required';
  }

  switch (warningLevel) {
    case 'critical':
      return daysUntilStockout <= 0
        ? 'Stock critically low - reorder immediately'
        : `Stock will run out in ${daysUntilStockout} day${daysUntilStockout === 1 ? '' : 's'}`;
    case 'warning':
      return `Approaching stockout in ${daysUntilStockout} days - consider reordering`;
    case 'soon':
      return `Stock projected to last ${daysUntilStockout} days`;
    case 'healthy':
      return daysUntilStockout >= 999
        ? 'Stock levels healthy - no recent sales activity'
        : `Adequate stock for ${daysUntilStockout}+ days`;
    default:
      return 'Stock status unknown';
  }
}

function calculateTrendDirection(
  firstHalfSales: number,
  secondHalfSales: number
): 'increasing' | 'decreasing' | 'stable' {
  if (firstHalfSales === 0 && secondHalfSales === 0) {
    return 'stable';
  }

  if (firstHalfSales === 0) {
    return 'increasing';
  }

  const changeRatio = (secondHalfSales - firstHalfSales) / firstHalfSales;

  if (changeRatio > TREND_THRESHOLD) {
    return 'increasing';
  }

  if (changeRatio < -TREND_THRESHOLD) {
    return 'decreasing';
  }

  return 'stable';
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function calculateReorderQuantity(
  unitsPerDay: number,
  targetStockDays: number,
  currentStock: number,
  reorderPoint: number
): number {
  // Calculate target stock level
  const targetStock = Math.max(
    unitsPerDay * targetStockDays,
    reorderPoint * 2 // At minimum, order enough to get to 2x reorder point
  );

  // Quantity needed to reach target
  const quantityNeeded = Math.ceil(targetStock - currentStock);

  // Round up to nearest 10 for practical ordering
  return Math.max(quantityNeeded, 0);
}

// ============================================================================
// Main Hook: useInventoryForecast
// ============================================================================

/**
 * Hook to calculate inventory forecast for a single product.
 * Predicts stockout date and recommends reorder timing/quantity.
 */
export function useInventoryForecast({
  productId,
  leadTimeDays = DEFAULT_LEAD_TIME_DAYS,
  targetStockDays = DEFAULT_TARGET_STOCK_DAYS,
  enabled = true,
}: UseInventoryForecastOptions): UseInventoryForecastResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: forecastQueryKeys.single(tenantId, productId),
    queryFn: async (): Promise<InventoryForecast | null> => {
      if (!tenantId || !productId) {
        return null;
      }

      logger.debug('Calculating inventory forecast', {
        component: 'useInventoryForecast',
        productId,
        tenantId,
      });

      // Fetch product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, sku, available_quantity, stock_quantity, low_stock_alert')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (productError) {
        logger.error('Failed to fetch product for forecast', productError, {
          component: 'useInventoryForecast',
          productId,
        });
        throw productError;
      }

      if (!product) {
        logger.warn('Product not found for forecast', {
          component: 'useInventoryForecast',
          productId,
        });
        return null;
      }

      // Calculate date ranges
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - DAYS_IN_ANALYSIS_PERIOD * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Fetch order items for this product from the last 30 days
      const { data: orderItems, error: orderError } = await supabase
        .from('unified_order_items')
        .select(`
          quantity,
          product_id,
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
        logger.error('Failed to fetch order items for forecast', orderError, {
          component: 'useInventoryForecast',
          productId,
        });
        throw orderError;
      }

      // Calculate sales metrics
      let monthlyUnits = 0;
      let weeklyUnits = 0;
      let firstHalfUnits = 0;
      let secondHalfUnits = 0;
      let lastSaleDate: Date | null = null;

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
        if (!lastSaleDate || orderDate > lastSaleDate) {
          lastSaleDate = orderDate;
        }
      }

      // Calculate velocity metrics
      const unitsPerDay = monthlyUnits / DAYS_IN_ANALYSIS_PERIOD;
      const productData = product as {
        id: string;
        name: string;
        sku: string | null;
        available_quantity: number | null;
        stock_quantity: number | null;
        low_stock_alert: number | null;
      };
      const currentStock = productData.available_quantity ?? productData.stock_quantity ?? 0;
      const reorderPoint = productData.low_stock_alert ?? 10;

      // Calculate days until stockout
      const daysUntilStockout =
        unitsPerDay > 0 ? Math.floor(currentStock / unitsPerDay) : 999;

      // Calculate forecast dates
      let forecastStockoutDate: Date | null = null;
      let recommendedReorderDate: Date | null = null;
      let daysUntilReorderNeeded = 999;

      if (unitsPerDay > 0 && daysUntilStockout < 999) {
        forecastStockoutDate = addDays(now, daysUntilStockout);

        // Recommend reordering leadTimeDays before stockout
        daysUntilReorderNeeded = Math.max(0, daysUntilStockout - leadTimeDays);
        recommendedReorderDate = addDays(now, daysUntilReorderNeeded);
      }

      // Calculate recommended reorder quantity
      const recommendedReorderQuantity = calculateReorderQuantity(
        unitsPerDay,
        targetStockDays,
        currentStock,
        reorderPoint
      );

      // Determine warning level and message
      const warningLevel = calculateWarningLevel(daysUntilStockout, currentStock, reorderPoint);
      const warningMessage = getWarningMessage(warningLevel, daysUntilStockout, currentStock);
      const trendDirection = calculateTrendDirection(firstHalfUnits, secondHalfUnits);

      const forecast: InventoryForecast = {
        productId: product.id,
        productName: productData.name,
        sku: productData.sku,
        currentStock,
        reorderPoint,
        unitsPerDay: Math.round(unitsPerDay * 100) / 100,
        weeklyUnits,
        monthlyUnits,
        forecastStockoutDate,
        recommendedReorderDate,
        daysUntilStockout,
        daysUntilReorderNeeded,
        recommendedReorderQuantity,
        warningLevel,
        warningMessage,
        hasRecentSales: monthlyUnits > 0,
        lastSaleDate,
        trendDirection,
      };

      logger.debug('Inventory forecast calculated', {
        component: 'useInventoryForecast',
        productId,
        daysUntilStockout,
        warningLevel,
      });

      return forecast;
    },
    enabled: enabled && !!tenantId && !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    forecast: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Bulk Hook: useBulkInventoryForecast
// ============================================================================

/**
 * Hook to calculate inventory forecasts for multiple products.
 * Can filter to only at-risk items for dashboard display.
 */
export function useBulkInventoryForecast({
  productIds,
  leadTimeDays = DEFAULT_LEAD_TIME_DAYS,
  targetStockDays = DEFAULT_TARGET_STOCK_DAYS,
  onlyAtRisk = false,
  enabled = true,
}: UseBulkInventoryForecastOptions = {}): UseBulkInventoryForecastResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: forecastQueryKeys.bulk(tenantId, { productIds, onlyAtRisk }),
    queryFn: async (): Promise<{
      forecasts: InventoryForecast[];
      atRiskCount: number;
      criticalCount: number;
      warningCount: number;
    }> => {
      if (!tenantId) {
        return { forecasts: [], atRiskCount: 0, criticalCount: 0, warningCount: 0 };
      }

      logger.debug('Calculating bulk inventory forecast', {
        component: 'useBulkInventoryForecast',
        productCount: productIds?.length ?? 'all',
        tenantId,
      });

      // Fetch products
      let productsQuery = supabase
        .from('products')
        .select('id, name, sku, available_quantity, stock_quantity, low_stock_alert')
        .eq('tenant_id', tenantId);

      if (productIds && productIds.length > 0) {
        productsQuery = productsQuery.in('id', productIds);
      }

      const { data: products, error: productsError } = await productsQuery;

      if (productsError) {
        logger.error('Failed to fetch products for bulk forecast', productsError, {
          component: 'useBulkInventoryForecast',
        });
        throw productsError;
      }

      if (!products || products.length === 0) {
        return { forecasts: [], atRiskCount: 0, criticalCount: 0, warningCount: 0 };
      }

      // Create product lookup
      const productLookup = new Map(
        products.map((p) => {
          const prod = p as {
            id: string;
            name: string;
            sku: string | null;
            available_quantity: number | null;
            stock_quantity: number | null;
            low_stock_alert: number | null;
          };
          return [
            prod.id,
            {
              name: prod.name,
              sku: prod.sku,
              stock: prod.available_quantity ?? prod.stock_quantity ?? 0,
              reorderPoint: prod.low_stock_alert ?? 10,
            },
          ];
        })
      );

      const productIdsList = products.map((p) => p.id);

      // Calculate date ranges
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - DAYS_IN_ANALYSIS_PERIOD * 24 * 60 * 60 * 1000);
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
        .in('product_id', productIdsList)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (orderError) {
        logger.error('Failed to fetch order items for bulk forecast', orderError, {
          component: 'useBulkInventoryForecast',
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
          lastSaleDate: Date | null;
        }
      >();

      // Initialize for all products
      for (const pid of productIdsList) {
        salesData.set(pid, {
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

        const pid = item.product_id;
        const productSales = salesData.get(pid);
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

        if (!productSales.lastSaleDate || orderDate > productSales.lastSaleDate) {
          productSales.lastSaleDate = orderDate;
        }
      }

      // Build forecasts
      const forecasts: InventoryForecast[] = [];
      let atRiskCount = 0;
      let criticalCount = 0;
      let warningCount = 0;

      for (const pid of productIdsList) {
        const productInfo = productLookup.get(pid);
        const sales = salesData.get(pid);

        if (!productInfo || !sales) continue;

        const unitsPerDay = sales.monthlyUnits / DAYS_IN_ANALYSIS_PERIOD;
        const daysUntilStockout =
          unitsPerDay > 0 ? Math.floor(productInfo.stock / unitsPerDay) : 999;

        // Calculate forecast dates
        let forecastStockoutDate: Date | null = null;
        let recommendedReorderDate: Date | null = null;
        let daysUntilReorderNeeded = 999;

        if (unitsPerDay > 0 && daysUntilStockout < 999) {
          forecastStockoutDate = addDays(now, daysUntilStockout);
          daysUntilReorderNeeded = Math.max(0, daysUntilStockout - leadTimeDays);
          recommendedReorderDate = addDays(now, daysUntilReorderNeeded);
        }

        const recommendedReorderQuantity = calculateReorderQuantity(
          unitsPerDay,
          targetStockDays,
          productInfo.stock,
          productInfo.reorderPoint
        );

        const warningLevel = calculateWarningLevel(
          daysUntilStockout,
          productInfo.stock,
          productInfo.reorderPoint
        );
        const warningMessage = getWarningMessage(warningLevel, daysUntilStockout, productInfo.stock);
        const trendDirection = calculateTrendDirection(
          sales.firstHalfUnits,
          sales.secondHalfUnits
        );

        // Count by warning level
        if (warningLevel === 'critical') {
          criticalCount++;
          atRiskCount++;
        } else if (warningLevel === 'warning') {
          warningCount++;
          atRiskCount++;
        } else if (warningLevel === 'soon') {
          atRiskCount++;
        }

        // Skip healthy items if only showing at-risk
        if (onlyAtRisk && warningLevel === 'healthy') {
          continue;
        }

        forecasts.push({
          productId: pid,
          productName: productInfo.name,
          sku: productInfo.sku,
          currentStock: productInfo.stock,
          reorderPoint: productInfo.reorderPoint,
          unitsPerDay: Math.round(unitsPerDay * 100) / 100,
          weeklyUnits: sales.weeklyUnits,
          monthlyUnits: sales.monthlyUnits,
          forecastStockoutDate,
          recommendedReorderDate,
          daysUntilStockout,
          daysUntilReorderNeeded,
          recommendedReorderQuantity,
          warningLevel,
          warningMessage,
          hasRecentSales: sales.monthlyUnits > 0,
          lastSaleDate: sales.lastSaleDate,
          trendDirection,
        });
      }

      // Sort by urgency (critical first, then by days until stockout)
      forecasts.sort((a, b) => {
        const levelOrder: Record<StockoutWarningLevel, number> = {
          critical: 0,
          warning: 1,
          soon: 2,
          healthy: 3,
        };

        const levelDiff = levelOrder[a.warningLevel] - levelOrder[b.warningLevel];
        if (levelDiff !== 0) return levelDiff;

        return a.daysUntilStockout - b.daysUntilStockout;
      });

      logger.debug('Bulk inventory forecast calculated', {
        component: 'useBulkInventoryForecast',
        totalProducts: forecasts.length,
        atRiskCount,
        criticalCount,
        warningCount,
      });

      return { forecasts, atRiskCount, criticalCount, warningCount };
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    forecasts: data?.forecasts ?? [],
    atRiskCount: data?.atRiskCount ?? 0,
    criticalCount: data?.criticalCount ?? 0,
    warningCount: data?.warningCount ?? 0,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Dashboard Hook: useInventoryForecastDashboard
// ============================================================================

/**
 * Optimized hook for dashboard display.
 * Returns only at-risk items with summary counts.
 */
export function useInventoryForecastDashboard(
  options: { limit?: number; enabled?: boolean } = {}
): UseBulkInventoryForecastResult & { topAtRisk: InventoryForecast[] } {
  const { limit = 5, enabled = true } = options;

  const result = useBulkInventoryForecast({
    onlyAtRisk: true,
    enabled,
  });

  return {
    ...result,
    topAtRisk: result.forecasts.slice(0, limit),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get badge variant based on warning level
 */
export function getWarningLevelBadgeVariant(
  level: StockoutWarningLevel
): 'destructive' | 'warning' | 'secondary' | 'default' {
  switch (level) {
    case 'critical':
      return 'destructive';
    case 'warning':
      return 'warning';
    case 'soon':
      return 'secondary';
    case 'healthy':
      return 'default';
    default:
      return 'default';
  }
}

/**
 * Get human-readable label for warning level
 */
export function getWarningLevelLabel(level: StockoutWarningLevel): string {
  switch (level) {
    case 'critical':
      return 'Critical';
    case 'warning':
      return 'Warning';
    case 'soon':
      return 'Monitor';
    case 'healthy':
      return 'Healthy';
    default:
      return 'Unknown';
  }
}

/**
 * Format date for display
 */
export function formatForecastDate(date: Date | null): string {
  if (!date) return 'N/A';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format days until stockout for display
 */
export function formatDaysUntilStockout(days: number): string {
  if (days <= 0) return 'Out of stock';
  if (days >= 999) return '30+ days';
  if (days === 1) return '1 day';
  return `${days} days`;
}
