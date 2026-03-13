import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface PurchaseHistoryDataPoint {
  month: string;
  orders: number;
  revenue: number;
}

interface CustomerPurchaseHistoryChartProps {
  customerId: string;
  months?: number;
}

/**
 * CustomerPurchaseHistoryChart component
 *
 * Displays a bar chart of customer purchase history over time,
 * showing order count and revenue per month.
 */
export function CustomerPurchaseHistoryChart({
  customerId,
  months = 12,
}: CustomerPurchaseHistoryChartProps) {
  const { tenant } = useTenantAdminAuth();

  const { data: chartData = [], isLoading } = useQuery({
    queryKey: queryKeys.customers.detail(customerId, `purchase-history-${months}m`),
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Generate month range
      const monthRanges = Array.from({ length: months }, (_, i) => {
        const date = subMonths(new Date(), months - 1 - i);
        return {
          start: startOfMonth(date),
          end: endOfMonth(date),
          label: format(date, 'MMM yyyy'),
        };
      });

      // Fetch orders for each month
      const dataPoints: PurchaseHistoryDataPoint[] = await Promise.all(
        monthRanges.map(async ({ start, end, label }) => {
          const { data, error } = await supabase
            .from('unified_orders')
            .select('total_amount')
            .eq('tenant_id', tenant.id)
            .eq('customer_id', customerId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

          if (error) {
            console.error('Error fetching orders for month:', label, error);
            return { month: label, orders: 0, revenue: 0 };
          }

          const orders = data?.length || 0;
          const revenue = data?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;

          return {
            month: label,
            orders,
            revenue: Math.round(revenue * 100) / 100,
          };
        })
      );

      return dataPoints;
    },
    enabled: !!tenant?.id && !!customerId,
    staleTime: 60_000,
  });

  const totalOrders = chartData.reduce((sum, d) => sum + d.orders, 0);
  const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase History</CardTitle>
        <CardDescription>Order count and revenue over the last {months} months</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-sm font-medium">Total Orders</span>
            </div>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </div>
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
          </div>
        </div>

        {/* Chart */}
        {chartData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No purchase history available
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  label={{ value: 'Orders', angle: -90, position: 'insideLeft', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  label={{ value: 'Revenue ($)', angle: 90, position: 'insideRight', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [`$${value.toFixed(2)}`, 'Revenue'];
                    return [value, 'Orders'];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value) => (value === 'orders' ? 'Orders' : 'Revenue')}
                />
                <Bar yAxisId="left" dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="revenue" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
