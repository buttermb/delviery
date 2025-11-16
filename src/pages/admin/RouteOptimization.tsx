import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Route, Clock, Package } from 'lucide-react';

export default function RouteOptimization() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: routes, isLoading } = useQuery({
    queryKey: ['route-optimization', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        // Try to get optimized routes from a routes table
        const { data, error } = await supabase
          .from('routes' as any)
          .select('*, deliveries(*, orders(*))')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && error.code === '42P01') {
          // Fallback: try to get deliveries
          const { data: deliveries, error: delError } = await supabase
            .from('deliveries' as any)
            .select('*')
            .eq('tenant_id', tenantId);

          if (delError && delError.code === '42P01') return [];
          if (delError) throw delError;

          // Generate mock routes from deliveries
          return (deliveries || []).map((delivery: any) => ({
            id: delivery.id,
            name: `Route ${delivery.id.slice(0, 8)}`,
            stops: 1,
            distance: 0,
            estimated_time: 0,
            status: delivery.status || 'pending',
          }));
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

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
        <Button>
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
                  <CardTitle>{route.name || `Route ${route.id.slice(0, 8)}`}</CardTitle>
                  <Badge variant={route.status === 'completed' ? 'default' : 'secondary'}>
                    {route.status || 'pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{route.stops || 0} stops</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Route className="h-4 w-4 text-muted-foreground" />
                    <span>{route.distance || 0} miles</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{route.estimated_time || 0} min</span>
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
              <p>No routes available. Route optimization will appear here once routes are created.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

