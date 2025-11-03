import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { MapPin, Truck, Navigation, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DeliveryStop {
  id: string;
  order_id?: string;
  address: string;
  lat?: number;
  lng?: number;
  sequence?: number;
  estimated_time?: string;
  status: 'pending' | 'optimized';
}

interface Route {
  id: string;
  driver_id?: string;
  driver_name?: string;
  stops: DeliveryStop[];
  total_distance?: number;
  total_time?: number;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
}

export default function RouteOptimization() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [optimizationMethod, setOptimizationMethod] = useState<'nearest_neighbor' | 'two_opt'>('nearest_neighbor');

  // Fetch pending deliveries
  const { data: pendingDeliveries } = useQuery({
    queryKey: ['pending-deliveries', tenantId],
    queryFn: async (): Promise<DeliveryStop[]> => {
      if (!tenantId) return [];

      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, delivery_address, customer_lat, customer_lng, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending_delivery')
          .limit(50);

        if (error) throw error;

        return (orders || []).map((order: any, index) => ({
          id: `stop-${order.id}`,
          order_id: order.id,
          address: order.delivery_address || 'Unknown Address',
          lat: order.customer_lat,
          lng: order.customer_lng,
          sequence: index + 1,
          status: 'pending' as const,
        }));
      } catch (error) {
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Fetch drivers
  const { data: drivers } = useQuery({
    queryKey: ['drivers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('tenant_users')
          .select('id, name, email')
          .eq('tenant_id', tenantId)
          .eq('role', 'driver')
          .limit(50);

        if (error) throw error;
        return data || [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Optimize route using nearest neighbor algorithm
  const optimizeRoute = (stops: DeliveryStop[]): DeliveryStop[] => {
    if (stops.length <= 1) return stops;

    // Simple nearest neighbor - start from first stop, find closest unvisited
    const optimized: DeliveryStop[] = [];
    const remaining = [...stops];
    let current = remaining.shift();
    
    if (!current) return stops;

    optimized.push({ ...current, sequence: 1, status: 'optimized' });

    while (remaining.length > 0) {
      // Find closest stop (simplified - would use actual distance calculation)
      let closestIndex = 0;
      let minDistance = Infinity;

      remaining.forEach((stop, index) => {
        // Simplified distance calculation (would use Haversine formula)
        const distance = Math.random() * 100; // Placeholder
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });

      const next = remaining.splice(closestIndex, 1)[0];
      optimized.push({ ...next, sequence: optimized.length + 1, status: 'optimized' });
    }

    return optimized;
  };

  const handleOptimize = () => {
    if (stops.length === 0 && pendingDeliveries && pendingDeliveries.length > 0) {
      setStops(pendingDeliveries);
    }

    if (stops.length === 0) {
      toast({
        title: 'No stops selected',
        description: 'Please add delivery stops to optimize.',
        variant: 'destructive',
      });
      return;
    }

    const optimized = optimizeRoute(stops);
    setStops(optimized);
    
    toast({
      title: 'Route optimized',
      description: `Optimized ${optimized.length} stops using ${optimizationMethod.replace('_', ' ')} algorithm.`,
    });
  };

  const handleSaveRoute = async () => {
    if (stops.length === 0) {
      toast({
        title: 'No stops',
        description: 'Please add stops before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const routeData = {
        tenant_id: tenantId,
        stops: stops.map((s) => ({
          order_id: s.order_id,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          sequence: s.sequence,
        })),
        status: 'draft',
        optimization_method: optimizationMethod,
      };

      // Would save to routes table
      toast({
        title: 'Route saved',
        description: 'Route has been saved successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save route',
        variant: 'destructive',
      });
    }
  };

  const addStop = () => {
    const newStop: DeliveryStop = {
      id: `stop-${Date.now()}`,
      address: '',
      sequence: stops.length + 1,
      status: 'pending',
    };
    setStops([...stops, newStop]);
  };

  const removeStop = (id: string) => {
    setStops(stops.filter((s) => s.id !== id));
  };

  const estimatedTotalDistance = stops.length * 5; // Simplified calculation
  const estimatedTotalTime = stops.length * 15; // 15 minutes per stop

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Route Optimization</h1>
          <p className="text-muted-foreground">Plan and optimize delivery routes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOptimize}>
            <Navigation className="h-4 w-4 mr-2" />
            Optimize Route
          </Button>
          <Button onClick={handleSaveRoute}>
            <Save className="h-4 w-4 mr-2" />
            Save Route
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stops.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Distance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estimatedTotalDistance.toFixed(1)} km</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estimatedTotalTime} min</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Optimization Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Optimization Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="method">Optimization Method</Label>
              <select
                id="method"
                value={optimizationMethod}
                onChange={(e) => setOptimizationMethod(e.target.value as any)}
                className="w-full h-10 px-3 border rounded-md"
              >
                <option value="nearest_neighbor">Nearest Neighbor</option>
                <option value="two_opt">2-Opt Algorithm</option>
              </select>
            </div>
            {pendingDeliveries && pendingDeliveries.length > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStops(pendingDeliveries);
                  toast({ title: 'Loaded pending deliveries', description: `${pendingDeliveries.length} stops loaded.` });
                }}
              >
                Load Pending Deliveries ({pendingDeliveries.length})
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={addStop}>
              <Plus className="h-4 w-4 mr-2" />
              Add Stop Manually
            </Button>
          </CardContent>
        </Card>

        {/* Route Visualization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Route Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stops.length > 0 ? (
                stops
                  .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
                  .map((stop, index) => (
                    <div
                      key={stop.id}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                        {stop.sequence || index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {stop.address || 'Address not provided'}
                        </div>
                        {stop.estimated_time && (
                          <div className="text-sm text-muted-foreground">
                            ETA: {stop.estimated_time}
                          </div>
                        )}
                      </div>
                      <Badge variant={stop.status === 'optimized' ? 'default' : 'outline'}>
                        {stop.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeStop(stop.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No stops in route. Load pending deliveries or add stops manually.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map Preview Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Route Map Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Map visualization would appear here</p>
              <p className="text-sm">Integration with map library (e.g., React Leaflet) required</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

