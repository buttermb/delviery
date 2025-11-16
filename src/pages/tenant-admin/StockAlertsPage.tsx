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
        // Fallback: Calculate from wholesale_inventory
        const { data: inventory, error: invError } = await supabase
          .from('wholesale_inventory' as any)
          .select('*')
          .eq('tenant_id', tenant.id);

        if (invError && invError.code === '42P01') return [];
        if (invError) throw invError;

        return (inventory || [])
          .filter((item: any) => item.quantity_lbs < 50)
          .map((item: any) => ({
            id: item.id,
            product_name: item.product_name,
            current_stock: item.quantity_lbs,
            threshold: 50,
            severity: item.quantity_lbs < 20 ? 'critical' : 'warning',
            created_at: new Date().toISOString(),
          }));
      }

      if (alertError) throw alertError;
      return alertData || [];
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
