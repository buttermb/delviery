import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, History, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/SEOHead';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { LiveDeliveryMap } from '@/components/admin/LiveDeliveryMap';
import { RouteReplayMap } from '@/components/admin/maps/RouteReplayMap';
import { useRunnerLocationHistory } from '@/hooks/useRunnerLocationHistory';

export default function RunnerLocationTracking() {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const [selectedRunnerId, setSelectedRunnerId] = useState<string>('');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');

  // Fetch available runners
  const { data: runners = [] } = useQuery({
    queryKey: ['wholesale-runners', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('wholesale_runners')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch deliveries for selected runner
  const { data: deliveries = [] } = useQuery({
    queryKey: ['runner-deliveries', selectedRunnerId],
    queryFn: async () => {
      if (!selectedRunnerId) return [];
      
      const { data, error } = await supabase
        .from('wholesale_deliveries')
        .select('id, status, created_at, order:orders(*)')
        .eq('runner_id', selectedRunnerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRunnerId,
  });

  // Get location history for replay
  const { locations, statistics, isLoading } = useRunnerLocationHistory({
    runnerId: selectedRunnerId,
    deliveryId: selectedDeliveryId || undefined,
    enableRealtime: false,
  });

  const selectedRunner = runners.find(r => r.id === selectedRunnerId);

  return (
    <>
      <SEOHead 
        title="GPS Tracking & Route Replay"
        description="Real-time GPS tracking and historical route replay for delivery runners"
      />

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">GPS Tracking & Route Replay</h1>
              <p className="text-muted-foreground">
                Track runners in real-time and replay historical routes
              </p>
            </div>
          </div>
        </div>

        {/* Runner Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Select Runner
            </CardTitle>
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
                  <Select value={selectedDeliveryId} onValueChange={setSelectedDeliveryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All deliveries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All deliveries</SelectItem>
                      {deliveries.map((delivery: any) => (
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
                <div className="flex-1">
                  <div className="font-medium">{selectedRunner.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedRunner.vehicle_type} • {selectedRunner.vehicle_plate}
                  </div>
                </div>
                <Badge variant={selectedRunner.status === 'active' ? 'default' : 'secondary'}>
                  {selectedRunner.status}
                </Badge>
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
                <div>
                  <div className="text-sm text-muted-foreground">Total Distance</div>
                  <div className="text-2xl font-bold">{statistics.total_distance.toFixed(2)} km</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="text-2xl font-bold">{statistics.total_duration}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Avg Speed</div>
                  <div className="text-2xl font-bold">{statistics.average_speed.toFixed(1)} km/h</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Max Speed</div>
                  <div className="text-2xl font-bold">{statistics.max_speed.toFixed(1)} km/h</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">GPS Points</div>
                  <div className="text-2xl font-bold">{statistics.points_count}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Live vs Replay */}
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="live">
              <MapPin className="h-4 w-4 mr-2" />
              Live Tracking
            </TabsTrigger>
            <TabsTrigger value="replay" disabled={!selectedRunnerId || locations.length === 0}>
              <History className="h-4 w-4 mr-2" />
              Route Replay
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-6">
            <LiveDeliveryMap showAll={true} />
          </TabsContent>

          <TabsContent value="replay" className="mt-6">
            {isLoading ? (
              <Card className="p-6">
                <div className="text-center text-muted-foreground">
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
                  No location history available for this runner
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
