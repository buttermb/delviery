import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { ANALYTICS_QUERY_CONFIG } from '@/lib/react-query-config';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { chartSemanticColors } from '@/lib/chartColors';

interface TopSellingProductsProps {
  storeId: string;
  dateRange: { from: Date | undefined; to: Date | undefined };
  className?: string;
}

interface ProductSales {
  name: string;
  quantity: number;
  revenue: number;
}

/** Truncate long product names for the Y-axis */
function truncateName(name: string, maxLen = 18): string {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;
}

export function TopSellingProducts({ storeId, dateRange, className }: TopSellingProductsProps) {
  const { data: products, isLoading, error } = useQuery({
    queryKey: queryKeys.analytics.products(storeId, { from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() }),
    queryFn: async (): Promise<ProductSales[]> => {
      let query = supabase
        .from('storefront_orders')
        .select('items, created_at')
        .eq('store_id', storeId);

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError || !orders?.length) {
        if (ordersError) logger.warn('Failed to fetch orders for top products', ordersError);
        return [];
      }

      const productMap = new Map<string, { quantity: number; revenue: number }>();

      orders.forEach((order) => {
        const items = (order.items as Array<{ name?: string; quantity?: number; price?: number }>) ?? [];
        items.forEach((item) => {
          const name = item.name || 'Unknown Product';
          const existing = productMap.get(name) || { quantity: 0, revenue: 0 };
          productMap.set(name, {
            quantity: existing.quantity + (item.quantity || 1),
            revenue: existing.revenue + ((item.quantity ?? 1) * (item.price ?? 0)),
          });
        });
      });

      return Array.from(productMap.entries())
        .map(([name, data]) => ({
          name,
          quantity: data.quantity,
          revenue: Math.round(data.revenue * 100) / 100,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    },
    enabled: !!storeId,
    ...ANALYTICS_QUERY_CONFIG,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !products?.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
          <CardDescription>Best performing products by revenue</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[300px] text-muted-foreground">
          No product data available
        </CardContent>
      </Card>
    );
  }

  // Reverse so the highest-revenue product is at the top of the horizontal chart
  const chartData = [...products].reverse();
  const chartHeight = Math.max(280, chartData.length * 36);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Top Selling Products</CardTitle>
        <CardDescription>Best performing products by revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: chartHeight }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatCurrency(v)}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickFormatter={truncateName}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={130}
              />
              <Tooltip
                formatter={(value: number, _name: string, entry) => {
                  const qty = (entry.payload as ProductSales).quantity;
                  return [
                    `${formatCurrency(value)} (${qty} units)`,
                    'Revenue',
                  ];
                }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar
                dataKey="revenue"
                fill={chartSemanticColors.primary}
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
