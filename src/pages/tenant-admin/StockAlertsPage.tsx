import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

export default function StockAlertsPage() {
  const { tenant } = useTenantAdminAuth();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['stock-alerts', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      // Try stock_alerts table first
      const { data: alertData, error: alertError } = await supabase
        .from('stock_alerts' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (alertError && alertError.code === '42P01') {
        // Fallback: Calculate from products table
        const { data: products, error: prodError } = await supabase
          .from('products')
          .select('id, name, available_quantity, stock_quantity, low_stock_alert')
          .eq('tenant_id', tenant.id);

        if (prodError && prodError.code === '42P01') return [];
        if (prodError) throw prodError;

        const DEFAULT_THRESHOLD = 10;
        return (products || [])
          .filter((item: any) => {
            const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
            const threshold = item.low_stock_alert ?? DEFAULT_THRESHOLD;
            return currentQty <= threshold;
          })
          .map((item: any) => {
            const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
            const threshold = item.low_stock_alert ?? DEFAULT_THRESHOLD;
            return {
              id: item.id,
              product_name: item.name,
              current_stock: currentQty,
              threshold: threshold,
              severity: currentQty <= threshold * 0.5 ? 'critical' : 'warning',
              created_at: new Date().toISOString(),
            };
          });
      }

      if (alertError) throw alertError;
      return alertData || [];
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const criticalCount = alerts.filter((a: any) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a: any) => a.severity === 'warning').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Stock Alerts</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Critical Alerts</p>
              <p className="text-2xl font-bold">{criticalCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Warning Alerts</p>
              <p className="text-2xl font-bold">{warningCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Alerts</p>
              <p className="text-2xl font-bold">{alerts.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No stock alerts. All inventory levels are healthy.
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="font-medium">{alert.product_name}</TableCell>
                  <TableCell>{alert.current_stock}</TableCell>
                  <TableCell>{alert.threshold}</TableCell>
                  <TableCell>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                      {alert.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(alert.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
