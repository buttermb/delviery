import { useState, useEffect, useMemo } from 'react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import {
  ArrowLeft, MapPin, History, TrendingUp, Clock,
  Navigation, Truck, Timer, Phone, RefreshCw,
  Calendar, Route, ChevronRight, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/SEOHead';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { LiveDeliveryMap } from '@/components/admin/LiveDeliveryMap';
import { RouteReplayMap } from '@/components/admin/maps/RouteReplayMap';
import { useRunnerLocationHistory, LocationPoint } from '@/hooks/useRunnerLocationHistory';
import { queryKeys } from '@/lib/queryKeys';
import { calculateETA, ETAResult } from '@/lib/utils/eta-calculation';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface DeliveryWithETA {
  id: string;
  status: string;
  created_at: string;
  order: {
    id: string;
    order_number?: string;
    delivery_address?: string;
    customer_name?: string;
  } | null;
  eta?: ETAResult | null;
  current_location?: { lat: number; lng: number } | null;
}

// Format date for route history grouping
function formatRouteDate(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMM d');
}

export default function RunnerLocationTracking() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const [selectedRunnerId, setSelectedRunnerId] = useState<string>('');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('live');
  const [deliveryETAs, setDeliveryETAs] = useState<Map<string, ETAResult>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch available runners
  const { data: runners = [], refetch: refetchRunners } = useQuery({
    queryKey: queryKeys.runners.list({ tenantId: tenant?.id }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('wholesale_runners')
        .select('id, full_name, vehicle_type, vehicle_plate, status, phone')
        .eq('tenant_id', tenant.id)
        .order('full_name');

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch deliveries for selected runner (all active ones for ETA tracking)
  const { data: deliveries = [], refetch: refetchDeliveries } = useQuery({
    queryKey: queryKeys.runners.deliveries(selectedRunnerId),
    queryFn: async () => {
      if (!selectedRunnerId) return [];

      const { data, error } = await supabase
        .from('wholesale_deliveries')
        .select(`
          id,
          status,
          created_at,
          current_location,
          order:orders(id, order_number, delivery_address, customer_name)
        `)
        .eq('runner_id', selectedRunnerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as unknown as DeliveryWithETA[];
    },
    enabled: !!selectedRunnerId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all active deliveries for live tracking ETA display
  const { data: allActiveDeliveries = [] } = useQuery({
    queryKey: queryKeys.activeDeliveriesEta.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('wholesale_deliveries')
        .select(`
          id,
          status,
          created_at,
          current_location,
          runner:wholesale_runners(id, full_name, phone),
          order:orders(id, order_number, delivery_address, customer_name)
        `)
        .eq('tenant_id', tenant.id)
        .in('status', ['in_transit', 'picked_up', 'assigned'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenant?.id,
    refetchInterval: 15000, // Refresh every 15 seconds for live data
  });

  // Get location history for replay
  const { locations, statistics, isLoading, refetch: refetchLocations } = useRunnerLocationHistory({
    runnerId: selectedRunnerId,
    deliveryId: selectedDeliveryId || undefined,
    enableRealtime: activeTab === 'live',
  });

  const selectedRunner = runners.find(r => r.id === selectedRunnerId);

  // Calculate ETAs for active deliveries
  useEffect(() => {
    async function calculateDeliveryETAs() {
      const newETAs = new Map<string, ETAResult>();

      for (const delivery of allActiveDeliveries) {
        const currentLoc = delivery.current_location as { lat: number; lng: number } | null;
        const order = delivery.order as { delivery_address?: string } | null;

        if (currentLoc && order?.delivery_address) {
          // For demo, use a fixed destination offset since we don't have geocoded addresses
          const destLng = currentLoc.lng + 0.02;
          const destLat = currentLoc.lat + 0.01;

          try {
            const eta = await calculateETA(
              [currentLoc.lng, currentLoc.lat],
              [destLng, destLat]
            );
            if (eta) {
              newETAs.set(delivery.id, eta);
            }
          } catch (error) {
            logger.error('Error calculating ETA for delivery', error as Error, { deliveryId: delivery.id });
          }
        }
      }

      setDeliveryETAs(newETAs);
    }

    if (allActiveDeliveries.length > 0) {
      calculateDeliveryETAs();
    }
  }, [allActiveDeliveries]);

  // Group locations by date for route history
  const groupedLocations = useMemo(() => {
    const groups: Map<string, LocationPoint[]> = new Map();

    for (const location of locations) {
      const date = new Date(location.recorded_at);
      const dateKey = formatRouteDate(date);

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      const group = groups.get(dateKey);
      if (group) group.push(location);
    }

    return groups;
  }, [locations]);

  // Calculate active deliveries stats
  const activeStats = useMemo(() => {
    const inTransit = allActiveDeliveries.filter(d => d.status === 'in_transit').length;
    const pickedUp = allActiveDeliveries.filter(d => d.status === 'picked_up').length;
    const assigned = allActiveDeliveries.filter(d => d.status === 'assigned').length;

    return { total: allActiveDeliveries.length, inTransit, pickedUp, assigned };
  }, [allActiveDeliveries]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchRunners(),
        refetchDeliveries(),
        refetchLocations(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <SEOHead
        title="GPS Tracking & Route Replay"
        description="Real-time GPS tracking and historical route replay for delivery runners"
      />

      <div className="container mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToAdmin('delivery-management')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">GPS Tracking & Route Replay</h1>
              <p className="text-muted-foreground">
                Track runners in real-time and replay historical routes
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Active Deliveries Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{activeStats.total}</div>
                <div className="text-sm text-muted-foreground">Active Deliveries</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Navigation className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{activeStats.inTransit}</div>
                <div className="text-sm text-muted-foreground">In Transit</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{activeStats.pickedUp}</div>
                <div className="text-sm text-muted-foreground">Picked Up</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Timer className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{activeStats.assigned}</div>
                <div className="text-sm text-muted-foreground">Assigned</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Runner Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Select Runner
            </CardTitle>
            <CardDescription>
              Choose a runner to view their location history and delivery ETAs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Runner</label>
                <Select value={selectedRunnerId} onValueChange={setSelectedRunnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a runner" />
                  </SelectTrigger>
                  <SelectContent>
                    {runners.map((runner) => (
                      <SelectItem key={runner.id} value={runner.id}>
                        {runner.full_name} - {runner.vehicle_type}
                        {runner.status === 'active' && (
                          <Badge variant="default" className="ml-2">Active</Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRunnerId && deliveries.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Delivery (Optional)</label>
                  <Select value={selectedDeliveryId || '__all__'} onValueChange={(v) => setSelectedDeliveryId(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All deliveries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All deliveries</SelectItem>
                      {deliveries.map((delivery) => (
                        <SelectItem key={delivery.id} value={delivery.id}>
                          Order #{delivery.order?.order_number || 'N/A'} - {delivery.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedRunner && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {selectedRunner.full_name?.charAt(0).toUpperCase() || 'R'}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{selectedRunner.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedRunner.vehicle_type} • {selectedRunner.vehicle_plate}
                  </div>
                </div>
                <Badge variant={selectedRunner.status === 'active' ? 'default' : 'secondary'}>
                  {selectedRunner.status}
                </Badge>
                {selectedRunner.phone && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${selectedRunner.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        {statistics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Route Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">Total Distance</div>
                  <div className="text-2xl font-bold">{statistics.total_distance.toFixed(2)} km</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="text-2xl font-bold">{statistics.total_duration}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">Avg Speed</div>
                  <div className="text-2xl font-bold">{statistics.average_speed.toFixed(1)} km/h</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">Max Speed</div>
                  <div className="text-2xl font-bold">{statistics.max_speed.toFixed(1)} km/h</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">GPS Points</div>
                  <div className="text-2xl font-bold">{statistics.points_count}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Live, Replay, and Route History */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="live">
              <MapPin className="h-4 w-4 mr-2" />
              Live Tracking
            </TabsTrigger>
            <TabsTrigger value="replay" disabled={!selectedRunnerId || locations.length === 0}>
              <History className="h-4 w-4 mr-2" />
              Route Replay
            </TabsTrigger>
            <TabsTrigger value="history" disabled={!selectedRunnerId || locations.length === 0}>
              <Calendar className="h-4 w-4 mr-2" />
              Route History
            </TabsTrigger>
          </TabsList>

          {/* Live Tracking Tab */}
          <TabsContent value="live" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map Section */}
              <div className="lg:col-span-2">
                <LiveDeliveryMap showAll={true} />
              </div>

              {/* ETA Panel */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      Live ETAs
                    </CardTitle>
                    <CardDescription>
                      Real-time arrival estimates for active deliveries
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      {allActiveDeliveries.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">
                          <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No active deliveries</p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {allActiveDeliveries.map((delivery) => {
                            const runner = delivery.runner as { id: string; full_name: string; phone?: string } | null;
                            const order = delivery.order as { order_number?: string; customer_name?: string; delivery_address?: string } | null;
                            const eta = deliveryETAs.get(delivery.id);

                            return (
                              <div
                                key={delivery.id}
                                className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => {
                                  if (runner?.id) {
                                    setSelectedRunnerId(runner.id);
                                    setSelectedDeliveryId(delivery.id);
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium truncate">
                                        {runner?.full_name || 'Unknown Runner'}
                                      </span>
                                      <Badge
                                        variant={
                                          delivery.status === 'in_transit' ? 'default' :
                                            delivery.status === 'picked_up' ? 'secondary' : 'outline'
                                        }
                                        className="text-xs"
                                      >
                                        {delivery.status.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                      <Route className="h-3 w-3" />
                                      Order #{order?.order_number || 'N/A'}
                                    </div>
                                    {order?.customer_name && (
                                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {order.customer_name}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    {eta ? (
                                      <>
                                        <div className="text-lg font-bold text-green-600">
                                          {eta.formatted}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          ETA: {format(eta.eta, 'h:mm a')}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">
                                        Calculating...
                                      </div>
                                    )}
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Route Replay Tab */}
          <TabsContent value="replay" className="mt-6">
            {isLoading ? (
              <Card className="p-6">
                <div className="text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                  Loading location history...
                </div>
              </Card>
            ) : locations.length > 0 ? (
              <RouteReplayMap
                locations={locations}
                statistics={statistics}
                runnerName={selectedRunner?.full_name}
              />
            ) : (
              <Card className="p-6">
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No location history available for this runner
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Route History Tab */}
          <TabsContent value="history" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Timeline */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Route Timeline
                    </CardTitle>
                    <CardDescription>
                      Historical GPS points grouped by date
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                        Loading route history...
                      </div>
                    ) : locations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Route className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No route history available. Select a runner with GPS data.
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px] pr-4">
                        {Array.from(groupedLocations.entries()).map(([dateKey, dayLocations]) => (
                          <div key={dateKey} className="mb-6 last:mb-0">
                            <div className="sticky top-0 bg-background py-2 z-10">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Calendar className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium">{dateKey}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {dayLocations.length} GPS points
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="ml-4 border-l-2 border-muted pl-6 mt-2 space-y-3">
                              {dayLocations.slice(0, 20).map((location, _idx) => (
                                <div
                                  key={location.id}
                                  className="relative flex items-start gap-3"
                                >
                                  <div className="absolute -left-[29px] w-3 h-3 rounded-full bg-muted-foreground/30" />
                                  <div className="flex-1 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">
                                        {format(new Date(location.recorded_at), 'h:mm:ss a')}
                                      </span>
                                      {location.speed !== null && (
                                        <Badge variant="outline" className="text-xs">
                                          {location.speed.toFixed(1)} km/h
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                      {location.heading !== null && (
                                        <span>Heading: {Math.round(location.heading)}°</span>
                                      )}
                                      {location.altitude !== null && (
                                        <span>Alt: {location.altitude.toFixed(0)}m</span>
                                      )}
                                      {location.battery_level !== null && (
                                        <span>Battery: {location.battery_level}%</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {dayLocations.length > 20 && (
                                <div className="text-center text-sm text-muted-foreground py-2">
                                  + {dayLocations.length - 20} more points
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Summary Stats */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {statistics ? (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm text-muted-foreground">Total Distance</span>
                          <span className="font-bold">{statistics.total_distance.toFixed(2)} km</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm text-muted-foreground">Duration</span>
                          <span className="font-bold">{statistics.total_duration}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm text-muted-foreground">Average Speed</span>
                          <span className="font-bold">{statistics.average_speed.toFixed(1)} km/h</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm text-muted-foreground">Max Speed</span>
                          <span className="font-bold">{statistics.max_speed.toFixed(1)} km/h</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm text-muted-foreground">GPS Points</span>
                          <span className="font-bold">{statistics.points_count}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        Select a runner to view statistics
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Deliveries for Selected Runner */}
                {selectedRunnerId && deliveries.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Recent Deliveries
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[200px]">
                        <div className="divide-y">
                          {deliveries.slice(0, 5).map((delivery) => (
                            <div
                              key={delivery.id}
                              className={cn(
                                "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                                selectedDeliveryId === delivery.id && "bg-muted"
                              )}
                              onClick={() => setSelectedDeliveryId(delivery.id)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">
                                  Order #{delivery.order?.order_number || 'N/A'}
                                </span>
                                <Badge
                                  variant={
                                    delivery.status === 'delivered' ? 'default' :
                                      delivery.status === 'in_transit' ? 'secondary' : 'outline'
                                  }
                                  className="text-xs"
                                >
                                  {delivery.status}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
