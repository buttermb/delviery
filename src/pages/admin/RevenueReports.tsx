import { logger } from '@/lib/logger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';

export default function RevenueReports() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // Realtime Subscription for Revenue Updates
  useEffect(() => {
    const channel = supabase
      .channel('revenue-reports-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['revenue-reports'] });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Revenue subscription error:', status, { component: 'RevenueReports' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['revenue-reports', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading revenue reports...</div>
      </div>
    );
  }

  const monthlyRevenue = (orders || []).reduce((acc: any, order: any) => {
    const month = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const existing = acc.find((item: any) => item.month === month);
    const revenue = parseFloat(order.total || 0);
    if (existing) {
      existing.revenue += revenue;
      existing.orders += 1;
    } else {
      acc.push({ month, revenue, orders: 1 });
    }
    return acc;
  }, []).sort((a: any, b: any) => new Date(a.month).getTime() - new Date(b.month).getTime());

  const totalRevenue = orders?.reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0) || 0;
  const avgRevenue = monthlyRevenue.length > 0 ? totalRevenue / monthlyRevenue.length : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Revenue Reports</h1>
        <p className="text-muted-foreground">Comprehensive revenue analysis and trends</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
            <CardTitle className="text-sm font-medium">Average Monthly</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyRevenue.length}</div>
            <p className="text-xs text-muted-foreground">Months</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue Trend</CardTitle>
          <CardDescription>Revenue by month</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No revenue data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

