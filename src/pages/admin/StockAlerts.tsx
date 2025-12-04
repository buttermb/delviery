import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TrendingDown } from 'lucide-react';

export default function StockAlerts() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: alerts, isLoading } = useQuery({
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
              };
            });
        }
        if (error) throw error;
        return data || [];
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading stock alerts...</div>
      </div>
    );
  }

  const criticalAlerts = alerts?.filter((a: any) => a.severity === 'critical').length || 0;
  const warningAlerts = alerts?.filter((a: any) => a.severity === 'warning').length || 0;

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Stock Alerts</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Monitor low stock levels and inventory warnings</p>
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
          {alerts && alerts.length > 0 ? (
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 border rounded-lg touch-manipulation ${
                    alert.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm sm:text-base truncate">{alert.product_name || 'Unknown Product'}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Current: {alert.current_quantity || 0} | Threshold: {alert.threshold || 10}
                      </div>
                    </div>
                  </div>
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs sm:text-sm flex-shrink-0">
                    {alert.severity || 'warning'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">
              No stock alerts at this time. All inventory levels are healthy.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

