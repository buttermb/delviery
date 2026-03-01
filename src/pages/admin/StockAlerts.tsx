import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import PackagePlus from 'lucide-react/dist/esm/icons/package-plus';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import CheckCheck from 'lucide-react/dist/esm/icons/check-check';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { LowStockToPODialog } from '@/components/admin/inventory/LowStockToPODialog';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { TruncatedText } from '@/components/shared/TruncatedText';
import { queryKeys } from '@/lib/queryKeys';

interface StockAlert {
  id: string;
  product_id: string;
  product_name: string;
  current_quantity: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  updated_at: string;
}

export function StockAlerts() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // State for Create PO dialog
  const [showPODialog, setShowPODialog] = useState(false);
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());

  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: queryKeys.stockAlerts.active(tenantId),
    queryFn: async (): Promise<StockAlert[]> => {
      if (!tenantId) return [];

      // Query the stock_alerts table for active alerts
      const { data, error } = await supabase
        .from('stock_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist yet, fall back to products-based calculation
        if (error.code === '42P01') {
          logger.warn('stock_alerts table not found, falling back to products query');
          return await fetchAlertsFromProducts(tenantId);
        }
        throw error;
      }

      return (data ?? []) as StockAlert[];
    },
    enabled: !!tenantId,
  });

  // Fallback function to calculate alerts from products table
  async function fetchAlertsFromProducts(tid: string): Promise<StockAlert[]> {
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, stock_quantity, available_quantity, low_stock_alert, updated_at, created_at')
      .eq('tenant_id', tid);

    if (prodError) {
      if (prodError.code === '42P01') return [];
      throw prodError;
    }

    return (products ?? [])
      .filter((item) => {
        const quantity = item.available_quantity ?? item.stock_quantity ?? 0;
        const threshold = item.low_stock_alert ?? 10;
        return quantity <= threshold;
      })
      .map((item) => {
        const quantity = item.available_quantity ?? item.stock_quantity ?? 0;
        const threshold = item.low_stock_alert ?? 10;
        let severity: 'critical' | 'warning' | 'info' = 'warning';
        if (quantity <= 0 || quantity <= threshold * 0.5) {
          severity = 'critical';
        }
        return {
          id: item.id,
          product_id: item.id,
          product_name: item.name || 'Unknown',
          current_quantity: quantity,
          threshold: threshold,
          severity,
          status: 'active' as const,
          created_at: item.updated_at || item.created_at,
          updated_at: item.updated_at || item.created_at,
        };
      });
  }

  // Mutation to acknowledge an alert
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const rpc = supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
      const { data, error } = await rpc('acknowledge_stock_alert', { // Supabase type limitation
        p_alert_id: alertId,
      });

      if (error) {
        // Fallback: try direct update if RPC doesn't exist
        if (error.code === '42883') {
          const { error: updateError } = await supabase
            .from('stock_alerts')
            .update({
              status: 'acknowledged',
              acknowledged_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', alertId)
            .eq('tenant_id', tenantId);

          if (updateError) throw updateError;
          return { id: alertId, status: 'acknowledged' };
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Alert acknowledged');
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
    },
    onError: (error) => {
      toast.error('Failed to acknowledge alert', { description: humanizeError(error) });
      logger.error('Acknowledge error', error);
    },
  });

  // Mutation to mark item as restocked (increase stock)
  const restockMutation = useMutation({
    mutationFn: async ({ productId, addQuantity }: { productId: string; addQuantity: number }) => {
      // Get current quantity
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock_quantity, available_quantity')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!product) throw new Error('Product not found');

      const currentQty = product.available_quantity ?? product.stock_quantity ?? 0;
      const newQty = currentQty + addQuantity;

      // Update stock - this will trigger the stock alert update automatically
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: newQty,
          available_quantity: newQty,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
      return { productId, newQty };
    },
    onSuccess: (data) => {
      toast.success(`Stock updated to ${data.newQty} units`);
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
    onError: (error) => {
      toast.error('Failed to update stock', { description: humanizeError(error) });
      logger.error('Restock error', error);
    }
  });

  // Quick restock - adds threshold amount to current stock
  const handleQuickRestock = (alert: StockAlert) => {
    const addAmount = Math.max(alert.threshold * 2, 10); // Add double threshold or minimum 10
    restockMutation.mutate({ productId: alert.product_id, addQuantity: addAmount });
  };

  // Acknowledge alert
  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId);
  };

  const visibleAlerts = alerts ?? [];
  const criticalAlerts = visibleAlerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = visibleAlerts.filter(a => a.severity === 'warning').length;

  // Selection handlers for creating POs
  const toggleAlertSelection = (alertId: string, productId: string) => {
    setSelectedAlertIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAlertIds.size === visibleAlerts.length) {
      setSelectedAlertIds(new Set());
    } else {
      setSelectedAlertIds(new Set(visibleAlerts.map((a) => a.product_id)));
    }
  };

  const handleOpenPODialog = () => {
    setShowPODialog(true);
  };

  const handlePODialogSuccess = () => {
    setSelectedAlertIds(new Set());
    refetch();
  };

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="p-2 sm:p-4 md:p-4 space-y-4 sm:space-y-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>

        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-4 space-y-4 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Stock Alerts</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Monitor low stock levels and inventory warnings</p>
        </div>
        <div className="flex items-center gap-2">
          {visibleAlerts.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenPODialog}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Create Purchase Orders
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2" data-tutorial="low-stock-alerts">
        <Card className="p-3 sm:p-4 md:p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0 mb-2 sm:mb-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-0 pt-2 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-red-500">{criticalAlerts}</div>
          </CardContent>
        </Card>

        <Card className="p-3 sm:p-4 md:p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0 mb-2 sm:mb-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Warnings</CardTitle>
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-0 pt-2 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-yellow-500">{warningAlerts}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-3 sm:p-4 md:p-6">
        <CardHeader className="p-0 mb-3 sm:mb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg md:text-xl">Active Alerts</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Products requiring immediate attention</CardDescription>
            </div>
            {visibleAlerts.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedAlertIds.size === visibleAlerts.length && visibleAlerts.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all alerts"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedAlertIds.size > 0 ? `${selectedAlertIds.size} selected` : 'Select all'}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visibleAlerts.length > 0 ? (
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 border rounded-lg touch-manipulation transition-all ${alert.severity === 'critical'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950'
                    : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
                    }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <Checkbox
                      checked={selectedAlertIds.has(alert.product_id)}
                      onCheckedChange={() => toggleAlertSelection(alert.id, alert.product_id)}
                      aria-label={`Select ${alert.product_name}`}
                    />
                    <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                      }`} />
                    <div className="min-w-0 flex-1">
                      <TruncatedText text={alert.product_name} className="font-medium text-sm sm:text-base" as="div" />
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Current: <span className="font-semibold">{alert.current_quantity}</span> | Threshold: {alert.threshold}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Badge
                      variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                      className="text-xs sm:text-sm flex-shrink-0"
                    >
                      {alert.severity}
                    </Badge>

                    {/* Quick Restock Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickRestock(alert)}
                      disabled={restockMutation.isPending}
                      className="gap-1 text-xs h-8 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-800 dark:text-emerald-300"
                    >
                      {restockMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PackagePlus className="h-3 w-3" />}
                      Restock
                    </Button>

                    {/* Acknowledge Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Acknowledge alert"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EnhancedEmptyState
              icon={CheckCircle}
              title="All Stock Levels Healthy"
              description="No low stock items detected. Great job keeping inventory stocked!"
              compact
              designSystem="tenant-admin"
              primaryAction={{
                label: 'Refresh Alerts',
                onClick: () => refetch(),
                icon: RefreshCw,
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Low Stock to PO Dialog */}
      <LowStockToPODialog
        open={showPODialog}
        onOpenChange={setShowPODialog}
        preSelectedProductIds={Array.from(selectedAlertIds)}
        onSuccess={handlePODialogSuccess}
      />
    </div>
  );
}

export default StockAlerts;
