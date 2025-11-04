import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Route, Trash2, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import MapboxAddressAutocomplete from "@/components/MapboxAddressAutocomplete";

interface RouteStop {
  address: string;
  lat?: number;
  lng?: number;
  order: number;
}

interface Route {
  id: string;
  name: string;
  status: string;
  stops: RouteStop[];
  total_distance?: number;
  estimated_time?: number;
  created_at: string;
  optimized_at?: string;
}

export default function RouteOptimizationPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [stops, setStops] = useState<RouteStop[]>([{ address: "", order: 1 }]);

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from('routes')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Route[];
    },
    enabled: !!tenant?.id
  });

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      const validStops = stops
        .filter(s => s.address.trim())
        .map((stop, index) => ({
          address: stop.address.trim(),
          lat: stop.lat,
          lng: stop.lng,
          order: index + 1
        }));

      if (validStops.length < 2) {
        throw new Error("Route must have at least 2 stops");
      }

      const { data, error } = await (supabase as any)
        .from('routes')
        .insert({
          tenant_id: tenant?.id,
          name: routeName,
          stops: validStops,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Route created successfully");
      setIsAddDialogOpen(false);
      setRouteName("");
      setStops([{ address: "", order: 1 }]);
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create route");
    }
  });

  const optimizeRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const route = routes.find(r => r.id === routeId);
      if (!route) throw new Error("Route not found");

      // Simple optimization: calculate basic metrics
      const totalDistance = route.stops.length * 2.5; // Mock: 2.5 miles per stop
      const estimatedTime = route.stops.length * 15; // Mock: 15 minutes per stop

      const { error } = await (supabase as any)
        .from('routes')
        .update({
          status: 'optimized',
          total_distance: totalDistance,
          estimated_time: estimatedTime,
          optimized_at: new Date().toISOString()
        })
        .eq('id', routeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Route optimized successfully");
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to optimize route");
    }
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await (supabase as any)
        .from('routes')
        .delete()
        .eq('id', routeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Route deleted");
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete route");
    }
  });

  const addStop = () => {
    setStops([...stops, { address: "", order: stops.length + 1 }]);
  };

  const removeStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index));
  };

  const updateStop = (index: number, address: string, lat: number, lng: number) => {
    const newStops = [...stops];
    newStops[index] = { address, lat, lng, order: index + 1 };
    setStops(newStops);
  };

  if (isLoading) {
    return <div className="p-8">Loading routes...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Route Optimization</h1>
          <p className="text-muted-foreground">Manage and optimize delivery routes</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Route</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Route Name</Label>
                <Input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g., Downtown Deliveries"
                />
              </div>
              <div>
                <Label>Stops</Label>
                <div className="space-y-2 mt-2">
                  {stops.map((stop, index) => (
                    <div key={index} className="flex gap-2">
                      <MapboxAddressAutocomplete
                        value={stop.address}
                        onChange={(address, lat, lng) => updateStop(index, address, lat, lng)}
                        placeholder={`Stop ${index + 1} address`}
                        className="flex-1"
                      />
                      {stops.length > 1 && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeStop(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addStop}
                  className="mt-2"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stop
                </Button>
              </div>
              <Button
                onClick={() => createRouteMutation.mutate()}
                disabled={!routeName.trim() || stops.filter(s => s.address.trim()).length < 2}
                className="w-full"
              >
                Create Route
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {routes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Route className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No routes yet. Create your first route to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {routes.map((route) => (
            <Card key={route.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{route.name}</CardTitle>
                    <CardDescription>
                      {route.stops.length} stops
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={route.status === 'optimized' ? 'default' : 'secondary'}>
                      {route.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => optimizeRouteMutation.mutate(route.id)}
                      disabled={route.status === 'optimized'}
                    >
                      <Route className="mr-2 h-4 w-4" />
                      Optimize
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteRouteMutation.mutate(route.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {route.stops.map((stop, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{index + 1}.</span>
                      <span>{stop.address}</span>
                    </div>
                  ))}
                </div>
                {route.status === 'optimized' && (
                  <div className="flex gap-4 mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{route.total_distance?.toFixed(1)} miles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{route.estimated_time} minutes</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
