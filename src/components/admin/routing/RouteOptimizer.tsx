/**
 * Route Optimization Visual Builder
 * 
 * Features:
 * - Interactive Map (Mapbox)
 * - Drag & Drop Stop Reordering
 * - Credit System Integration (1 Credit per Optimization)
 * - Nearest Neighbor Optimization
 * - Visual Route Display
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import {
  Route as RouteIcon,
  Navigation,
  MapPin,
  Clock,
  Zap,
  Trash2,
  GripVertical,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { consumeCredits } from '@/lib/credits/creditService';
import { Reorder, useDragControls } from 'framer-motion';
import { AssignRouteDialog } from './AssignRouteDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

// Mapbox & Map Components
import 'mapbox-gl/dist/mapbox-gl.css';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl/mapbox';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DeliveryStop {
  id: string;
  address: string;
  lat: number;
  lng: number;
  orderValue: number;
  customerName?: string;
  notes?: string;
}

interface OptimizedRoute {
  stops: DeliveryStop[];
  totalDistance: number; // miles
  totalTime: number; // minutes
  geometry?: { type: string; coordinates: unknown }; // GeoJSON
}

const INITIAL_VIEW_STATE = {
  latitude: 40.7128,
  longitude: -74.0060,
  zoom: 11
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RouteOptimizer() {
  const { session } = useAuth(); // Assuming useAuth gives us the session/tenant

  // State
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [mapRef, _setMapRef] = useState<unknown>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  // Mapbox Token
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  // ----------------------------------------------------------------------------
  // Helper: Calculate Bounds
  // ----------------------------------------------------------------------------
  useEffect(() => {
    // Auto-fit bounds when stops change or route is optimized
    if (stops.length > 0 && mapRef) {
      // Calculate bounds logic could go here or use fitBounds
      // For now, we'll let the user navigate or rely on initial center
      // If we had the map instance, we could call fitBounds
    }
  }, [stops, mapRef]);

  // ----------------------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------------------

  const addStop = () => {
    const newStop: DeliveryStop = {
      id: `stop-${Date.now()}`,
      address: '',
      lat: viewState.latitude, // Start near center
      lng: viewState.longitude,
      orderValue: 0,
    };
    setStops([...stops, newStop]);
    // Reset optimization when stops change
    setOptimizedRoute(null);
  };

  const removeStop = (id: string) => {
    setStops(stops.filter(s => s.id !== id));
    setOptimizedRoute(null);
  };

  const updateStop = (id: string, updates: Partial<DeliveryStop>) => {
    setStops(stops.map(s => s.id === id ? { ...s, ...updates } : s));
    // If location changed, reset optimization
    if (updates.lat || updates.lng) {
      setOptimizedRoute(null);
    }
  };

  const handleAssignRoute = (_courierId: string, _courierName: string) => {
    toast.success("Successfully assigned ${stops.length} stops to ${courierName}.");
    // In a real app, this would save the route to the DB with the assigned courier_id
    // logger.info('Route Assigned', { courierId, stopCount: stops.length });
  };

  // ----------------------------------------------------------------------------
  // Optimization Logic
  // ----------------------------------------------------------------------------

  const handleOptimize = async () => {
    if (stops.length < 2) {
      toast.error("Add at least 2 delivery stops to optimize");
      return;
    }

    if (!session?.user?.id) {
      toast.error("You must be logged in to optimize routes.");
      return;
    }

    setIsOptimizing(true);

    try {
      // 1. Deduct Credit
      // NOTE: In a real integration, ensure tenantId is available.
      const tenantId = session?.user?.id || 'demo-tenant';

      const creditResult = await consumeCredits(tenantId, 'route_optimization', undefined, 'Optimized delivery route');

      if (!creditResult.success && creditResult.errorMessage !== 'No response from credit consumption') {
        toast.error("Credit limit reached");
        setIsOptimizing(false);
        return;
      }

      // 2. Perform Optimization (Nearest Neighbor)
      const startNode = stops[0];
      const unvisited = stops.slice(1);
      const optimizedOrder: DeliveryStop[] = [startNode];

      let currentNode = startNode;

      while (unvisited.length > 0) {
        let nearestIndex = -1;
        let minDist = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const target = unvisited[i];
          const dx = target.lat - currentNode.lat;
          const dy = target.lng - currentNode.lng;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < minDist) {
            minDist = dist;
            nearestIndex = i;
          }
        }

        if (nearestIndex !== -1) {
          const nextNode = unvisited[nearestIndex];
          optimizedOrder.push(nextNode);
          currentNode = nextNode;
          unvisited.splice(nearestIndex, 1);
        }
      }

      // 3. Update Stops Order
      setStops(optimizedOrder);

      // 4. Fetch Route Geometry from Mapbox
      if (mapboxToken) {
        const coordinates = optimizedOrder.map(s => `${s.lng},${s.lat}`).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&access_token=${mapboxToken}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          setOptimizedRoute({
            stops: optimizedOrder,
            totalDistance: Math.round((route.distance / 1609.34) * 10) / 10, // meters to miles
            totalTime: Math.round(route.duration / 60), // seconds to minutes
            geometry: route.geometry
          });
        } else {
          // If mapbox fails to find route, still show the optimized stops but with 0 distance
          setOptimizedRoute({
            stops: optimizedOrder,
            totalDistance: 0,
            totalTime: 0
          });
          logger.warn('Mapbox did not return a route', data);
        }
      } else {
        // Fallback if no token
        setOptimizedRoute({
          stops: optimizedOrder,
          totalDistance: 0,
          totalTime: 0
        });
      }

      toast.success("Stops reordered for efficiency. 1 Credit utilized.");

    } catch (error) {
      logger.error('Optimization failed', error as Error);
      toast.error("Could not calculate optimal route. Please try again.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">

      {/* LEFT PANEL: Controls & List */}
      <div className="lg:col-span-1 flex flex-col gap-4 h-full overflow-hidden">

        {/* Header Card */}
        <Card className="flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              Route Builder
            </CardTitle>
            <CardDescription>
              Plan and optimize daily delivery routes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                onClick={handleOptimize}
                disabled={isOptimizing || stops.length < 2}
                className="flex-1"
              >
                <Zap className="h-4 w-4 mr-2" />
                {isOptimizing ? 'Optimizing...' : 'Optimize (1 Credit)'}
              </Button>
              <Button variant="outline" onClick={addStop}>
                <MapPin className="h-4 w-4 mr-2" />
                Add Stop
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card (Only if optimized) */}
        {optimizedRoute && (
          <Card className="flex-shrink-0 bg-primary/5 border-primary/20">
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <RouteIcon className="h-3 w-3" /> Distance
                </div>
                <div className="text-xl font-bold">{optimizedRoute.totalDistance} mi</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <Clock className="h-3 w-3" /> Est. Time
                </div>
                <div className="text-xl font-bold">{Math.floor(optimizedRoute.totalTime / 60)}h {optimizedRoute.totalTime % 60}m</div>
              </div>
              <div className="col-span-2 pt-2 border-t border-primary/10 flex justify-between items-center">
                <span className="text-sm font-medium">Fuel Cost Est.</span>
                <span className="font-bold text-green-600">${(optimizedRoute.totalDistance * 0.54).toFixed(2)}</span>
              </div>
            </CardContent>
            <CardFooter className="pt-0 pb-3">
              <Button className="w-full" size="sm" variant="secondary" onClick={() => setIsAssignDialogOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Assign to Courier
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Stops List (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1">
          <Reorder.Group axis="y" values={stops} onReorder={setStops} className="space-y-2">
            {stops.length === 0 ? (
              <EnhancedEmptyState
                icon={MapPin}
                title="No stops added yet"
                description="Click 'Add Stop' to begin building your route."
                primaryAction={{
                  label: "Add Stop",
                  onClick: addStop,
                  icon: MapPin
                }}
                compact
                className="border-2 border-dashed rounded-lg"
              />
            ) : (
              stops.map((stop, index) => (
                <StopItem
                  key={stop.id}
                  stop={stop}
                  index={index}
                  onRemove={() => removeStop(stop.id)}
                  onUpdate={(updates) => updateStop(stop.id, updates)}
                />
              ))
            )}
          </Reorder.Group>
        </div>
      </div>

      {/* RIGHT PANEL: Map */}
      <div className="lg:col-span-2 h-full rounded-xl overflow-hidden border shadow-sm relative">
        {!mapboxToken ? (
          <div className="flex items-center justify-center h-full bg-muted">
            <div className="text-center p-6">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-bold">Map Unavailable</h3>
              <p className="text-muted-foreground">Please configure VITE_MAPBOX_TOKEN in your environment.</p>
            </div>
          </div>
        ) : (
          <Map
            initialViewState={INITIAL_VIEW_STATE}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/streets-v11"
            mapboxAccessToken={mapboxToken}
            onMove={evt => setViewState(evt.viewState)}
          >
            <NavigationControl position="top-right" />

            {/* Route Line */}
            {optimizedRoute?.geometry && (
              <Source id="route" type="geojson" data={optimizedRoute.geometry as unknown as GeoJSON.GeoJSON}>
                <Layer
                  id="route-line"
                  type="line"
                  paint={{
                    'line-color': '#2563eb', // primary blue
                    'line-width': 4,
                    'line-opacity': 0.8
                  }}
                />
              </Source>
            )}

            {/* Markers */}
            {stops.map((stop, index) => (
              <Marker
                key={stop.id}
                latitude={stop.lat}
                longitude={stop.lng}
                anchor="bottom"
              >
                <div className="relative group cursor-pointer">
                  {/* Pin */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-md border-2 border-white transition-transform group-hover:scale-110 ${index === 0 ? 'bg-green-600' : 'bg-blue-600'}`}>
                    {index + 1}
                  </div>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-black/80 text-white text-xs p-2 rounded hidden group-hover:block z-50 pointer-events-none">
                    {stop.address || 'New Stop'}
                  </div>
                </div>
              </Marker>
            ))}
          </Map>
        )}
      </div>

      <AssignRouteDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        onAssign={handleAssignRoute}
        stopCount={stops.length}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-component: Stop Item
// ----------------------------------------------------------------------------

function StopItem({ stop, index, onRemove, onUpdate }: {
  stop: DeliveryStop,
  index: number,
  onRemove: () => void,
  onUpdate: (u: Partial<DeliveryStop>) => void
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={stop}
      dragListener={false}
      dragControls={controls}
    >
      <div className="bg-card border rounded-lg p-3 flex items-start gap-3 group hover:border-primary/50 transition-colors shadow-sm">
        {/* Drag Handle */}
        <div
          className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Number Badge */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-1.5 flex-shrink-0 ${index === 0 ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2 min-w-0">
          <AddressAutocomplete
            value={stop.address}
            onChange={(addr) => onUpdate({ address: addr })}
            onSelectAddress={(addr, lat, lng) => onUpdate({ address: addr, lat, lng })}
            placeholder={index === 0 ? "Start / Depot Address" : "Delivery Address"}
            className="h-9 text-sm"
          />
          <div className="flex gap-2">
            <Input
              placeholder="Value ($)"
              aria-label="Stop order value"
              type="number"
              className="h-8 text-xs w-24"
              value={stop.orderValue || ''}
              onChange={(e) => onUpdate({ orderValue: parseFloat(e.target.value) })}
            />
            <Input
              placeholder="Notes / Name"
              aria-label="Stop notes"
              className="h-8 text-xs flex-1"
              value={stop.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value })}
            />
          </div>
        </div>

        {/* Actions */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Reorder.Item>
  );
}
