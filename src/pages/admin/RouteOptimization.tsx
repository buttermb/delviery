import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Route, Clock } from 'lucide-react';
import { useWholesaleDeliveries } from '@/hooks/useWholesaleData';

export default function RouteOptimization() {
  const { data: deliveries, isLoading } = useWholesaleDeliveries();

  // Group deliveries by runner to create "routes"
  const routes = (deliveries || []).reduce((acc: any[], delivery: any) => {
    const runnerId = delivery.runner_id || 'unassigned';
    const existingRoute = acc.find(r => r.runnerId === runnerId);

    if (existingRoute) {
      existingRoute.stops += 1;
      existingRoute.deliveries.push(delivery);
      // Update status logic if needed
    } else {
      acc.push({
        id: runnerId,
        runnerId,
        name: delivery.runner ? `Route: ${delivery.runner.full_name}` : 'Unassigned Route',
        stops: 1,
        distance: 0, // Placeholder as we don't have distance data yet
        estimated_time: 0, // Placeholder
        status: 'active', // Derived from deliveries
        deliveries: [delivery]
      });
    }
    return acc;
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading routes...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Route Optimization</h1>
          <p className="text-muted-foreground">Optimize delivery routes for efficiency</p>
        </div>
        <Button onClick={() => import("sonner").then(({ toast }) => toast.info("Optimization Engine", { description: "AI route optimization coming in next update" }))}>
          <Route className="h-4 w-4 mr-2" />
          Optimize Routes
        </Button>
      </div>

      {routes && routes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((route: any) => (
            <Card key={route.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate pr-2" title={route.name}>{route.name}</CardTitle>
                  <Badge variant={route.status === 'completed' ? 'default' : 'secondary'}>
                    {route.status}
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
                    <span>{route.distance || 0} miles</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{route.estimated_time || 0} min</span>
                  </div>
                  <div className="pt-2 mt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Deliveries:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {route.deliveries.map((d: any) => (
                        <div key={d.id} className="text-xs truncate bg-muted/50 p-1 rounded">
                          #{d.order?.order_number || d.id.slice(0, 8)} - {d.status}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

