/**
 * Location Map Widget - Interactive map showing warehouses and runners
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Warehouse, Truck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { LeafletMapWidget } from './LeafletMapWidget';

// Deterministic hash for stable coordinates based on string
const getDeterministicOffset = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  // Normalize to range -0.05 to 0.05
  return (hash % 1000) / 10000;
};

export function LocationMapWidget() {
  const { account } = useAccount();

  interface LocationData {
    warehouses: Array<{
      name: string;
      lbs: number;
      count: number;
      lat: number;
      lng: number;
      isEstimated: boolean;
    }>;
    runners: Array<{
      id: string;
      full_name: string;
      status: string;
      lat: number;
      lng: number;
      isEstimated: boolean;
    }>;
  }

  const { data: locations } = useQuery<LocationData | null>({
    queryKey: queryKeys.dashboardWidgets.locationMap(account?.id),
    queryFn: async (): Promise<LocationData | null> => {
      if (!account?.id) return null;

      interface InventoryItem {
        category: string | null;
        stock_quantity: number | null;
      }

      // Get warehouses from products (grouped by category)
      const { data: inventory, error: inventoryError } = await supabase
        .from('products')
        .select('category, stock_quantity')
        .eq('tenant_id', account.id);

      if (inventoryError) logger.error('Failed to fetch inventory for location map', inventoryError, { component: 'LocationMapWidget' });

      const warehouses = (inventory ?? []).reduce((acc: Record<string, { lbs: number; count: number }>, item: InventoryItem) => {
        const wh = item.category || 'Uncategorized';
        if (!acc[wh]) {
          acc[wh] = { lbs: 0, count: 0 };
        }
        acc[wh].lbs += Number(item.stock_quantity || 0);
        acc[wh].count += 1;
        return acc;
      }, {});

      // Get active runners with location data
      const { data: runners, error: runnersError } = await supabase
        .from('wholesale_runners')
        .select('id, full_name, status, current_lat, current_lng')
        .eq('account_id', account.id)
        .eq('status', 'active');

      if (runnersError) logger.error('Failed to fetch runners for location map', runnersError, { component: 'LocationMapWidget' });

      // Base coordinates (NYC)
      const BASE_LAT = 40.7128;
      const BASE_LNG = -74.0060;

      return {
        warehouses: Object.entries(warehouses).map(([name, rawStats]: [string, unknown]) => {
          const stats = rawStats as { lbs: number; count: number };
          return {
            name,
            lbs: stats.lbs,
            count: stats.count,
            // Use deterministic coordinates based on name (estimated location)
            lat: BASE_LAT + getDeterministicOffset(name),
            lng: BASE_LNG + getDeterministicOffset(name + '_lng'),
            isEstimated: true,
          };
        }),
        runners: (runners ?? []).map((runner: { id: string; full_name: string; status: string; current_lat: number | null; current_lng: number | null }) => ({
          id: runner.id,
          full_name: runner.full_name,
          status: runner.status,
          // Use real coordinates if available, otherwise fallback to estimated location
          lat: runner.current_lat || (BASE_LAT + getDeterministicOffset(runner.id)),
          lng: runner.current_lng || (BASE_LNG + getDeterministicOffset(runner.id + '_lng')),
          isEstimated: !runner.current_lat,
        })),
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
      {locations && (locations.warehouses.length > 0 || locations.runners.length > 0) && (
        <LeafletMapWidget
          locations={[
            ...locations.warehouses.map((wh) => ({
              name: wh.name,
              lat: wh.lat,
              lng: wh.lng,
              type: 'warehouse' as const,
            })),
            ...locations.runners.map((runner) => ({
              name: runner.full_name,
              lat: runner.lat,
              lng: runner.lng,
              type: 'runner' as const,
            })),
          ]}
        />
      )}
      {(!locations || (locations.warehouses.length === 0 && locations.runners.length === 0)) && (
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
          locations.warehouses.map((wh, _index) => (
            <div key={wh.name} className="flex items-center justify-between p-2 border rounded-lg">
              <div>
                <div className="font-medium text-sm">{wh.name}</div>
                <div className="text-xs text-muted-foreground">
                  {wh.count} items • {wh.lbs.toFixed(1)} lbs
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-success/10 text-success">
                  Active
                </Badge>
                {wh.isEstimated && (
                  <Badge variant="outline" className="bg-warning/10 text-warning text-xs">
                    Estimated Location
                  </Badge>
                )}
              </div>
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
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-info/10 text-info">
                  Active
                </Badge>
                {runner.isEstimated && (
                  <Badge variant="outline" className="bg-warning/10 text-warning text-xs">
                    Estimated
                  </Badge>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No active runners</p>
        )}
      </div>
    </Card>
  );
}
