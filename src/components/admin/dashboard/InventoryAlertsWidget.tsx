/**
 * Inventory Alerts Widget
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Package from "lucide-react/dist/esm/icons/package";
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';

export function InventoryAlertsWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { account } = useAccount();

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['inventory-alerts-widget', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      interface AlertRow {
        product_name: string | null;
        quantity_lbs: number | null;
        warehouse_location: string | null;
      }

      // Fetch low stock products
      const { data } = await supabase
        .from('products')
        .select('name, stock_quantity, category')
        .eq('tenant_id', account.id)
        .lt('stock_quantity', 30)
        .order('stock_quantity', { ascending: true })
        .limit(5);

      // Map to AlertRow interface for compatibility
      return (data || []).map(p => ({
        product_name: p.name,
        quantity_lbs: p.stock_quantity,
        warehouse_location: p.category || 'Unknown'
      })) as AlertRow[];
    },
    enabled: !!account?.id,
    // Use real-time updates via useRealtimeSync instead of polling
    staleTime: 10000, // Allow 10s stale time for real-time updates
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Inventory Alerts
        </h3>
        {alerts && alerts.length > 0 && (
          <Badge variant="destructive">{alerts.length}</Badge>
        )}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))
        ) : alerts && alerts.length > 0 ? (
          alerts.map((alert, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(getFullPath('/admin/big-plug-inventory'))}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{alert.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {alert.warehouse_location}
                  </div>
                </div>
              </div>
              <Badge variant={Number(alert.quantity_lbs) < 20 ? 'destructive' : 'outline'}>
                {Number(alert.quantity_lbs).toFixed(1)} lbs
              </Badge>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            All inventory levels healthy
          </div>
        )}
      </div>

      {alerts && alerts.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4"
          onClick={() => navigate(getFullPath('/admin/big-plug-inventory'))}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  );
}

