/**
 * Location Map Widget - Interactive map showing warehouses and runners
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Warehouse, Truck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { LeafletMapWidget } from './LeafletMapWidget';

export function LocationMapWidget() {
  const { account } = useAccount();

  const { data: locations } = useQuery({
    queryKey: ['location-map', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      // Get warehouses from inventory
      const { data: inventory } = await supabase
        .from('wholesale_inventory')
        .select('warehouse_location, quantity_lbs')
        .eq('account_id', account.id);

      interface InventoryItem {
        warehouse_location: string | null;
        quantity_lbs: number | null;
      }

      const warehouses = (inventory || []).reduce((acc: Record<string, { lbs: number; count: number }>, item: InventoryItem) => {
        const wh = item.warehouse_location || 'Unknown';
        if (!acc[wh]) {
          acc[wh] = { lbs: 0, count: 0 };
        }
        acc[wh].lbs += Number(item.quantity_lbs || 0);
        acc[wh].count += 1;
        return acc;
      }, {});

      // Get active runners
      const { data: runners } = await supabase
        .from('wholesale_runners')
        .select('id, full_name, status')
        .eq('account_id', account.id)
        .eq('status', 'active');

      interface RunnerRow {
        id: string;
        full_name: string;
        status: string;
      }

      return {
        warehouses: Object.entries(warehouses).map(([name, stats]) => ({
          name,
          lbs: stats.lbs,
          count: stats.count,
        })),
        runners: (runners || []) as RunnerRow[],
      };
    },
    enabled: !!account?.id,
  });

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Inventory Map
      </h3>

      {/* Map - Using Leaflet (OpenStreetMap - FREE!) */}
      {locations && locations.warehouses.length > 0 && (
        <LeafletMapWidget
          locations={[
            ...locations.warehouses.map((wh) => ({
              name: wh.name,
              lat: 40.7128 + (Math.random() - 0.5) * 0.1, // TODO: Get actual coordinates
              lng: -74.0060 + (Math.random() - 0.5) * 0.1,
              type: 'warehouse' as const,
            })),
            ...locations.runners.map((runner) => ({
              name: runner.full_name,
              lat: 40.7128 + (Math.random() - 0.5) * 0.1, // TODO: Get actual coordinates
              lng: -74.0060 + (Math.random() - 0.5) * 0.1,
              type: 'runner' as const,
            })),
          ]}
        />
      )}
      {(!locations || locations.warehouses.length === 0) && (
        <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/20 mb-4">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No locations to display</p>
            <p className="text-xs mt-1">Add warehouses and runners to see them on the map</p>
          </div>
        </div>
      )}

      {/* Warehouse List */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Warehouse className="h-4 w-4" />
          Warehouses
        </h4>
        {locations?.warehouses && locations.warehouses.length > 0 ? (
          locations.warehouses.map((wh, index) => (
            <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
              <div>
                <div className="font-medium text-sm">{wh.name}</div>
                <div className="text-xs text-muted-foreground">
                  {wh.count} items • {wh.lbs.toFixed(1)} lbs
                </div>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-700">
                Active
              </Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No warehouses configured</p>
        )}
      </div>

      {/* Active Runners */}
      <div className="space-y-2 pt-4 border-t">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Active Runners
        </h4>
        {locations?.runners && locations.runners.length > 0 ? (
          locations.runners.map((runner) => (
            <div key={runner.id} className="flex items-center justify-between p-2 border rounded-lg">
              <div className="font-medium text-sm">{runner.full_name}</div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700">
                Active
              </Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No active runners</p>
        )}
      </div>
    </Card>
  );
}

