import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

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
        const items = (order.items as Array<{ name?: string; quantity?: number; price?: number }>) || [];
        items.forEach((item) => {
          const name = item.name || 'Unknown Product';
          const existing = productMap.get(name) || { quantity: 0, revenue: 0 };
          productMap.set(name, {
            quantity: existing.quantity + (item.quantity || 1),
            revenue: existing.revenue + ((item.quantity || 1) * (item.price || 0)),
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

  const maxRevenue = products[0]?.revenue || 1;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Top Selling Products</CardTitle>
        <CardDescription>Best performing products by revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {products.map((product, index) => (
            <div key={product.name} className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{product.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">${product.revenue.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{product.quantity} units sold</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
