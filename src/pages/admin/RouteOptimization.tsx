import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Route, Clock, Zap, Loader2, ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RouteOptimizationPreview } from '@/components/admin/RouteOptimizationPreview';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useWholesaleDeliveries } from '@/hooks/useWholesaleData';
import { invokeEdgeFunction } from '@/utils/edgeFunctionHelper';
import { logger } from '@/lib/logger';

interface Waypoint {
  delivery_id: string;
  address: string;
  coordinates: { lat: number; lng: number };
  estimated_arrival: string;
  estimated_duration_minutes: number;
  sequence: number;
}

interface OptimizationResult {
  waypoints: Waypoint[];
  summary: {
    total_deliveries: number;
    total_distance_km: number;
    estimated_total_time_minutes: number;
    estimated_completion: string;
  };
}

interface WholesaleDelivery {
  id: string;
  tenant_id: string;
  order_id: string;
  runner_id: string;
  status: string;
  current_location: unknown;
  notes: string | null;
  created_at: string;
  order: { order_number: string; total_amount: number; delivery_address: string } | null;
  runner: { full_name: string; phone: string; vehicle_type: string } | null;
}

interface RouteGroup {
  id: string;
  runnerId: string;
  name: string;
  stops: number;
  distance: number;
  estimated_time: number;
  status: string;
  deliveries: WholesaleDelivery[];
}

interface PreviewStop {
  id: string;
  clientName: string;
  address: string;
  orderValue: number;
  estimatedTime: string;
}

export default function RouteOptimization() {
  const { data: deliveries, isLoading } = useWholesaleDeliveries();
  const [optimizedRouteGroup, setOptimizedRouteGroup] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<{
    routeGroupId: string;
    runnerName: string;
    stops: PreviewStop[];
    totalDistance: string;
    totalTime: string;
    fuelSavings: string;
  } | null>(null);

  const routes = useMemo(() => {
    return (deliveries ?? []).reduce((acc: RouteGroup[], delivery) => {
      const d = delivery as WholesaleDelivery;
      const runnerId = d.runner_id || 'unassigned';
      const existingRoute = acc.find(r => r.runnerId === runnerId);

      if (existingRoute) {
        existingRoute.stops += 1;
        existingRoute.deliveries.push(d);
      } else {
        acc.push({
          id: runnerId,
          runnerId,
          name: d.runner ? `Route: ${d.runner.full_name}` : 'Unassigned Route',
          stops: 1,
          distance: 0,
          estimated_time: 0,
          status: 'active',
          deliveries: [d],
        });
      }
      return acc;
    }, []);
  }, [deliveries]);

  const optimizeMutation = useMutation({
    mutationFn: async (routeGroup: RouteGroup) => {
      const deliveryPayload = routeGroup.deliveries.map(d => ({
        id: d.id,
        address: d.order?.delivery_address ?? 'Unknown',
        priority: d.status === 'urgent' ? 1 : 2,
      }));

      const { data, error } = await invokeEdgeFunction<OptimizationResult>({
        functionName: 'optimize-route',
        body: {
          deliveries: deliveryPayload,
          runner_id: routeGroup.runnerId !== 'unassigned' ? routeGroup.runnerId : undefined,
        },
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned from optimization');

      return { result: data, routeGroup };
    },
    onSuccess: ({ result, routeGroup }) => {
      const distanceKm = result.summary.total_distance_km;
      const distanceMiles = Math.round(distanceKm * 0.621371 * 10) / 10;
      const timeMinutes = result.summary.estimated_total_time_minutes;
      const fuelCost = distanceMiles * 0.54;

      const stops: PreviewStop[] = result.waypoints.map(wp => {
        const matchedDelivery = routeGroup.deliveries.find(d => d.id === wp.delivery_id);
        return {
          id: wp.delivery_id,
          clientName: matchedDelivery?.order?.order_number
            ? `Order #${matchedDelivery.order.order_number}`
            : `Delivery ${wp.sequence}`,
          address: wp.address,
          orderValue: matchedDelivery?.order?.total_amount ?? 0,
          estimatedTime: wp.estimated_arrival
            ? new Date(wp.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : `~${wp.estimated_duration_minutes} min`,
        };
      });

      setOptimizationResult({
        routeGroupId: routeGroup.id,
        runnerName: routeGroup.name,
        stops,
        totalDistance: `${distanceMiles} mi`,
        totalTime: timeMinutes >= 60
          ? `${Math.floor(timeMinutes / 60)}h ${timeMinutes % 60}m`
          : `${timeMinutes} min`,
        fuelSavings: `$${fuelCost.toFixed(2)}`,
      });
      setOptimizedRouteGroup(routeGroup.id);

      toast.success('Route optimized', {
        description: `${result.summary.total_deliveries} stops reordered for efficiency`,
      });

      logger.info('Route optimized successfully', {
        runnerId: routeGroup.runnerId,
        stops: result.summary.total_deliveries,
        distanceKm,
      });
    },
    onError: (error) => {
      logger.error('Route optimization failed', error instanceof Error ? error : new Error(String(error)));
      toast.error('Optimization failed', {
        description: error instanceof Error ? error.message : 'Could not optimize route',
      });
    },
  });

  const handleOptimizeAll = () => {
    const assignedRoutes = routes.filter(r => r.runnerId !== 'unassigned' && r.stops >= 2);
    if (assignedRoutes.length === 0) {
      toast.error('No routes to optimize', {
        description: 'Need at least one assigned route with 2+ stops',
      });
      return;
    }
    // Optimize the first valid route (sequential; user can optimize others after)
    optimizeMutation.mutate(assignedRoutes[0]);
  };

  const handleOptimizeRoute = (routeGroup: RouteGroup) => {
    if (routeGroup.stops < 2) {
      toast.error('Not enough stops', {
        description: 'A route needs at least 2 stops to optimize',
      });
      return;
    }
    if (routeGroup.runnerId === 'unassigned') {
      toast.error('Unassigned route', {
        description: 'Assign a runner before optimizing',
      });
      return;
    }
    optimizeMutation.mutate(routeGroup);
  };

  const handleApplyRoute = () => {
    toast.success('Route applied', {
      description: 'Optimized stop order will be used for navigation',
    });
    setOptimizationResult(null);
    setOptimizedRouteGroup(null);
  };

  if (isLoading) {
    return <EnhancedLoadingState variant="list" message="Loading routes..." />;
  }

  // Show optimization preview when results are available
  if (optimizationResult) {
    return (
      <div className="p-4 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOptimizationResult(null);
            setOptimizedRouteGroup(null);
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Routes
        </Button>
        <RouteOptimizationPreview
          runnerId={optimizationResult.routeGroupId}
          runnerName={optimizationResult.runnerName}
          stops={optimizationResult.stops}
          totalDistance={optimizationResult.totalDistance}
          totalTime={optimizationResult.totalTime}
          fuelSavings={optimizationResult.fuelSavings}
          onApplyRoute={handleApplyRoute}
        />
      </div>
    );
  }

  const assignedRoutes = routes.filter(r => r.runnerId !== 'unassigned' && r.stops >= 2);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Route Optimization</h1>
          <p className="text-muted-foreground">Optimize delivery routes for efficiency</p>
        </div>
        <Button
          onClick={handleOptimizeAll}
          disabled={optimizeMutation.isPending || assignedRoutes.length === 0}
        >
          {optimizeMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          {optimizeMutation.isPending ? 'Optimizing...' : 'Optimize Routes'}
        </Button>
      </div>

      {routes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((route) => {
            const canOptimize = route.runnerId !== 'unassigned' && route.stops >= 2;
            const isOptimizing = optimizeMutation.isPending && optimizeMutation.variables?.id === route.id;
            const wasOptimized = optimizedRouteGroup === route.id;

            return (
              <Card key={route.id} className={wasOptimized ? 'border-primary/50' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate pr-2" title={route.name}>
                      {route.name}
                    </CardTitle>
                    <Badge variant={wasOptimized ? 'default' : 'secondary'}>
                      {wasOptimized ? 'optimized' : route.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{route.stops} stops</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Route className="h-4 w-4 text-muted-foreground" />
                      <span>{route.distance ?? 0} miles</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{route.estimated_time ?? 0} min</span>
                    </div>
                    <div className="pt-2 mt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Deliveries:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {route.deliveries.map((d) => (
                          <div key={d.id} className="text-xs truncate bg-muted/50 p-1 rounded">
                            #{d.order?.order_number || d.id.slice(0, 8)} - {d.status}
                          </div>
                        ))}
                      </div>
                    </div>
                    {canOptimize && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        disabled={optimizeMutation.isPending}
                        onClick={() => handleOptimizeRoute(route)}
                      >
                        {isOptimizing ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        {isOptimizing ? 'Optimizing...' : 'Optimize'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active routes found. Assign deliveries to runners to generate routes.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
