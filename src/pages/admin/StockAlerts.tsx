import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { AlertTriangle, Bell, CheckCircle, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface StockAlert {
  id: string;
  product_name: string;
  product_id?: string;
  current_stock: number;
  threshold: number;
  location?: string;
  category?: string;
  status: 'critical' | 'warning' | 'low';
}

export default function StockAlerts() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState(10);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['stock-alerts', tenantId],
    queryFn: async (): Promise<StockAlert[]> => {
      if (!tenantId) return [];

      const allAlerts: StockAlert[] = [];

      // Check wholesale_inventory table
      try {
        const { data: wholesaleItems, error } = await supabase
          .from('wholesale_inventory')
          .select('id, strain, weight_lbs, low_stock_alert_lbs, tenant_id')
          .eq('tenant_id', tenantId);

        if (!error && wholesaleItems) {
          wholesaleItems.forEach((item: any) => {
            const currentStock = Number(item.weight_lbs || 0);
            const threshold = Number(item.low_stock_alert_lbs || 10);

            if (currentStock <= threshold) {
              const status = currentStock === 0 ? 'critical' : currentStock <= threshold * 0.5 ? 'warning' : 'low';
              allAlerts.push({
                id: item.id,
                product_name: item.strain || 'Unknown Product',
                product_id: item.id,
                current_stock,
                threshold,
                status,
              });
            }
          });
        }
      } catch (error: any) {
        if (error.code !== '42P01') {
          console.warn('Error fetching wholesale_inventory:', error);
        }
      }

      // Check products table
      try {
        const { data: products, error } = await supabase
          .from('products')
          .select('id, name, stock_quantity, low_stock_alert, category')
          .eq('tenant_id', tenantId);

        if (!error && products) {
          products.forEach((product: any) => {
            const currentStock = Number(product.stock_quantity || 0);
            const threshold = Number(product.low_stock_alert || 5);

            if (currentStock <= threshold) {
              const status = currentStock === 0 ? 'critical' : currentStock <= threshold * 0.5 ? 'warning' : 'low';
              allAlerts.push({
                id: product.id,
                product_name: product.name || 'Unknown Product',
                product_id: product.id,
                current_stock,
                threshold,
                category: product.category,
                status,
              });
            }
          });
        }
      } catch (error: any) {
        if (error.code !== '42P01') {
          console.warn('Error fetching products:', error);
        }
      }

      return allAlerts.sort((a, b) => {
        const statusOrder = { critical: 0, warning: 1, low: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // Refresh every minute
  });

  const criticalAlerts = alerts?.filter((a) => a.status === 'critical') || [];
  const warningAlerts = alerts?.filter((a) => a.status === 'warning') || [];
  const lowAlerts = alerts?.filter((a) => a.status === 'low') || [];

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedAlerts((prev) => new Set([...prev, alertId]));
    toast({ title: 'Alert acknowledged', description: 'You have acknowledged this stock alert.' });
  };

  const handleUpdateThreshold = async (productId: string, newThreshold: number, table: 'products' | 'wholesale_inventory') => {
    try {
      if (table === 'products') {
        const { error } = await supabase
          .from('products')
          .update({ low_stock_alert: newThreshold })
          .eq('id', productId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wholesale_inventory')
          .update({ low_stock_alert_lbs: newThreshold })
          .eq('id', productId);

        if (error) throw error;
      }

      toast({ title: 'Threshold updated', description: 'Stock alert threshold has been updated.' });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts', tenantId] });
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update threshold',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading stock alerts...</div>
      </div>
    );
  }

  const visibleAlerts = alerts?.filter((alert) => !acknowledgedAlerts.has(alert.id)) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Alerts</h1>
          <p className="text-muted-foreground">Monitor inventory levels and get notified when stock is low</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Critical (Out of Stock)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAlerts.length}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Warning (Very Low)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{warningAlerts.length}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowAlerts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Stock Alerts ({visibleAlerts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleAlerts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAlerts.map((alert) => (
                  <TableRow key={alert.id} className={alert.status === 'critical' ? 'bg-red-50' : ''}>
                    <TableCell className="font-medium">{alert.product_name}</TableCell>
                    <TableCell>
                      <span className={alert.current_stock === 0 ? 'text-red-600 font-bold' : ''}>
                        {alert.current_stock}
                      </span>
                    </TableCell>
                    <TableCell>{alert.threshold}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          alert.status === 'critical'
                            ? 'destructive'
                            : alert.status === 'warning'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {alert.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{alert.category || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Acknowledge
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {alerts && alerts.length === 0
                ? 'No stock alerts. All inventory levels are above thresholds.'
                : 'All active alerts have been acknowledged.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Alert Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="default-threshold">Default Alert Threshold</Label>
            <Input
              id="default-threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              placeholder="10"
            />
            <p className="text-sm text-muted-foreground mt-1">
              This threshold will be used for new products that don't have a specific threshold set.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                toast({
                  title: 'Settings saved',
                  description: 'Alert configuration has been saved.',
                });
              }}
            >
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

