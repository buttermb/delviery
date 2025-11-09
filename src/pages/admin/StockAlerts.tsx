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
        let { data, error } = await supabase
          .from('stock_alerts' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          // Table doesn't exist, try to calculate from wholesale_inventory
          const { data: inventory, error: invError } = await supabase
            .from('wholesale_inventory' as any)
            .select('*, products(*)')
            .eq('tenant_id', tenantId);

          if (invError && invError.code === '42P01') return [];
          if (invError) throw invError;

          // Generate alerts from inventory
          return (inventory || [])
            .filter((item: any) => {
              const quantity = item.quantity || 0;
              const minThreshold = item.min_threshold || 10;
              return quantity <= minThreshold;
            })
            .map((item: any) => ({
              id: item.id,
              product_name: item.products?.name || 'Unknown',
              current_quantity: item.quantity || 0,
              threshold: item.min_threshold || 10,
              severity: item.quantity <= (item.min_threshold || 10) * 0.5 ? 'critical' : 'warning',
              created_at: item.updated_at || item.created_at,
            }));
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stock Alerts</h1>
        <p className="text-muted-foreground">Monitor low stock levels and inventory warnings</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2" data-tutorial="low-stock-alerts">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalAlerts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{warningAlerts}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
          <CardDescription>Products requiring immediate attention</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts && alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    alert.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <AlertTriangle className={`h-5 w-5 ${alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
                    <div>
                      <div className="font-medium">{alert.product_name || 'Unknown Product'}</div>
                      <div className="text-sm text-muted-foreground">
                        Current: {alert.current_quantity || 0} | Threshold: {alert.threshold || 10}
                      </div>
                    </div>
                  </div>
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {alert.severity || 'warning'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No stock alerts at this time. All inventory levels are healthy.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

