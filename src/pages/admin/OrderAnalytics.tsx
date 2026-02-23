import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';

interface DayData {
  day: string;
  orders: number;
  revenue: number;
}

export default function OrderAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: orders, isLoading } = useQuery({
    queryKey: ['order-analytics', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*, products(*))')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading analytics..." />;
  }

  const ordersByDay = (orders || []).reduce((acc: DayData[], order: any) => {
    const day = new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'short' });
    const existing = acc.find(item => item.day === day);
    if (existing) {
      existing.orders += 1;
      existing.revenue += parseFloat(String(order.total || 0));
    } else {
      acc.push({ day, orders: 1, revenue: parseFloat(String(order.total || 0)) });
    }
    return acc;
  }, []);

  const totalOrders = orders?.length || 0;
  const totalRevenue = (orders as any)?.reduce((sum: number, o: any) => sum + parseFloat(String(o.total || 0)), 0) || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Order Analytics</h1>
        <p className="text-muted-foreground">Insights into your order performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
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
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgOrderValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders by Day</CardTitle>
          <CardDescription>Daily order volume and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ordersByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="orders" fill="hsl(var(--chart-1))" />
                <Bar dataKey="revenue" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No order data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

