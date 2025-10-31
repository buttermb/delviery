/**
 * Inventory Alerts Widget
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';

export function InventoryAlertsWidget() {
  const navigate = useNavigate();
  const { account } = useAccount();

  const { data: alerts } = useQuery({
    queryKey: ['inventory-alerts-widget', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data } = await supabase
        .from('wholesale_inventory')
        .select('product_name, quantity_lbs, warehouse_location')
        .eq('account_id', account.id)
        .lt('quantity_lbs', 30)
        .order('quantity_lbs', { ascending: true })
        .limit(5);

      return data || [];
    },
    enabled: !!account?.id,
    refetchInterval: 60000,
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
        {alerts && alerts.length > 0 ? (
          alerts.map((alert: any, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate('/admin/big-plug-inventory')}
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
          onClick={() => navigate('/admin/big-plug-inventory')}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  );
}

