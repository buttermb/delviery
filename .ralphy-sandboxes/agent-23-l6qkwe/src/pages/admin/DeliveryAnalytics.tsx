import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Truck, Clock, Package, TrendingUp } from 'lucide-react';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { queryKeys } from '@/lib/queryKeys';

export default function DeliveryAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: deliveries, isLoading } = useQuery({
    queryKey: queryKeys.deliveryAnalytics.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select('id, created_at, status')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading analytics..." />;
  }

  interface DayStat { date: string; count: number; completed: number }
  const deliveryStats = (deliveries ?? []).reduce((acc: DayStat[], delivery) => {
    const date = new Date(delivery.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find((item) => item.date === date);
    if (existing) {
      existing.count += 1;
      if (delivery.status === 'completed') existing.completed += 1;
    } else {
      acc.push({
        date,
        count: 1,
        completed: delivery.status === 'completed' ? 1 : 0,
      });
    }
    return acc;
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalDeliveries = deliveries?.length ?? 0;
  const completedDeliveries = deliveries?.filter((d) => d.status === 'completed').length ?? 0;
  const successRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Delivery Analytics</h1>
        <p className="text-muted-foreground">Track delivery performance and metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedDeliveries}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Trends</CardTitle>
          <CardDescription>Daily delivery volume</CardDescription>
        </CardHeader>
        <CardContent>
          {deliveryStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deliveryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" />
                <Bar dataKey="completed" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No delivery data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

