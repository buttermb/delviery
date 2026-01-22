import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingDown, CheckCircle, PackagePlus, X, RefreshCw } from 'lucide-react';
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useState } from 'react';

interface StockAlert {
  id: string;
  product_name: string;
  current_quantity: number;
  threshold: number;
  severity: 'critical' | 'warning';
  created_at: string;
}

export default function StockAlerts() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: ['stock-alerts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        // Try stock_alerts table first
        const { data, error } = await supabase
          .from('stock_alerts' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          // Table doesn't exist, calculate from products table
          const { data: products, error: prodError } = await supabase
            .from('products')
            .select('id, name, stock_quantity, available_quantity, low_stock_alert, updated_at, created_at')
            .eq('tenant_id', tenantId);

          if (prodError && prodError.code === '42P01') return [];
          if (prodError) throw prodError;

          // Generate alerts from products
          return (products || [])
            .filter((item: any) => {
              const quantity = item.available_quantity ?? item.stock_quantity ?? 0;
              const threshold = item.low_stock_alert ?? 10;
              return quantity <= threshold;
            })
            .map((item: any) => {
              const quantity = item.available_quantity ?? item.stock_quantity ?? 0;
              const threshold = item.low_stock_alert ?? 10;
              return {
                id: item.id,
                product_name: item.name || 'Unknown',
                current_quantity: quantity,
                threshold: threshold,
                severity: quantity <= threshold * 0.5 ? 'critical' : 'warning',
                created_at: item.updated_at || item.created_at,
              } as StockAlert;
            });
        }
        if (error) throw error;
        return (data || []) as unknown as StockAlert[];
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
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

      // Update stock
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
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      toast.error('Failed to update stock');
      logger.error('Restock error', error);
    }
  });

  // Dismiss an alert (client-side only, lasts until refresh)
  const handleDismiss = (alertId: string) => {
    setDismissedIds(prev => new Set([...prev, alertId]));
    toast.info('Alert dismissed until next refresh');
  };

  // Quick restock - adds threshold amount to current stock
  const handleQuickRestock = (alert: StockAlert) => {
    const addAmount = Math.max(alert.threshold * 2, 10); // Add double threshold or minimum 10
    restockMutation.mutate({ productId: alert.id, addQuantity: addAmount });
  };

  // Filter out dismissed alerts
  const visibleAlerts = alerts?.filter(a => !dismissedIds.has(a.id)) || [];
  const criticalAlerts = visibleAlerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = visibleAlerts.filter(a => a.severity === 'warning').length;

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
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
    <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Stock Alerts</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Monitor low stock levels and inventory warnings</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
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
          <CardTitle className="text-base sm:text-lg md:text-xl">Active Alerts</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Products requiring immediate attention</CardDescription>
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
                    <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                      }`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm sm:text-base truncate">{alert.product_name}</div>
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

                    {/* Action Buttons */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickRestock(alert)}
                      disabled={restockMutation.isPending}
                      className="gap-1 text-xs h-8 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-800 dark:text-emerald-300"
                    >
                      <PackagePlus className="h-3 w-3" />
                      Restock
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(alert.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Dismiss alert"
                    >
                      <X className="h-4 w-4" />
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
            />
          )}
        </CardContent>
      </Card>

      {dismissedIds.size > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {dismissedIds.size} alert(s) dismissed. <button onClick={() => setDismissedIds(new Set())} className="text-primary hover:underline">Show all</button>
        </p>
      )}
    </div>
  );
}
