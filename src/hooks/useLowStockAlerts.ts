/**
 * Low Stock Alerts Hook
 *
 * Fetches stock alerts from the stock_alerts table for a given tenant.
 * Falls back to products-based calculation if the table doesn't exist.
 * Also pulls timestamped history from low_inventory_log so admins can
 * see *when* items went low, not just current state.
 *
 * Used by the LowStockBanner component and order forms to identify
 * out-of-stock and low-stock products.
 */

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

export interface LowStockHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  quantityAfter: number;
  threshold: number;
  triggeredByOrderId: string | null;
  createdAt: string;
}

export interface LowStockAlertsSummary {
  products: LowStockProduct[];
  outOfStockCount: number;
  criticalCount: number;
  warningCount: number;
  totalAlerts: number;
  outOfStockIds: Set<string>;
  lowStockIds: Set<string>;
  history: LowStockHistoryEntry[];
  historyLoading: boolean;
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
  reorder_point: number;
  severity: string;
}

interface ProductRow {
  id: string;
  name: string;
  available_quantity: number | null;
  low_stock_alert: number | null;
  category: string;
}

interface LowInventoryLogRow {
  id: string;
  product_id: string;
  quantity_after: number;
  threshold: number;
  triggered_by_order_id: string | null;
  created_at: string;
  products: { name: string } | null;
}

export function useLowStockAlerts(): LowStockAlertsSummary {
  const { tenant } = useTenantAdminAuth();

  // ── Current alerts query (unchanged logic) ──────────────────────
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.stockAlerts.active(tenant?.id),
    queryFn: async (): Promise<LowStockProduct[]> => {
      if (!tenant?.id) return [];

      // First try to fetch from stock_alerts table
      const { data: alerts, error: alertError } = await (supabase as any)
        .from('inventory_alerts')
        .select('id, product_id, product_name, current_quantity, reorder_point, severity')
        .eq('tenant_id', tenant.id)
        .eq('is_resolved', false)
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
            lowStockThreshold: alert.reorder_point,
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
        .select('id, name, available_quantity, low_stock_alert, category')
        .eq('tenant_id', tenant.id)
        .order('available_quantity', { ascending: true });

      if (fetchError) {
        logger.error('Failed to fetch low stock products', { error: fetchError });
        throw fetchError;
      }

      // Filter and map results - include products where available quantity is at or below threshold
      return ((products ?? []) as ProductRow[])
        .filter((p) => {
          const available = p.available_quantity ?? 0;
          const threshold = p.low_stock_alert ?? 10;
          return available <= threshold;
        })
        .map((p) => {
          const available = p.available_quantity ?? 0;
          const threshold = p.low_stock_alert ?? 10;
          return {
            id: p.id,
            name: p.name,
            stockQuantity: available,
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
    // select transforms raw data into summary + products.
    // TanStack Query's structural sharing ensures re-renders only occur
    // when the derived values actually change, not on every refetch.
    select: (products) => {
      const outOfStock = products.filter((p) => p.alertLevel === 'out_of_stock');
      const critical = products.filter((p) => p.alertLevel === 'critical');
      const warning = products.filter((p) => p.alertLevel === 'warning');

      return {
        products,
        outOfStockCount: outOfStock.length,
        criticalCount: critical.length,
        warningCount: warning.length,
        totalAlerts: products.length,
        outOfStockIds: new Set(outOfStock.map((p) => p.id)),
        lowStockIds: new Set(products.map((p) => p.id)),
      };
    },
    retry: 2,
  });

  // ── Low-inventory history from trigger log ──────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.stockAlerts.history(tenant?.id),
    queryFn: async (): Promise<LowStockHistoryEntry[]> => {
      if (!tenant?.id) return [];

      const { data: logs, error: logError } = await (supabase as unknown as {
        from: (table: string) => ReturnType<typeof supabase.from>;
      })
        .from('low_inventory_log')
        .select('id, product_id, quantity_after, threshold, triggered_by_order_id, created_at, products(name)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (logError) {
        // Table may not exist yet in older deployments — fail silently
        if (logError.code === '42P01') {
          return [];
        }
        logger.warn('Failed to fetch low inventory history', {
          component: 'useLowStockAlerts',
          error: logError,
        });
        return [];
      }

      return ((logs ?? []) as LowInventoryLogRow[]).map((row) => ({
        id: row.id,
        productId: row.product_id,
        productName: row.products?.name ?? 'Unknown product',
        quantityAfter: row.quantity_after,
        threshold: row.threshold,
        triggeredByOrderId: row.triggered_by_order_id,
        createdAt: row.created_at,
      }));
    },
    enabled: !!tenant?.id,
    staleTime: 120_000, // 2 minutes — history changes less frequently
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const selected = data ?? {
    products: [],
    outOfStockCount: 0,
    criticalCount: 0,
    warningCount: 0,
    totalAlerts: 0,
    outOfStockIds: new Set<string>(),
    lowStockIds: new Set<string>(),
  };

  return {
    products: selected.products,
    outOfStockCount: selected.outOfStockCount,
    criticalCount: selected.criticalCount,
    warningCount: selected.warningCount,
    totalAlerts: selected.totalAlerts,
    outOfStockIds: selected.outOfStockIds,
    lowStockIds: selected.lowStockIds,
    history: historyData ?? [],
    historyLoading,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
