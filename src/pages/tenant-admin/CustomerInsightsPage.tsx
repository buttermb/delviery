import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, UserPlus, Heart, DollarSign, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function CustomerInsightsPage() {
  const { tenant } = useTenantAdminAuth();
  const [timeRange, setTimeRange] = useState('30d');

  const getDaysFromRange = (range: string) => {
    switch (range) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  };

  // Fetch all customers for metrics
  const { data: customers = [], isLoading: customersLoading, isError: customersError } = useQuery({
    queryKey: ['customer-insights-customers', tenant?.id, timeRange],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, created_at, total_spent, loyalty_points, last_purchase_at')
        .eq('tenant_id', tenant.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch orders for frequency analysis
  const { data: orders = [], isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: ['customer-insights-orders', tenant?.id, timeRange],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const days = getDaysFromRange(timeRange);
      const startDate = subDays(new Date(), days).toISOString();
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, customer_id, total_amount, created_at')
        .eq('tenant_id', tenant.id)
        .gte('created_at', startDate);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const days = getDaysFromRange(timeRange);
    const startDate = subDays(new Date(), days);
    const prevStartDate = subDays(startDate, days);

    const currentCustomers = customers.filter(c => new Date(c.created_at) >= startDate);
    const prevCustomers = customers.filter(c => {
      const created = new Date(c.created_at);
      return created >= prevStartDate && created < startDate;
    });

    const totalCustomers = customers.length;
    const newCustomers = currentCustomers.length;
    const prevNewCustomers = prevCustomers.length;

    // Retention: customers with purchases in this period who also had purchases before
    const returningCustomers = customers.filter(c => {
      const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at) : null;
      const created = new Date(c.created_at);
      return lastPurchase && lastPurchase >= startDate && created < startDate;
    }).length;

    const totalWithPurchases = customers.filter(c => c.last_purchase_at).length;
    const retentionRate = totalWithPurchases > 0 ? (returningCustomers / totalWithPurchases) * 100 : 0;

    // Average lifetime value
    const avgLTV = totalCustomers > 0
      ? customers.reduce((sum, c) => sum + (c.total_spent || 0), 0) / totalCustomers
      : 0;

    // Calculate growth percentages
    const newCustomersGrowth = prevNewCustomers > 0 
      ? ((newCustomers - prevNewCustomers) / prevNewCustomers) * 100 
      : newCustomers > 0 ? 100 : 0;

    return {
      totalCustomers,
      newCustomers,
      retentionRate,
      avgLTV,
      newCustomersGrowth,
    };
  }, [customers, timeRange]);

  // Customer growth by month (last 6 months)
  const customerGrowth = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(subMonths(new Date(), i));
      
      const newInMonth = customers.filter(c => {
        const created = new Date(c.created_at);
        return created >= monthStart && created <= monthEnd;
      }).length;

      const returningInMonth = customers.filter(c => {
        const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at) : null;
        const created = new Date(c.created_at);
        return lastPurchase && lastPurchase >= monthStart && lastPurchase <= monthEnd && created < monthStart;
      }).length;

      months.push({
        month: format(monthStart, 'MMM'),
        new: newInMonth,
        returning: returningInMonth,
        churned: 0, // Would need historical tracking to calculate properly
      });
    }
    return months;
  }, [customers]);

  // Customer segments by spending
  const customerSegments = useMemo(() => {
    const vip = customers.filter(c => (c.total_spent || 0) > 500).length;
    const regular = customers.filter(c => (c.total_spent || 0) >= 100 && (c.total_spent || 0) <= 500).length;
    const occasional = customers.filter(c => (c.total_spent || 0) >= 50 && (c.total_spent || 0) < 100).length;
    const newCust = customers.filter(c => (c.total_spent || 0) < 50).length;

    return [
      { name: 'VIP (>$500)', value: vip, color: COLORS[0] },
      { name: 'Regular ($100-500)', value: regular, color: COLORS[1] },
      { name: 'Occasional ($50-100)', value: occasional, color: COLORS[2] },
      { name: 'New (<$50)', value: newCust, color: COLORS[3] },
    ];
  }, [customers]);

  // Order frequency distribution
  const orderFrequency = useMemo(() => {
    const customerOrders: Record<string, number> = {};
    orders.forEach(o => {
      if (o.customer_id) {
        customerOrders[o.customer_id] = (customerOrders[o.customer_id] || 0) + 1;
      }
    });

    const freq1 = Object.values(customerOrders).filter(c => c === 1).length;
    const freq2_3 = Object.values(customerOrders).filter(c => c >= 2 && c <= 3).length;
    const freq4_6 = Object.values(customerOrders).filter(c => c >= 4 && c <= 6).length;
    const freq7_10 = Object.values(customerOrders).filter(c => c >= 7 && c <= 10).length;
    const freq11plus = Object.values(customerOrders).filter(c => c >= 11).length;

    return [
      { frequency: '1x', customers: freq1 },
      { frequency: '2-3x', customers: freq2_3 },
      { frequency: '4-6x', customers: freq4_6 },
      { frequency: '7-10x', customers: freq7_10 },
      { frequency: '11+x', customers: freq11plus },
    ];
  }, [orders]);

  // Top customers by spending
  const { data: topCustomers = [], isLoading: topLoading } = useQuery({
    queryKey: ['customer-insights-top', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, total_spent, last_purchase_at, loyalty_points')
        .eq('tenant_id', tenant.id)
        .order('total_spent', { ascending: false })
        .limit(5);
      
      if (error) throw error;

      // Get order counts for each customer
      const customerIds = (data || []).map(c => c.id);
      const { data: orderCounts } = await supabase
        .from('orders')
        .select('customer_id')
        .in('customer_id', customerIds);

      const countMap: Record<string, number> = {};
      (orderCounts || []).forEach(o => {
        if (o.customer_id) {
          countMap[o.customer_id] = (countMap[o.customer_id] || 0) + 1;
        }
      });

      return (data || []).map(c => ({
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        orders: countMap[c.id] || 0,
        spent: c.total_spent || 0,
        lastOrder: c.last_purchase_at 
          ? format(new Date(c.last_purchase_at), 'MMM d, yyyy')
          : 'Never',
        status: (c.total_spent || 0) > 500 ? 'VIP' : 'Regular',
      }));
    },
    enabled: !!tenant?.id,
  });

  // Orders by hour of day
  const customerBehavior = useMemo(() => {
    const hourCounts: Record<number, number> = {};
    orders.forEach(o => {
      const hour = new Date(o.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const hours = [6, 9, 12, 15, 18, 21];
    return hours.map(h => ({
      hour: `${h}:00`,
      orders: hourCounts[h] || 0,
    }));
  }, [orders]);

  const isLoading = customersLoading || ordersLoading || topLoading;

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading customer insights..." />;
  }

  if (customersError || ordersError) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">Failed to load customer insights</p>
          <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Insights</h1>
          <p className="text-muted-foreground">Understand your customer behavior and patterns</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="1y">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Customer Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.newCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {metrics.newCustomersGrowth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{metrics.newCustomersGrowth.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{metrics.newCustomersGrowth.toFixed(1)}%</span>
                </>
              )} from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.retentionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Returning customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lifetime Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.avgLTV.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per customer</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Analytics */}
      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList>
          <TabsTrigger value="growth">Customer Growth</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="frequency">Order Frequency</TabsTrigger>
          <TabsTrigger value="top">Top Customers</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Growth Trends</CardTitle>
              <CardDescription>New and returning customers over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {customerGrowth.every(m => m.new === 0 && m.returning === 0) ? (
                <div className="text-center text-muted-foreground py-8">
                  No customer data available for the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={customerGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="new" stroke="hsl(var(--chart-1))" strokeWidth={2} name="New Customers" />
                    <Line type="monotone" dataKey="returning" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Returning" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Segments</CardTitle>
              <CardDescription>Distribution by lifetime spending</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {customerSegments.every(s => s.value === 0) ? (
                <div className="text-center text-muted-foreground py-8">
                  No customer spending data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={customerSegments.filter(s => s.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {customerSegments.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frequency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Frequency Distribution</CardTitle>
              <CardDescription>How often customers order in the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {orderFrequency.every(f => f.customers === 0) ? (
                <div className="text-center text-muted-foreground py-8">
                  No order data available for the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={orderFrequency}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="frequency" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="customers" fill="hsl(var(--chart-1))" name="Customers" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
              <CardDescription>Your most valuable customers by lifetime spending</CardDescription>
            </CardHeader>
            <CardContent>
              {topLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : topCustomers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No customer data available
                </div>
              ) : (
                <div className="space-y-4">
                  {topCustomers.map((customer, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <span className="font-bold text-sm">{index + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{customer.name}</p>
                            <Badge variant={customer.status === 'VIP' ? 'default' : 'secondary'} className="text-xs">
                              {customer.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{customer.orders} orders • Last: {customer.lastOrder}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${customer.spent.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Lifetime value</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Behavior Patterns</CardTitle>
              <CardDescription>Peak ordering times throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              {customerBehavior.every(b => b.orders === 0) ? (
                <div className="text-center text-muted-foreground py-8">
                  No order timing data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={customerBehavior}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill="hsl(var(--chart-2))" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
