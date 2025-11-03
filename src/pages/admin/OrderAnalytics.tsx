import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Download, Calendar } from 'lucide-react';
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface OrderData {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items?: Array<{
    id: string;
    quantity: number;
    price: number;
    products?: {
      name: string;
      category: string;
    };
  }>;
}

export default function OrderAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data: orderData, isLoading } = useQuery({
    queryKey: ['order-analytics', tenantId, dateRange, startDate, endDate],
    queryFn: async (): Promise<OrderData[]> => {
      if (!tenantId) return [];

      let query = supabase
        .from('orders')
        .select('*, order_items(*, products(*))')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Apply date filter
      if (dateRange === 'custom' && startDate && endDate) {
        query = query
          .gte('created_at', new Date(startDate).toISOString())
          .lte('created_at', new Date(endDate).toISOString());
      } else {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const start = new Date();
        start.setDate(start.getDate() - days);
        query = query.gte('created_at', start.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Process data for charts
  const processRevenueData = () => {
    if (!orderData) return [];
    
    const dailyData: Record<string, number> = {};
    
    orderData.forEach((order) => {
      const date = new Date(order.created_at).toLocaleDateString();
      dailyData[date] = (dailyData[date] || 0) + Number(order.total_amount || 0);
    });

    return Object.entries(dailyData)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const processStatusData = () => {
    if (!orderData) return [];
    
    const statusCounts: Record<string, number> = {};
    orderData.forEach((order) => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  };

  const processTopProducts = () => {
    if (!orderData) return [];
    
    const productRevenue: Record<string, number> = {};
    
    orderData.forEach((order) => {
      order.order_items?.forEach((item) => {
        const productName = item.products?.name || 'Unknown';
        const revenue = Number(item.price || 0) * Number(item.quantity || 0);
        productRevenue[productName] = (productRevenue[productName] || 0) + revenue;
      });
    });

    return Object.entries(productRevenue)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };

  const revenueData = processRevenueData();
  const statusData = processStatusData();
  const topProducts = processTopProducts();

  const totalRevenue = orderData?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
  const avgOrderValue = orderData?.length ? totalRevenue / orderData.length : 0;
  const totalOrders = orderData?.length || 0;

  const handleExport = () => {
    if (!orderData) return;
    
    const csv = [
      ['Date', 'Order ID', 'Status', 'Amount'].join(','),
      ...orderData.map((order) =>
        [
          new Date(order.created_at).toLocaleDateString(),
          order.id,
          order.status,
          order.total_amount,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Order Analytics</h1>
          <p className="text-muted-foreground">Analyze order trends and performance</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgOrderValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={dateRange === '7d' ? 'default' : 'outline'}
              onClick={() => setDateRange('7d')}
              size="sm"
            >
              Last 7 Days
            </Button>
            <Button
              variant={dateRange === '30d' ? 'default' : 'outline'}
              onClick={() => setDateRange('30d')}
              size="sm"
            >
              Last 30 Days
            </Button>
            <Button
              variant={dateRange === '90d' ? 'default' : 'outline'}
              onClick={() => setDateRange('90d')}
              size="sm"
            >
              Last 90 Days
            </Button>
            <Button
              variant={dateRange === 'custom' ? 'default' : 'outline'}
              onClick={() => setDateRange('custom')}
              size="sm"
            >
              Custom
            </Button>
          </div>
          {dateRange === 'custom' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="w-full">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="status">Order Status</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={revenueData}>
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
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
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
                  <Bar dataKey="value" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

