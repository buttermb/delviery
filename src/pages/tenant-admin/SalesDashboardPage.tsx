import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, ShoppingBag, Percent, CreditCard, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export default function SalesDashboardPage() {
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

  // Fetch orders for the selected time period
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['sales-dashboard-orders', tenant?.id, timeRange],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const days = getDaysFromRange(timeRange);
      const startDate = subDays(new Date(), days).toISOString();
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, 
          total_amount, 
          payment_method, 
          created_at,
          order_items(
            id,
            quantity,
            subtotal,
            product_id,
            products(name, category, cost)
          )
        `)
        .eq('tenant_id', tenant.id)
        .gte('created_at', startDate);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch previous period for comparison
  const { data: prevOrders = [] } = useQuery({
    queryKey: ['sales-dashboard-prev-orders', tenant?.id, timeRange],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const days = getDaysFromRange(timeRange);
      const startDate = subDays(new Date(), days * 2).toISOString();
      const endDate = subDays(new Date(), days).toISOString();
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', startDate)
        .lt('created_at', endDate);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalSales = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const prevTotalSales = prevOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    // Calculate profit (revenue - cost)
    let totalCost = 0;
    let totalItems = 0;
    orders.forEach(order => {
      (order.order_items || []).forEach((item: any) => {
        totalItems += item.quantity || 0;
        const cost = item.products?.cost || 0;
        totalCost += cost * (item.quantity || 0);
      });
    });
    
    const grossProfit = totalSales - totalCost;
    const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
    
    const salesGrowth = prevTotalSales > 0 
      ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 
      : totalSales > 0 ? 100 : 0;

    return {
      totalSales,
      grossProfit,
      profitMargin,
      totalItems,
      salesGrowth,
    };
  }, [orders, prevOrders]);

  // Sales data by month (last 6 months)
  const salesData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(subMonths(new Date(), i));
      
      let sales = 0;
      let cost = 0;
      
      orders.forEach(order => {
        const orderDate = new Date(order.created_at);
        if (orderDate >= monthStart && orderDate <= monthEnd) {
          sales += order.total_amount || 0;
          (order.order_items || []).forEach((item: any) => {
            cost += (item.products?.cost || 0) * (item.quantity || 0);
          });
        }
      });
      
      const profit = sales - cost;
      const margin = sales > 0 ? (profit / sales) * 100 : 0;
      
      months.push({
        month: format(monthStart, 'MMM'),
        sales,
        profit,
        margin: Math.round(margin),
      });
    }
    return months;
  }, [orders]);

  // Top products by revenue
  const topProducts = useMemo(() => {
    const productMap: Record<string, { name: string; sales: number; revenue: number }> = {};
    
    orders.forEach(order => {
      (order.order_items || []).forEach((item: any) => {
        const productName = item.products?.name || 'Unknown Product';
        if (!productMap[productName]) {
          productMap[productName] = { name: productName, sales: 0, revenue: 0 };
        }
        productMap[productName].sales += item.quantity || 0;
        productMap[productName].revenue += item.subtotal || 0;
      });
    });
    
    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({ ...p, growth: 0 })); // Growth would need previous period data
  }, [orders]);

  // Sales by category
  const salesByCategory = useMemo(() => {
    const categoryMap: Record<string, { category: string; amount: number; orders: number }> = {};
    
    orders.forEach(order => {
      (order.order_items || []).forEach((item: any) => {
        const category = item.products?.category || 'Uncategorized';
        if (!categoryMap[category]) {
          categoryMap[category] = { category, amount: 0, orders: 0 };
        }
        categoryMap[category].amount += item.subtotal || 0;
        categoryMap[category].orders += 1;
      });
    });
    
    return Object.values(categoryMap).sort((a, b) => b.amount - a.amount);
  }, [orders]);

  // Payment methods breakdown
  const paymentMethods = useMemo(() => {
    const methodMap: Record<string, number> = {};
    
    orders.forEach(order => {
      const method = order.payment_method || 'Unknown';
      methodMap[method] = (methodMap[method] || 0) + (order.total_amount || 0);
    });
    
    const total = Object.values(methodMap).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(methodMap)
      .map(([method, amount]) => ({
        method: method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' '),
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [orders]);

  const isLoading = ordersLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive overview of your sales performance</p>
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

      {/* Key Sales Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {metrics.salesGrowth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{metrics.salesGrowth.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{metrics.salesGrowth.toFixed(1)}%</span>
                </>
              )} from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.grossProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">After cost of goods</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.profitMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Gross margin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Sold</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalItems.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total units</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales & Profit Trends</CardTitle>
              <CardDescription>Monthly sales and profit performance</CardDescription>
            </CardHeader>
            <CardContent>
              {salesData.every(d => d.sales === 0) ? (
                <div className="text-center text-muted-foreground py-8">
                  No sales data available for the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Area type="monotone" dataKey="sales" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" name="Sales ($)" />
                    <Area type="monotone" dataKey="profit" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" name="Profit ($)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>Best performing items by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No product sales data available
                </div>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <span className="font-bold text-sm">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.sales} units sold</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${product.revenue.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
              <CardDescription>Revenue distribution across product categories</CardDescription>
            </CardHeader>
            <CardContent>
              {salesByCategory.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No category sales data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={salesByCategory} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <YAxis dataKey="category" type="category" width={100} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="amount" fill="hsl(var(--chart-1))" name="Revenue ($)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Sales breakdown by payment type</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentMethods.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No payment data available
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div key={method.method} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{method.method}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">${method.amount.toLocaleString()}</span>
                          <span className="text-sm text-muted-foreground ml-2">({method.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${method.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
