/**
 * Low Stock Alerts Hook
 *
 * Fetches stock alerts from the stock_alerts table for a given tenant.
 * Falls back to products-based calculation if the table doesn't exist.
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

function severityToAlertLevel(severity: string): LowStockProduct['alertLevel'] {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  return 'warning';
}

interface StockAlertRow {
  id: string;
  product_id: string;
  product_name: string;
  current_quantity: number;
  threshold: number;
  severity: string;
}

interface ProductRow {
  id: string;
  name: string;
  stock_quantity: number | null;
  available_quantity: number | null;
  low_stock_alert: number | null;
  category: string;
}

export function useLowStockAlerts(): LowStockAlertsSummary {
  const { tenant } = useTenantAdminAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.stockAlerts.active(tenant?.id),
    queryFn: async (): Promise<LowStockProduct[]> => {
      if (!tenant?.id) return [];

      // First try to fetch from stock_alerts table
      const { data: alerts, error: alertError } = await supabase
        .from('stock_alerts')
        .select('id, product_id, product_name, current_quantity, threshold, severity')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('current_quantity', { ascending: true });

      if (alertError) {
        logger.warn('stock_alerts query failed, falling back to products', {
          component: 'useLowStockAlerts',
          error: alertError,
        });
      }

      // If stock_alerts table exists and has data, use it
      if (!alertError && alerts && alerts.length > 0) {
        return (alerts as StockAlertRow[]).map((alert) => {
          const alertLevel = alert.current_quantity <= 0
            ? 'out_of_stock'
            : severityToAlertLevel(alert.severity);

          return {
            id: alert.product_id,
            name: alert.product_name,
            stockQuantity: alert.current_quantity,
            availableQuantity: alert.current_quantity,
            lowStockThreshold: alert.threshold,
            category: '', // Category not stored in alerts
            alertLevel,
          };
        });
      }

      // If table doesn't exist or no alerts, fall back to products query
      if (alertError && alertError.code !== '42P01') {
        logger.error('Error fetching stock alerts', { error: alertError });
      }

      // Fallback: fetch from products table
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, available_quantity, low_stock_alert, category')
        .eq('tenant_id', tenant.id)
        .order('stock_quantity', { ascending: true });

      if (fetchError) {
        logger.error('Failed to fetch low stock products', { error: fetchError });
        throw fetchError;
      }

      // Filter and map results - include products where available quantity is at or below threshold
      return ((products ?? []) as ProductRow[])
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

  const products = useMemo(() => data ?? [], [data]);

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
