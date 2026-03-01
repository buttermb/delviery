/**
 * Auto-Reorder Hook
 *
 * Monitors inventory levels and generates reorder recommendations based on:
 * - Current stock vs low_stock_threshold
 * - Sales velocity calculated from recent order items
 * - Suggested quantity based on average daily sales
 *
 * Used by ProductDetailsPage and Dashboard widgets to show reorder suggestions
 * with one-click purchase order creation.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export interface SalesVelocity {
  dailyAverage: number;
  weeklyTotal: number;
  monthlyTotal: number;
  daysOfStockRemaining: number;
}

export interface ReorderSuggestion {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  category: string | null;
  currentStock: number;
  lowStockThreshold: number;
  vendorId: string | null;
  vendorName: string | null;
  costPerUnit: number | null;
  salesVelocity: SalesVelocity;
  suggestedQuantity: number;
  estimatedCost: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

export interface AutoReorderSummary {
  suggestions: ReorderSuggestion[];
  criticalCount: number;
  highCount: number;
  totalEstimatedCost: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface ProductReorderInfo {
  suggestion: ReorderSuggestion | null;
  isLoading: boolean;
  error: Error | null;
}

// ============================================================================
// Query Key Factory Extension
// ============================================================================

const reorderQueryKeys = {
  all: ['reorder'] as const,
  suggestions: (tenantId?: string) => [...reorderQueryKeys.all, 'suggestions', tenantId] as const,
  productSuggestion: (tenantId?: string, productId?: string) =>
    [...reorderQueryKeys.all, 'product', tenantId, productId] as const,
  salesVelocity: (tenantId?: string, productId?: string) =>
    [...reorderQueryKeys.all, 'velocity', tenantId, productId] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculatePriority(
  currentStock: number,
  threshold: number,
  daysRemaining: number
): ReorderSuggestion['priority'] {
  // Out of stock or will run out in 3 days
  if (currentStock <= 0 || daysRemaining <= 3) {
    return 'critical';
  }
  // Below threshold or will run out in a week
  if (currentStock <= threshold || daysRemaining <= 7) {
    return 'high';
  }
  // Approaching threshold or will run out in 2 weeks
  if (currentStock <= threshold * 1.5 || daysRemaining <= 14) {
    return 'medium';
  }
  return 'low';
}

function generateReason(
  currentStock: number,
  threshold: number,
  daysRemaining: number
): string {
  if (currentStock <= 0) {
    return 'Out of stock';
  }
  if (daysRemaining <= 3) {
    return `Stock will run out in ~${Math.ceil(daysRemaining)} days`;
  }
  if (currentStock <= threshold) {
    return `Below reorder threshold (${threshold} units)`;
  }
  if (daysRemaining <= 7) {
    return `Less than a week of stock remaining`;
  }
  if (currentStock <= threshold * 1.5) {
    return 'Approaching reorder threshold';
  }
  return 'Proactive reorder recommendation';
}

function calculateSuggestedQuantity(
  dailyAverage: number,
  currentStock: number,
  threshold: number
): number {
  // Target: 30 days of stock, minimum of threshold * 2
  const targetStock = Math.max(dailyAverage * 30, threshold * 2);
  const needed = Math.ceil(targetStock - currentStock);
  // Minimum order of 1 unit, round up to nearest 5 for convenience
  return Math.max(1, Math.ceil(needed / 5) * 5);
}

// ============================================================================
// Main Hook: useAutoReorder
// ============================================================================

/**
 * Hook to get all reorder suggestions for a tenant.
 * Monitors all products below their low_stock_threshold and calculates
 * suggested reorder quantities based on sales velocity.
 */
export function useAutoReorder(): AutoReorderSummary {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: reorderQueryKeys.suggestions(tenantId),
    queryFn: async (): Promise<ReorderSuggestion[]> => {
      if (!tenantId) return [];

      // Fetch products at or below low stock threshold
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, category, available_quantity, stock_quantity, low_stock_alert, vendor_id, vendor_name, cost_per_unit')
        .eq('tenant_id', tenantId)
        .or('available_quantity.lte.low_stock_alert,available_quantity.eq.0,available_quantity.is.null')
        .order('available_quantity', { ascending: true });

      if (productsError) {
        logger.error('Failed to fetch low stock products for reorder', productsError, { tenantId });
        throw productsError;
      }

      if (!products || products.length === 0) {
        return [];
      }

      // Get sales data for the past 30 days to calculate velocity
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const productIds = products.map((p) => p.id);

      const { data: salesData, error: salesError } = await supabase
        .from('order_items')
        .select('product_id, quantity, created_at')
        .in('product_id', productIds)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (salesError) {
        logger.warn('Could not fetch sales data for velocity calculation', { error: salesError });
        // Continue without sales data - we'll use default velocity
      }

      // Calculate velocity per product
      const velocityMap = new Map<string, { weeklyTotal: number; monthlyTotal: number }>();

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      (salesData ?? []).forEach((item) => {
        const existing = velocityMap.get(item.product_id) || { weeklyTotal: 0, monthlyTotal: 0 };
        existing.monthlyTotal += item.quantity ?? 0;

        if (new Date(item.created_at) >= sevenDaysAgo) {
          existing.weeklyTotal += item.quantity ?? 0;
        }

        velocityMap.set(item.product_id, existing);
      });

      // Build suggestions
      const suggestions: ReorderSuggestion[] = products
        .filter((p) => {
          const available = p.available_quantity ?? p.stock_quantity ?? 0;
          const threshold = p.low_stock_alert ?? 10;
          return available <= threshold * 1.5; // Include products approaching threshold
        })
        .map((product) => {
          const currentStock = product.available_quantity ?? product.stock_quantity ?? 0;
          const threshold = product.low_stock_alert ?? 10;
          const velocity = velocityMap.get(product.id) || { weeklyTotal: 0, monthlyTotal: 0 };

          const dailyAverage = velocity.monthlyTotal / 30;
          const daysRemaining = dailyAverage > 0 ? currentStock / dailyAverage : 999;

          const salesVelocity: SalesVelocity = {
            dailyAverage: Math.round(dailyAverage * 10) / 10,
            weeklyTotal: velocity.weeklyTotal,
            monthlyTotal: velocity.monthlyTotal,
            daysOfStockRemaining: Math.round(daysRemaining),
          };

          const suggestedQuantity = calculateSuggestedQuantity(dailyAverage, currentStock, threshold);
          const priority = calculatePriority(currentStock, threshold, daysRemaining);
          const reason = generateReason(currentStock, threshold, daysRemaining);
          const estimatedCost = suggestedQuantity * (product.cost_per_unit ?? 0);

          return {
            id: `reorder-${product.id}`,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            category: product.category,
            currentStock,
            lowStockThreshold: threshold,
            vendorId: product.vendor_id,
            vendorName: product.vendor_name,
            costPerUnit: product.cost_per_unit,
            salesVelocity,
            suggestedQuantity,
            estimatedCost,
            priority,
            reason,
          };
        })
        // Sort by priority (critical first) then by days remaining
        .sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.salesVelocity.daysOfStockRemaining - b.salesVelocity.daysOfStockRemaining;
        });

      return suggestions;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  const suggestions = useMemo(() => data ?? [], [data]);

  const summary = useMemo(() => {
    const critical = suggestions.filter((s) => s.priority === 'critical');
    const high = suggestions.filter((s) => s.priority === 'high');
    const totalCost = suggestions.reduce((sum, s) => sum + s.estimatedCost, 0);

    return {
      criticalCount: critical.length,
      highCount: high.length,
      totalEstimatedCost: totalCost,
    };
  }, [suggestions]);

  return {
    suggestions,
    ...summary,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Hook: useProductReorder
// ============================================================================

/**
 * Hook to get reorder information for a specific product.
 * Shows if the product needs reordering and provides suggestion details.
 */
export function useProductReorder(productId: string | undefined): ProductReorderInfo {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: reorderQueryKeys.productSuggestion(tenantId, productId),
    queryFn: async (): Promise<ReorderSuggestion | null> => {
      if (!tenantId || !productId) return null;

      // Fetch product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, sku, category, available_quantity, stock_quantity, low_stock_alert, vendor_id, vendor_name, cost_per_unit')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (productError) {
        logger.error('Failed to fetch product for reorder check', productError, { productId, tenantId });
        throw productError;
      }

      if (!product) return null;

      const currentStock = product.available_quantity ?? product.stock_quantity ?? 0;
      const threshold = product.low_stock_alert ?? 10;

      // Only return suggestion if below or near threshold
      if (currentStock > threshold * 1.5) {
        return null;
      }

      // Get sales velocity for this product
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: salesData } = await supabase
        .from('order_items')
        .select('quantity, created_at')
        .eq('product_id', productId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let weeklyTotal = 0;
      let monthlyTotal = 0;

      (salesData ?? []).forEach((item) => {
        monthlyTotal += item.quantity ?? 0;
        if (new Date(item.created_at) >= sevenDaysAgo) {
          weeklyTotal += item.quantity ?? 0;
        }
      });

      const dailyAverage = monthlyTotal / 30;
      const daysRemaining = dailyAverage > 0 ? currentStock / dailyAverage : 999;

      const salesVelocity: SalesVelocity = {
        dailyAverage: Math.round(dailyAverage * 10) / 10,
        weeklyTotal,
        monthlyTotal,
        daysOfStockRemaining: Math.round(daysRemaining),
      };

      const suggestedQuantity = calculateSuggestedQuantity(dailyAverage, currentStock, threshold);
      const priority = calculatePriority(currentStock, threshold, daysRemaining);
      const reason = generateReason(currentStock, threshold, daysRemaining);
      const estimatedCost = suggestedQuantity * (product.cost_per_unit ?? 0);

      return {
        id: `reorder-${product.id}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        currentStock,
        lowStockThreshold: threshold,
        vendorId: product.vendor_id,
        vendorName: product.vendor_name,
        costPerUnit: product.cost_per_unit,
        salesVelocity,
        suggestedQuantity,
        estimatedCost,
        priority,
        reason,
      };
    },
    enabled: !!tenantId && !!productId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    suggestion: data ?? null,
    isLoading,
    error: error as Error | null,
  };
}

// ============================================================================
// Hook: useCreateReorderPO
// ============================================================================

/**
 * Mutation hook to create a purchase order from a reorder suggestion.
 * Provides one-click PO creation functionality.
 */
export function useCreateReorderPO() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestion: ReorderSuggestion) => {
      if (!tenant?.id) {
        throw new Error('No tenant context');
      }

      if (!suggestion.vendorId) {
        throw new Error('No vendor associated with this product');
      }

      logger.info('Creating purchase order from reorder suggestion', {
        component: 'useCreateReorderPO',
        productId: suggestion.productId,
        quantity: suggestion.suggestedQuantity,
      });

      const { data, error } = await supabase.functions.invoke('create-purchase-order', {
        body: {
          supplier_id: suggestion.vendorId,
          notes: `Auto-generated reorder: ${suggestion.reason}`,
          items: [
            {
              product_id: suggestion.productId,
              quantity_lbs: suggestion.suggestedQuantity,
              unit_cost: suggestion.costPerUnit || 0,
            },
          ],
        },
      });

      if (error) {
        logger.error('Failed to create reorder PO', error, { component: 'useCreateReorderPO' });
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      queryClient.invalidateQueries({ queryKey: reorderQueryKeys.suggestions(tenant?.id) });

      toast.success(
        `Purchase order ${data.purchase_order?.po_number ?? ''} created successfully`
      );
    },
    onError: (error: Error) => {
      logger.error('Reorder PO creation failed', error, { component: 'useCreateReorderPO' });
      toast.error(humanizeError(error, 'Failed to create purchase order'));
    },
  });
}
