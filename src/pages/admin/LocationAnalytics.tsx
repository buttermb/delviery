import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Download } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function LocationAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: locationData, isLoading } = useQuery({
    queryKey: ['location-analytics', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Fetch locations
      const locations = await Promise.all([
        // Try locations table
        supabase
          .from('locations')
          .select('id, name, address, status')
          .eq('tenant_id', tenantId)
          .limit(50),
        // Try inventory_locations
        supabase
          .from('inventory_locations')
          .select('id, name, address')
          .eq('account_id', tenantId)
          .limit(50),
        // Try warehouse locations from inventory
        supabase
          .from('wholesale_inventory')
          .select('warehouse_location')
          .eq('tenant_id', tenantId)
          .limit(100),
      ]);

      const locationList: Array<{ id: string; name: string; address?: string }> = [];

      // Process results
      if (!locations[0].error && locations[0].data) {
        locationList.push(...(locations[0].data.map((loc: any) => ({ id: loc.id, name: loc.name, address: loc.address }))));
      }
      if (!locations[1].error && locations[1].data) {
        locationList.push(...(locations[1].data.map((loc: any) => ({ id: loc.id, name: loc.name, address: loc.address }))));
      }
      if (!locations[2].error && locations[2].data) {
        const uniqueWarehouses = [...new Set(locations[2].data.map((inv: any) => inv.warehouse_location))];
        uniqueWarehouses.forEach((wh) => {
          if (!locationList.find((l) => l.name === wh)) {
            locationList.push({ id: wh, name: wh });
          }
        });
      }

      // Get orders by location
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, delivery_location, created_at')
        .eq('tenant_id', tenantId)
        .limit(1000);

      if (ordersError) throw ordersError;

      // Aggregate revenue by location
      const revenueByLocation: Record<string, number> = {};
      const ordersByLocation: Record<string, number> = {};

      orders?.forEach((order: any) => {
        const location = order.delivery_location || 'Unknown';
        revenueByLocation[location] = (revenueByLocation[location] || 0) + Number(order.total_amount || 0);
        ordersByLocation[location] = (ordersByLocation[location] || 0) + 1;
      });

      // Get inventory by location
      const { data: inventory, error: inventoryError } = await supabase
        .from('wholesale_inventory')
        .select('warehouse_location, weight_lbs, price_per_lb')
        .eq('tenant_id', tenantId)
        .limit(1000);

      const inventoryByLocation: Record<string, { quantity: number; value: number }> = {};

      inventory?.forEach((inv: any) => {
        const location = inv.warehouse_location || 'Unknown';
        if (!inventoryByLocation[location]) {
          inventoryByLocation[location] = { quantity: 0, value: 0 };
        }
        inventoryByLocation[location].quantity += Number(inv.weight_lbs || 0);
        inventoryByLocation[location].value += Number(inv.weight_lbs || 0) * Number(inv.price_per_lb || 0);
      });

      return {
        locations: locationList,
        revenueByLocation,
        ordersByLocation,
        inventoryByLocation,
      };
    },
    enabled: !!tenantId,
  });

  const revenueChartData = locationData
    ? Object.entries(locationData.revenueByLocation)
        .map(([location, revenue]) => ({
          location: location.length > 20 ? location.slice(0, 20) + '...' : location,
          revenue,
          orders: locationData.ordersByLocation[location] || 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    : [];

  const inventoryChartData = locationData
    ? Object.entries(locationData.inventoryByLocation)
        .map(([location, data]) => ({
          location: location.length > 20 ? location.slice(0, 20) + '...' : location,
          quantity: data.quantity,
          value: data.value,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
    : [];

  const totalRevenue = Object.values(locationData?.revenueByLocation || {}).reduce((sum, rev) => sum + rev, 0);
  const totalOrders = Object.values(locationData?.ordersByLocation || {}).reduce((sum, ord) => sum + ord, 0);
  const topLocation = revenueChartData.length > 0 ? revenueChartData[0].location : 'N/A';

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading location analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Location Analytics</h1>
          <p className="text-muted-foreground">Analyze performance metrics by location</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locationData?.locations.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{topLocation}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="w-full">
        <TabsList>
          <TabsTrigger value="revenue">Revenue by Location</TabsTrigger>
          <TabsTrigger value="orders">Orders by Location</TabsTrigger>
          <TabsTrigger value="inventory">Inventory by Location</TabsTrigger>
          <TabsTrigger value="comparison">Location Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="location" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="location" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="orders" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Value by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={inventoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="location" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#FF8042" name="Inventory Value ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {revenueChartData.map((data, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{data.location}</div>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Revenue</div>
                        <div className="font-bold">${data.revenue.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Orders</div>
                        <div className="font-bold">{data.orders}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Order Value</div>
                        <div className="font-bold">
                          ${data.orders > 0 ? (data.revenue / data.orders).toFixed(2) : '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {revenueChartData.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No location data available. Orders or inventory may not be associated with locations.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

