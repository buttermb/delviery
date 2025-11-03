import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Download, TrendingUp, Clock, MapPin } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function DeliveryAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  // Fetch deliveries
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['delivery-analytics', tenantId, timeframe],
    queryFn: async () => {
      if (!tenantId) return [];

      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      try {
        // Try wholesale_deliveries first
        const { data, error } = await supabase
          .from('wholesale_deliveries')
          .select('*, orders:wholesale_orders(*), runners:wholesale_runners(*)')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data;
        }

        // Fallback: try deliveries table
        const { data: deliveriesAlt, error: altError } = await supabase
          .from('deliveries')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (!altError && deliveriesAlt) {
          return deliveriesAlt;
        }

        return [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Calculate metrics
  const totalDeliveries = deliveries?.length || 0;
  const completedDeliveries = deliveries?.filter((d: any) => d.status === 'delivered' || d.status === 'completed').length || 0;
  const onTimeRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;

  // Calculate average delivery time
  const deliveryTimes = deliveries
    ?.filter((d: any) => d.delivered_at && d.picked_up_at)
    .map((d: any) => {
      const pickup = new Date(d.picked_up_at || d.created_at);
      const delivered = new Date(d.delivered_at);
      return (delivered.getTime() - pickup.getTime()) / (1000 * 60); // minutes
    }) || [];

  const avgDeliveryTime = deliveryTimes.length > 0
    ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
    : 0;

  // Delivery status breakdown
  const statusData = deliveries
    ? deliveries.reduce((acc: Record<string, number>, delivery: any) => {
        const status = delivery.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    : {};

  const statusChartData = Object.entries(statusData).map(([name, value]) => ({ name, value }));

  // Daily delivery trends
  const dailyTrends = deliveries
    ? deliveries.reduce((acc: Record<string, number>, delivery: any) => {
        const date = new Date(delivery.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {})
    : {};

  const trendData = Object.entries(dailyTrends)
    .map(([date, count]) => ({ date, deliveries: count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Driver performance
  const driverPerformance = deliveries
    ? deliveries.reduce((acc: Record<string, { count: number; completed: number }>, delivery: any) => {
        const driverId = delivery.runner_id || delivery.courier_id || 'unknown';
        if (!acc[driverId]) {
          acc[driverId] = { count: 0, completed: 0 };
        }
        acc[driverId].count++;
        if (delivery.status === 'delivered' || delivery.status === 'completed') {
          acc[driverId].completed++;
        }
        return acc;
      }, {})
    : {};

  const driverData = Object.entries(driverPerformance)
    .map(([driverId, stats]) => ({
      driver: `Driver ${driverId.slice(0, 8)}`,
      total: stats.count,
      completed: stats.completed,
      success_rate: stats.count > 0 ? (stats.completed / stats.count) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const handleExport = () => {
    if (!deliveries) return;

    const csv = [
      ['Date', 'Status', 'Driver', 'Delivery Time (min)'].join(','),
      ...deliveries.map((d: any) => {
        const deliveryTime = d.delivered_at && d.picked_up_at
          ? ((new Date(d.delivered_at).getTime() - new Date(d.picked_up_at).getTime()) / (1000 * 60)).toFixed(2)
          : 'N/A';
        return [
          new Date(d.created_at).toLocaleDateString(),
          d.status || 'unknown',
          d.runner_id || 'N/A',
          deliveryTime,
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery-analytics-${timeframe}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading delivery analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Delivery Analytics</h1>
          <p className="text-muted-foreground">Analyze delivery performance and driver metrics</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={timeframe === '7d' ? 'default' : 'outline'}
            onClick={() => setTimeframe('7d')}
            size="sm"
          >
            7 Days
          </Button>
          <Button
            variant={timeframe === '30d' ? 'default' : 'outline'}
            onClick={() => setTimeframe('30d')}
            size="sm"
          >
            30 Days
          </Button>
          <Button
            variant={timeframe === '90d' ? 'default' : 'outline'}
            onClick={() => setTimeframe('90d')}
            size="sm"
          >
            90 Days
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedDeliveries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On-Time Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onTimeRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Delivery Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDeliveryTime.toFixed(0)} min</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="w-full">
        <TabsList>
          <TabsTrigger value="trends">Delivery Trends</TabsTrigger>
          <TabsTrigger value="status">Status Breakdown</TabsTrigger>
          <TabsTrigger value="drivers">Driver Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Delivery Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="deliveries" stroke="#0088FE" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Driver Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={driverData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="driver" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#0088FE" name="Total Deliveries" />
                  <Bar dataKey="completed" fill="#00C49F" name="Completed" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {driverData.map((driver) => (
                  <div key={driver.driver} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{driver.driver}</div>
                      <div className="text-sm text-muted-foreground">
                        {driver.completed} of {driver.total} completed
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{driver.success_rate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Success Rate</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

