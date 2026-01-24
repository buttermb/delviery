/**
 * Low Stock Alerts Hook
 *
 * Fetches products that are below their low stock threshold for a given tenant.
 * Used by the LowStockBanner component and order forms to identify
 * out-of-stock and low-stock products.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface LowStockProduct {
  id: string;
  name: string;
  stockQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  category: string;
  alertLevel: 'out_of_stock' | 'critical' | 'warning';
}

export interface LowStockAlertsSummary {
  products: LowStockProduct[];
  outOfStockCount: number;
  criticalCount: number;
  warningCount: number;
  totalAlerts: number;
  outOfStockIds: Set<string>;
  lowStockIds: Set<string>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function getAlertLevel(available: number, threshold: number): LowStockProduct['alertLevel'] {
  if (available <= 0) return 'out_of_stock';
  if (available <= threshold * 0.25) return 'critical';
  return 'warning';
}

export function useLowStockAlerts(): LowStockAlertsSummary {
  const { tenant } = useTenantAdminAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.inventory.lowStockAlerts(tenant?.id),
    queryFn: async (): Promise<LowStockProduct[]> => {
      if (!tenant?.id) return [];

      // Fetch products where stock is at or below their low stock threshold
      // Uses low_stock_alert column as the threshold (default 10 if not set)
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, available_quantity, low_stock_alert, category')
        .eq('tenant_id', tenant.id)
        .or('stock_quantity.lte.low_stock_alert,stock_quantity.eq.0,available_quantity.eq.0')
        .order('stock_quantity', { ascending: true });

      if (fetchError) {
        logger.error('Failed to fetch low stock alerts', { error: fetchError });
        throw fetchError;
      }

      // Filter and map results - include products where available quantity is at or below threshold
      return (products || [])
        .filter((p) => {
          const available = p.available_quantity ?? p.stock_quantity ?? 0;
          const threshold = p.low_stock_alert ?? 10;
          return available <= threshold;
        })
        .map((p) => {
          const available = p.available_quantity ?? p.stock_quantity ?? 0;
          const threshold = p.low_stock_alert ?? 10;
          return {
            id: p.id,
            name: p.name,
            stockQuantity: p.stock_quantity ?? 0,
            availableQuantity: available,
            lowStockThreshold: threshold,
            category: p.category,
            alertLevel: getAlertLevel(available, threshold),
          };
        });
    },
    enabled: !!tenant?.id,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });

  const products = data ?? [];

  const summary = useMemo(() => {
    const outOfStock = products.filter((p) => p.alertLevel === 'out_of_stock');
    const critical = products.filter((p) => p.alertLevel === 'critical');
    const warning = products.filter((p) => p.alertLevel === 'warning');

    const outOfStockIds = new Set(outOfStock.map((p) => p.id));
    const lowStockIds = new Set(products.map((p) => p.id));

    return {
      outOfStockCount: outOfStock.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      totalAlerts: products.length,
      outOfStockIds,
      lowStockIds,
    };
  }, [products]);

  return {
    products,
    ...summary,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
