import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

interface StockAlertRow {
  id: string;
  product_name: string;
  current_quantity: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  status: string;
  created_at: string;
}

export default function StockAlertsPage() {
  const { tenant } = useTenantAdminAuth();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: queryKeys.stockAlerts.active(tenant?.id),
    queryFn: async (): Promise<StockAlertRow[]> => {
      if (!tenant?.id) return [];

      // Query stock_alerts table for active alerts
      const { data: alertData, error: alertError } = await (supabase as any)
        .from('stock_alerts')
        .select('id, product_name, current_quantity, threshold, severity, status, created_at')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // If table doesn't exist, fall back to products-based calculation
      if (alertError && alertError.code === '42P01') {
        logger.warn('stock_alerts table not found, using products fallback');
        return await fetchAlertsFromProducts(tenant.id);
      }

      if (alertError) throw alertError;
      return (alertData || []) as StockAlertRow[];
    },
    enabled: !!tenant?.id,
  });

  // Fallback function to calculate alerts from products table
  async function fetchAlertsFromProducts(tenantId: string): Promise<StockAlertRow[]> {
    const { data: products, error: prodError } = await (supabase as any)
      .from('products')
      .select('id, name, available_quantity, stock_quantity, low_stock_alert, updated_at')
      .eq('tenant_id', tenantId);

    if (prodError && prodError.code === '42P01') return [];
    if (prodError) throw prodError;

    const DEFAULT_THRESHOLD = 10;
    return (products || [])
      .filter((item) => {
        const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
        const threshold = item.low_stock_alert ?? DEFAULT_THRESHOLD;
        return currentQty <= threshold;
      })
      .map((item) => {
        const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
        const threshold = item.low_stock_alert ?? DEFAULT_THRESHOLD;
        let severity: 'critical' | 'warning' | 'info' = 'warning';
        if (currentQty <= 0 || currentQty <= threshold * 0.5) {
          severity = 'critical';
        }
        return {
          id: item.id,
          product_name: item.name || 'Unknown',
          current_quantity: currentQty,
          threshold: threshold,
          severity,
          status: 'active',
          created_at: item.updated_at || new Date().toISOString(),
        };
      });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

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
                  <TableCell>{alert.current_quantity}</TableCell>
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
