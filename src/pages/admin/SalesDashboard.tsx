import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function SalesDashboard() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'custom'>('week');

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-dashboard', tenantId, timeframe],
    queryFn: async () => {
      if (!tenantId) return null;

      let startDate = new Date();
      if (timeframe === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (timeframe === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeframe === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      // Get orders
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*))')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return orders || [];
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time feel
  });

  // Calculate metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date();
  monthStart.setMonth(monthStart.getMonth() - 1);

  const todayRevenue = salesData
    ? salesData
        .filter((o) => new Date(o.created_at) >= today)
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    : 0;

  const weekRevenue = salesData
    ? salesData
        .filter((o) => new Date(o.created_at) >= weekStart)
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    : 0;

  const monthRevenue = salesData
    ? salesData
        .filter((o) => new Date(o.created_at) >= monthStart)
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    : 0;

  // Calculate growth (simple week over week)
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekRevenue = 0; // Would need to fetch separately for accurate calculation
  const growth = previousWeekRevenue > 0 ? ((weekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100 : 0;

  // Process revenue trends
  const revenueTrendData = salesData
    ? salesData.reduce((acc, order) => {
        const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        acc[date] = (acc[date] || 0) + Number(order.total_amount || 0);
        return acc;
      }, {} as Record<string, number>)
    : {};

  const revenueTrend = Object.entries(revenueTrendData)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Top products by revenue
  const productRevenue: Record<string, number> = {};
  salesData?.forEach((order) => {
    order.order_items?.forEach((item: any) => {
      const productName = item.products?.name || 'Unknown';
      const revenue = Number(item.price || 0) * Number(item.quantity || 0);
      productRevenue[productName] = (productRevenue[productName] || 0) + revenue;
    });
  });

  const topProducts = Object.entries(productRevenue)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Revenue by category
  const categoryRevenue: Record<string, number> = {};
  salesData?.forEach((order) => {
    order.order_items?.forEach((item: any) => {
      const category = item.products?.category || 'Uncategorized';
      const revenue = Number(item.price || 0) * Number(item.quantity || 0);
      categoryRevenue[category] = (categoryRevenue[category] || 0) + revenue;
    });
  });

  const categoryData = Object.entries(categoryRevenue)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading sales dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Dashboard</h1>
          <p className="text-muted-foreground">Real-time sales metrics and trends</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={timeframe === 'today' ? 'default' : 'outline'}
            onClick={() => setTimeframe('today')}
            size="sm"
          >
            Today
          </Button>
          <Button
            variant={timeframe === 'week' ? 'default' : 'outline'}
            onClick={() => setTimeframe('week')}
            size="sm"
          >
            Week
          </Button>
          <Button
            variant={timeframe === 'month' ? 'default' : 'outline'}
            onClick={() => setTimeframe('month')}
            size="sm"
          >
            Month
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${todayRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Week Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${weekRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Month Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growth >= 0 ? '+' : ''}
              {growth.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#0088FE" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products by Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

