import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Download, TrendingUp, Clock, Users } from 'lucide-react';
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
} from 'recharts';

export default function PosAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: posData, isLoading } = useQuery({
    queryKey: ['pos-analytics', tenantId, timeframe],
    queryFn: async () => {
      if (!tenantId) return null;

      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get POS transactions
      const { data: transactions, error } = await supabase
        .from('pos_transactions')
        .select('*, cashiers:tenant_users(name), products(*)')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error && error.code === '42P01') {
        // Table doesn't exist, fallback to orders with source filter
        const { data: orders } = await supabase
          .from('orders')
          .select('*, order_items(*, products(*))')
          .eq('tenant_id', tenantId)
          .eq('source', 'pos')
          .gte('created_at', startDate.toISOString());

        return { transactions: orders || [], isOrders: true };
      }

      if (error) throw error;
      return { transactions: transactions || [], isOrders: false };
    },
    enabled: !!tenantId,
  });

  // Calculate metrics
  const totalRevenue = posData?.transactions.reduce(
    (sum: number, t: any) => sum + Number(t.total_amount || t.amount || 0),
    0
  ) || 0;
  const totalTransactions = posData?.transactions.length || 0;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Cashier performance
  const cashierPerformance = posData?.transactions.reduce((acc: any, t: any) => {
    const cashierId = t.cashier_id || t.cashier_name || 'unknown';
    if (!acc[cashierId]) {
      acc[cashierId] = {
        name: t.cashiers?.name || cashierId,
        transactions: 0,
        revenue: 0,
      };
    }
    acc[cashierId].transactions++;
    acc[cashierId].revenue += Number(t.total_amount || t.amount || 0);
    return acc;
  }, {} as Record<string, { name: string; transactions: number; revenue: number }>);

  const cashierData = cashierPerformance
    ? Object.values(cashierPerformance)
        .map((cashier) => ({
          name: cashier.name,
          transactions: cashier.transactions,
          revenue: cashier.revenue,
          avgValue: cashier.transactions > 0 ? cashier.revenue / cashier.transactions : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    : [];

  // Hourly trends
  const hourlyData = posData?.transactions.reduce((acc: Record<string, number>, t: any) => {
    const hour = new Date(t.created_at).getHours();
    acc[hour] = (acc[hour] || 0) + Number(t.total_amount || t.amount || 0);
    return acc;
  }, {});

  const hourlyChartData = hourlyData
    ? Array.from({ length: 24 }, (_, hour) => ({
        hour: `${hour}:00`,
        revenue: hourlyData[hour] || 0,
      }))
    : [];

  // Peak hours
  const peakHour = hourlyChartData.reduce(
    (max, curr) => (curr.revenue > max.revenue ? curr : max),
    hourlyChartData[0] || { hour: '0:00', revenue: 0 }
  );

  // Daily trends
  const dailyData = posData?.transactions.reduce((acc: Record<string, number>, t: any) => {
    const date = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    acc[date] = (acc[date] || 0) + Number(t.total_amount || t.amount || 0);
    return acc;
  }, {});

  const dailyChartData = Object.entries(dailyData || {})
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Product performance in-store
  const productPerformance: Record<string, { name: string; quantity: number; revenue: number }> = {};
  posData?.transactions.forEach((t: any) => {
    if (t.order_items) {
      t.order_items.forEach((item: any) => {
        const productName = item.products?.name || 'Unknown';
        if (!productPerformance[productName]) {
          productPerformance[productName] = { name: productName, quantity: 0, revenue: 0 };
        }
        productPerformance[productName].quantity += Number(item.quantity || 0);
        productPerformance[productName].revenue += Number(item.price || 0) * Number(item.quantity || 0);
      });
    }
  });

  const topProducts = Object.values(productPerformance)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading POS analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">POS Analytics</h1>
          <p className="text-muted-foreground">Analyze in-store sales and cashier performance</p>
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
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgTransactionValue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Peak Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{peakHour.hour}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="w-full">
        <TabsList>
          <TabsTrigger value="trends">Sales Trends</TabsTrigger>
          <TabsTrigger value="cashiers">Cashier Performance</TabsTrigger>
          <TabsTrigger value="products">Product Performance</TabsTrigger>
          <TabsTrigger value="hours">Peak Hours</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Revenue Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dailyChartData}>
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

        <TabsContent value="cashiers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cashier Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={cashierData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#0088FE" name="Revenue" />
                  <Bar dataKey="transactions" fill="#00C49F" name="Transactions" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {cashierData.map((cashier) => (
                  <div key={cashier.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{cashier.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {cashier.transactions} transactions
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${cashier.revenue.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        ${cashier.avgValue.toFixed(2)} avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Products (In-Store)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Hour of Day</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <div>
                    <div className="font-semibold">Peak Hour: {peakHour.hour}</div>
                    <div className="text-sm text-muted-foreground">
                      Highest revenue hour of the day
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

