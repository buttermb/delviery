import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MapPin, TrendingUp, DollarSign } from 'lucide-react';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { queryKeys } from '@/lib/queryKeys';

export default function LocationAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: locations, isLoading } = useQuery({
    queryKey: queryKeys.locationAnalytics.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('locations')
          .select('*, orders(*)')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading location analytics..." />;
  }

  const locationStats = (locations || []).map((location) => ({
    name: location.name || location.location_name || 'Unknown',
    orders: (location.orders as unknown as { total: string | number }[] | null)?.length || 0,
    revenue: (location.orders as unknown as { total: string | number }[] | null)?.reduce((sum: number, o) => sum + parseFloat(String(o.total || 0)), 0) || 0,
  }));

  const totalLocations = locations?.length || 0;
  const totalRevenue = locationStats.reduce((sum, loc) => sum + loc.revenue, 0);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Location Analytics</h1>
        <p className="text-muted-foreground">Performance metrics by location</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLocations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per Location</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalLocations > 0 ? (totalRevenue / totalLocations).toFixed(2) : '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      {locationStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Location</CardTitle>
            <CardDescription>Sales performance by location</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={locationStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {locationStats.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No location data available. Location analytics will appear here once locations are configured.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

