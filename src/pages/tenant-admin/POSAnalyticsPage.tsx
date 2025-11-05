import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  DollarSign, TrendingUp, ShoppingCart, Clock, Users, 
  CreditCard, Package, Award, Activity 
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface POSTransaction {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  payment_method: string;
  payment_status: string;
  wholesale_clients?: {
    business_name: string;
  } | null;
}

export default function POSAnalyticsPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  // Fetch POS transactions
  const { data: transactions = [], isLoading } = useQuery<POSTransaction[]>({
    queryKey: ['pos-transactions', tenantId, timeRange],
    queryFn: async (): Promise<POSTransaction[]> => {
      if (!tenantId) return [];

      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      // Fetch wholesale orders as POS transactions
      try {
        const query = (supabase as any)
          .from('wholesale_orders')
          .select('id, order_number, total_amount, status, created_at, wholesale_clients(business_name)')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        
        // Transform to include payment method from status
        const results: POSTransaction[] = (data || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          total_amount: order.total_amount,
          status: order.status,
          created_at: order.created_at,
          payment_method: order.status === 'delivered' ? 'Cash' : 'Pending',
          payment_status: order.status === 'delivered' ? 'paid' : 'pending',
          wholesale_clients: order.wholesale_clients
        }));
        
        return results;
      } catch (error) {
        logger.error('Error fetching transactions', error, { component: 'POSAnalyticsPage' });
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Calculate metrics
  const totalRevenue = transactions.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
  const totalTransactions = transactions.length;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const completedTransactions = transactions.filter(t => t.status === 'delivered').length;
  const successRate = totalTransactions > 0 ? (completedTransactions / totalTransactions) * 100 : 0;

  // Hourly transaction pattern
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const hourTransactions = transactions.filter(t => {
      const txHour = new Date(t.created_at).getHours();
      return txHour === hour;
    });
    return {
      hour: `${hour}:00`,
      transactions: hourTransactions.length,
      revenue: hourTransactions.reduce((sum, t) => sum + Number(t.total_amount || 0), 0)
    };
  }).filter(h => h.transactions > 0);

  // Daily sales trend
  const dailySales = transactions.reduce((acc: any[], t) => {
    const date = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find(item => item.date === date);
    const revenue = Number(t.total_amount || 0);
    
    if (existing) {
      existing.revenue += revenue;
      existing.count += 1;
    } else {
      acc.push({ date, revenue, count: 1 });
    }
    return acc;
  }, []);

  // Payment method breakdown
  const paymentMethods = transactions.reduce((acc: any[], t) => {
    const method = t.payment_method || 'Unknown';
    const existing = acc.find(item => item.name === method);
    
    if (existing) {
      existing.value += 1;
      existing.amount += Number(t.total_amount || 0);
    } else {
      acc.push({ 
        name: method, 
        value: 1,
        amount: Number(t.total_amount || 0)
      });
    }
    return acc;
  }, []);

  // Cashier performance (using clients as proxy)
  const cashierPerformance = transactions.reduce((acc: any[], t) => {
    const cashier = t.wholesale_clients?.business_name || 'Unknown';
    const existing = acc.find(item => item.name === cashier);
    const revenue = Number(t.total_amount || 0);
    
    if (existing) {
      existing.transactions += 1;
      existing.revenue += revenue;
      existing.avgTransaction = existing.revenue / existing.transactions;
    } else {
      acc.push({
        name: cashier,
        transactions: 1,
        revenue: revenue,
        avgTransaction: revenue
      });
    }
    return acc;
  }, []).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading POS analytics...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">POS Analytics</h1>
          <p className="text-muted-foreground">Point of sale performance metrics and insights</p>
        </div>
        <div className="flex gap-2">
          <Badge 
            variant={timeRange === 'today' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setTimeRange('today')}
          >
            Today
          </Badge>
          <Badge 
            variant={timeRange === 'week' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setTimeRange('week')}
          >
            Week
          </Badge>
          <Badge 
            variant={timeRange === 'month' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setTimeRange('month')}
          >
            Month
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'Last 7 days' : 'Last 30 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">
              {completedTransactions} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgTransactionValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Completion rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patterns">Transaction Patterns</TabsTrigger>
          <TabsTrigger value="cashiers">Cashier Performance</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Sales Trend</CardTitle>
                <CardDescription>Revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dailySales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No sales data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction Volume</CardTitle>
                <CardDescription>Number of transactions per day</CardDescription>
              </CardHeader>
              <CardContent>
                {dailySales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="hsl(var(--chart-2))" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No transaction data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Transaction Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hourly Transaction Pattern
              </CardTitle>
              <CardDescription>Peak hours and transaction distribution throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="transactions" fill="hsl(var(--chart-1))" name="Transactions" />
                    <Bar yAxisId="right" dataKey="revenue" fill="hsl(var(--chart-2))" name="Revenue ($)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  No hourly data available
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Peak Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {hourlyData.length > 0 
                    ? hourlyData.reduce((max, h) => h.transactions > max.transactions ? h : max, hourlyData[0]).hour
                    : '--:--'
                  }
                </div>
                <p className="text-xs text-muted-foreground">Busiest hour</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Peak Revenue Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {hourlyData.length > 0 
                    ? hourlyData.reduce((max, h) => h.revenue > max.revenue ? h : max, hourlyData[0]).hour
                    : '--:--'
                  }
                </div>
                <p className="text-xs text-muted-foreground">Highest revenue hour</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{hourlyData.length}</div>
                <p className="text-xs text-muted-foreground">Hours with transactions</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cashier Performance Tab */}
        <TabsContent value="cashiers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Top Performers
              </CardTitle>
              <CardDescription>Cashier efficiency and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {cashierPerformance.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={cashierPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue ($)" />
                      <Bar dataKey="transactions" fill="hsl(var(--chart-2))" name="Transactions" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Leaderboard</h4>
                    {cashierPerformance.map((cashier, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 
                            index === 2 ? 'bg-orange-600' : 
                            'bg-muted'
                          } text-white font-bold text-sm`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{cashier.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {cashier.transactions} transactions
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${cashier.revenue.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">
                            ${cashier.avgTransaction.toFixed(2)} avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No cashier data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method Distribution
                </CardTitle>
                <CardDescription>Transaction count by payment type</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentMethods.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentMethods}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No payment data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Method Details</CardTitle>
                <CardDescription>Revenue breakdown by payment type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentMethods.map((method, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium">{method.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {method.value} transactions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${method.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          {((method.value / totalTransactions) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
