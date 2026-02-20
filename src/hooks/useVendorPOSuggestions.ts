/**
 * Vendor Auto-PO Suggestions Hook
 *
 * Based on inventory forecasting, auto-generates PO suggestions.
 * When multiple products from the same vendor are approaching reorder point,
 * suggests a consolidated PO with estimated cost and recommended quantities
 * based on sales velocity.
 *
 * Features:
 * - Groups products by vendor
 * - Uses inventory forecast data for recommendations
 * - Calculates estimated costs
 * - Provides one-click draft PO creation
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import {
  useBulkInventoryForecast,
  type InventoryForecast,
  type StockoutWarningLevel,
} from '@/hooks/useInventoryForecast';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export interface ProductWithVendor {
  productId: string;
  productName: string;
  sku: string | null;
  vendorId: string;
  vendorName: string;
  currentStock: number;
  reorderPoint: number;
  recommendedQuantity: number;
  unitCost: number;
  estimatedCost: number;
  daysUntilStockout: number;
  warningLevel: StockoutWarningLevel;
  salesVelocity: number; // units per day
}

export interface VendorPOSuggestion {
  vendorId: string;
  vendorName: string;
  products: ProductWithVendor[];
  totalProducts: number;
  totalEstimatedCost: number;
  urgencyLevel: StockoutWarningLevel;
  recommendedOrderDate: Date | null;
  avgDaysUntilStockout: number;
}

export interface UseVendorPOSuggestionsResult {
  suggestions: VendorPOSuggestion[];
  totalSuggestions: number;
  criticalCount: number;
  warningCount: number;
  totalEstimatedCost: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  createDraftPO: (vendorId: string) => Promise<string | null>;
  isCreatingPO: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const URGENCY_ORDER: Record<StockoutWarningLevel, number> = {
  critical: 0,
  warning: 1,
  soon: 2,
  healthy: 3,
};

// ============================================================================
// Main Hook
// ============================================================================

export function useVendorPOSuggestions(): UseVendorPOSuggestionsResult {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // Get inventory forecasts for at-risk products
  const {
    forecasts,
    atRiskCount,
    criticalCount: forecastCriticalCount,
    warningCount: forecastWarningCount,
    isLoading: forecastsLoading,
    error: forecastsError,
    refetch: refetchForecasts,
  } = useBulkInventoryForecast({
    onlyAtRisk: true,
    enabled: !!tenantId,
  });

  // Fetch vendor info for products
  const { data: productVendorData, isLoading: vendorDataLoading, error: vendorDataError } = useQuery({
    queryKey: [...queryKeys.vendors.all, 'po-suggestions', tenantId],
    queryFn: async () => {
      if (!tenantId) return { products: [], vendors: new Map<string, string>() };

      // Get products with vendor assignments
      const { data: products, error: productsError } = await (supabase as any)
        .from('products')
        .select('id, vendor_id, cost_per_unit')
        .eq('tenant_id', tenantId)
        .not('vendor_id', 'is', null);

      if (productsError) {
        logger.error('Failed to fetch products for PO suggestions', productsError, {
          component: 'useVendorPOSuggestions',
        });
        throw productsError;
      }

      // Get unique vendor IDs
      const vendorIds = [...new Set((products || []).map((p: any) => p.vendor_id).filter(Boolean))] as string[];

      if (vendorIds.length === 0) {
        return { products: products || [], vendors: new Map<string, string>() };
      }

      // Fetch vendor names
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, name')
        .in('id', vendorIds);

      if (vendorsError) {
        logger.error('Failed to fetch vendors for PO suggestions', vendorsError, {
          component: 'useVendorPOSuggestions',
        });
        throw vendorsError;
      }

      // Create vendor lookup map
      const vendorMap = new Map<string, string>();
      (vendors || []).forEach((v) => {
        vendorMap.set(v.id, v.name);
      });

      return { products: products || [], vendors: vendorMap };
    },
    enabled: !!tenantId && forecasts.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Build PO suggestions by grouping products by vendor
  const suggestions = useMemo((): VendorPOSuggestion[] => {
    if (!productVendorData || forecasts.length === 0) return [];

    const { products, vendors } = productVendorData;

    // Create product lookup for vendor and cost info
    const productLookup = new Map<string, { vendorId: string; unitCost: number }>();
    products.forEach((p) => {
      if (p.vendor_id) {
        productLookup.set(p.id, {
          vendorId: p.vendor_id,
          unitCost: p.cost_per_unit ?? 0,
        });
      }
    });

    // Group forecasts by vendor
    const vendorGroups = new Map<string, ProductWithVendor[]>();

    forecasts.forEach((forecast: InventoryForecast) => {
      const productInfo = productLookup.get(forecast.productId);
      if (!productInfo) return; // Product has no vendor

      const vendorId = productInfo.vendorId;
      const vendorName = vendors.get(vendorId) || 'Unknown Vendor';

      const estimatedCost = forecast.recommendedReorderQuantity * productInfo.unitCost;

      const productWithVendor: ProductWithVendor = {
        productId: forecast.productId,
        productName: forecast.productName,
        sku: forecast.sku,
        vendorId,
        vendorName,
        currentStock: forecast.currentStock,
        reorderPoint: forecast.reorderPoint,
        recommendedQuantity: forecast.recommendedReorderQuantity,
        unitCost: productInfo.unitCost,
        estimatedCost,
        daysUntilStockout: forecast.daysUntilStockout,
        warningLevel: forecast.warningLevel,
        salesVelocity: forecast.unitsPerDay,
      };

      if (!vendorGroups.has(vendorId)) {
        vendorGroups.set(vendorId, []);
      }
      vendorGroups.get(vendorId)!.push(productWithVendor);
    });

    // Convert groups to suggestions
    const suggestionsList: VendorPOSuggestion[] = [];

    vendorGroups.forEach((vendorProducts, vendorId) => {
      if (vendorProducts.length === 0) return;

      // Calculate aggregate metrics
      const totalEstimatedCost = vendorProducts.reduce((sum, p) => sum + p.estimatedCost, 0);
      const avgDaysUntilStockout =
        vendorProducts.reduce((sum, p) => sum + p.daysUntilStockout, 0) / vendorProducts.length;

      // Determine overall urgency (most urgent product)
      const urgencyLevel = vendorProducts.reduce<StockoutWarningLevel>(
        (mostUrgent, p) =>
          URGENCY_ORDER[p.warningLevel] < URGENCY_ORDER[mostUrgent] ? p.warningLevel : mostUrgent,
        'healthy'
      );

      // Recommended order date is earliest from products
      const recommendedDates = vendorProducts
        .map((p) => {
          const daysUntilReorder = Math.max(0, p.daysUntilStockout - 7); // 7 day lead time
          if (daysUntilReorder < 999) {
            const date = new Date();
            date.setDate(date.getDate() + daysUntilReorder);
            return date;
          }
          return null;
        })
        .filter((d): d is Date => d !== null);

      const recommendedOrderDate =
        recommendedDates.length > 0
          ? new Date(Math.min(...recommendedDates.map((d) => d.getTime())))
          : null;

      suggestionsList.push({
        vendorId,
        vendorName: vendorProducts[0].vendorName,
        products: vendorProducts.sort(
          (a, b) => URGENCY_ORDER[a.warningLevel] - URGENCY_ORDER[b.warningLevel]
        ),
        totalProducts: vendorProducts.length,
        totalEstimatedCost,
        urgencyLevel,
        recommendedOrderDate,
        avgDaysUntilStockout: Math.round(avgDaysUntilStockout),
      });
    });

    // Sort by urgency level
    return suggestionsList.sort(
      (a, b) => URGENCY_ORDER[a.urgencyLevel] - URGENCY_ORDER[b.urgencyLevel]
    );
  }, [forecasts, productVendorData]);

  // Calculate summary stats
  const totalEstimatedCost = useMemo(
    () => suggestions.reduce((sum, s) => sum + s.totalEstimatedCost, 0),
    [suggestions]
  );

  const criticalCount = useMemo(
    () => suggestions.filter((s) => s.urgencyLevel === 'critical').length,
    [suggestions]
  );

  const warningCount = useMemo(
    () => suggestions.filter((s) => s.urgencyLevel === 'warning').length,
    [suggestions]
  );

  // Create draft PO mutation
  const createPOMutation = useMutation({
    mutationFn: async (vendorId: string): Promise<string | null> => {
      if (!tenantId) throw new Error('No tenant context');

      const suggestion = suggestions.find((s) => s.vendorId === vendorId);
      if (!suggestion) throw new Error('Vendor suggestion not found');

      logger.info('Creating draft PO from suggestion', {
        component: 'useVendorPOSuggestions',
        vendorId,
        productCount: suggestion.products.length,
        estimatedCost: suggestion.totalEstimatedCost,
      });

      // Create PO via edge function
      const { data, error } = await supabase.functions.invoke('create-purchase-order', {
        body: {
          supplier_id: vendorId,
          notes: `Auto-suggested PO based on inventory forecasting. ${suggestion.products.length} products approaching reorder point.`,
          status: 'draft',
          items: suggestion.products.map((p) => ({
            product_id: p.productId,
            quantity_lbs: p.recommendedQuantity,
            unit_cost: p.unitCost,
          })),
        },
      });

      if (error) {
        logger.error('Failed to create draft PO', error, {
          component: 'useVendorPOSuggestions',
          vendorId,
        });
        throw new Error(error.message || 'Failed to create purchase order');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const poId = data?.purchase_order?.id;
      if (!poId) {
        throw new Error('No PO ID returned from server');
      }

      logger.info('Draft PO created successfully', {
        component: 'useVendorPOSuggestions',
        poId,
        vendorId,
      });

      return poId;
    },
    onSuccess: (poId, vendorId) => {
      const suggestion = suggestions.find((s) => s.vendorId === vendorId);
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      toast.success(
        `Draft PO created for ${suggestion?.vendorName || 'vendor'} with ${suggestion?.products.length || 0} items`
      );
    },
    onError: (error: Error) => {
      logger.error('Failed to create draft PO', error, {
        component: 'useVendorPOSuggestions',
      });
      toast.error(humanizeError(error, 'Failed to create purchase order'));
    },
  });

  const createDraftPO = async (vendorId: string): Promise<string | null> => {
    try {
      return await createPOMutation.mutateAsync(vendorId);
    } catch {
      return null;
    }
  };

  return {
    suggestions,
    totalSuggestions: suggestions.length,
    criticalCount,
    warningCount,
    totalEstimatedCost,
    isLoading: forecastsLoading || vendorDataLoading,
    error: (forecastsError || vendorDataError) as Error | null,
    refetch: refetchForecasts,
    createDraftPO,
    isCreatingPO: createPOMutation.isPending,
  };
}

export default useVendorPOSuggestions;
