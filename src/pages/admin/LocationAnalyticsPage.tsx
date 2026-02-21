import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, TrendingUp, Users, DollarSign, ArrowLeft } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatters';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--muted))'];

export default function LocationAnalyticsPage() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();

  const { data: locationData, isLoading } = useQuery({
    queryKey: ['location-analytics', tenant?.id],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('delivery_borough, total_amount, status')
        .eq('tenant_id', tenant?.id)
        .eq('status', 'delivered');

      const locationStats = orders?.reduce((acc: any, order) => {
        const borough = order.delivery_borough || 'Unknown';
        if (!acc[borough]) {
          acc[borough] = { name: borough, revenue: 0, orders: 0 };
        }
        acc[borough].revenue += Number(order.total_amount);
        acc[borough].orders += 1;
        return acc;
      }, {});

      interface LocationStat {
        name: string;
        revenue: number;
        orders: number;
      }
      
      const locations = Object.values(locationStats || {}) as LocationStat[];
      const totalRevenue = locations.reduce((sum, loc) => sum + loc.revenue, 0);
      const totalOrders = locations.reduce((sum, loc) => sum + loc.orders, 0);

      return {
        locations,
        totalRevenue,
        totalOrders,
        topLocation: locations.sort((a, b) => b.revenue - a.revenue)[0],
      };
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-[600px]" />;
  }

  return (
    <>
      <SEOHead title="Location Analytics" />
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigateToAdmin('analytics-hub')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8" />
            Location Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Geographic insights and location-based performance metrics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Top Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{locationData?.topLocation?.name || 'N/A'}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {formatCurrency(locationData?.topLocation?.revenue)} revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(locationData?.totalRevenue)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Across {locationData?.locations.length || 0} locations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{locationData?.totalOrders || 0}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Delivered orders
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Location</CardTitle>
            </CardHeader>
            <CardContent>
              {locationData?.locations && locationData.locations.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={locationData.locations}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.name}: ${formatCurrency(entry.revenue)}`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="revenue"
                    >
                      {locationData.locations.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No location data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders by Location</CardTitle>
            </CardHeader>
            <CardContent>
              {locationData?.locations && locationData.locations.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={locationData.locations}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No order data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
