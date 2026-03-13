import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { Loader2, TrendingUp, Package, Star, AlertTriangle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from '@/components/ui/lazy-recharts';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS } from '@/lib/chartColors';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { subDays, startOfDay, endOfDay } from 'date-fns';

interface ProductPerformanceReportProps {
  tenantId: string;
}

type DateRange = '7d' | '30d' | '90d';

interface ProductPerformance {
  productId: string;
  productName: string;
  sku: string | null;
  unitsSold: number;
  revenue: number;
  averagePrice: number;
  category: string | null;
}

interface ProductStats {
  topSellingProducts: ProductPerformance[];
  categoryPerformance: Array<{ category: string; revenue: number; units: number }>;
  totalProductsSold: number;
  totalRevenue: number;
  averageUnitsPerProduct: number;
  lowPerformingProducts: ProductPerformance[];
}

export function ProductPerformanceReport({ tenantId }: ProductPerformanceReportProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data: productStats, isLoading } = useQuery({
    queryKey: queryKeys.analytics.products(tenantId, { dateRange }),
    queryFn: async (): Promise<ProductStats> => {
      const days = parseInt(dateRange);
      const endDate = endOfDay(new Date());
      const startDate = startOfDay(subDays(endDate, days));

      // Fetch order items from unified_orders
      const { data: orderItems } = await (supabase as any)
        .from('order_items')
        .select(`
          id,
          product_id,
          quantity,
          price,
          order:unified_orders!inner(tenant_id, created_at, status)
        `)
        .eq('order.tenant_id', tenantId)
        .gte('order.created_at', startDate.toISOString())
        .lte('order.created_at', endDate.toISOString())
        .in('order.status', ['confirmed', 'delivered', 'completed', 'paid']);

      // Fetch product details
      const productIds = [...new Set((orderItems ?? []).map((item: any) => item.product_id))];
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, category')
        .in('id', productIds);

      const productMap = new Map(products?.map(p => [p.id, p]) ?? []);

      // Calculate product performance
      const productPerformance = new Map<string, ProductPerformance>();

      (orderItems ?? []).forEach((item: any) => {
        const product = productMap.get(item.product_id);
        if (!product) return;

        const existing = productPerformance.get(item.product_id);
        const quantity = Number(item.quantity) || 0;
        const revenue = quantity * (Number(item.price) || 0);

        if (existing) {
          existing.unitsSold += quantity;
          existing.revenue += revenue;
          existing.averagePrice = existing.revenue / existing.unitsSold;
        } else {
          productPerformance.set(item.product_id, {
            productId: item.product_id,
            productName: product.name,
            sku: product.sku,
            unitsSold: quantity,
            revenue,
            averagePrice: Number(item.price) || 0,
            category: product.category
          });
        }
      });

      const allProducts = Array.from(productPerformance.values());

      // Top selling products (by revenue)
      const topSellingProducts = allProducts
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Low performing products (by units sold)
      const lowPerformingProducts = allProducts
        .sort((a, b) => a.unitsSold - b.unitsSold)
        .slice(0, 5);

      // Category performance
      const categoryMap = new Map<string, { revenue: number; units: number }>();
      allProducts.forEach(p => {
        const category = p.category || 'Uncategorized';
        const existing = categoryMap.get(category);
        if (existing) {
          existing.revenue += p.revenue;
          existing.units += p.unitsSold;
        } else {
          categoryMap.set(category, { revenue: p.revenue, units: p.unitsSold });
        }
      });

      const categoryPerformance = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      const totalProductsSold = allProducts.reduce((sum, p) => sum + p.unitsSold, 0);
      const totalRevenue = allProducts.reduce((sum, p) => sum + p.revenue, 0);
      const averageUnitsPerProduct = allProducts.length > 0 ? totalProductsSold / allProducts.length : 0;

      return {
        topSellingProducts,
        categoryPerformance,
        totalProductsSold,
        totalRevenue,
        averageUnitsPerProduct,
        lowPerformingProducts
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!productStats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Product Performance</h2>
          <p className="text-sm text-muted-foreground">Analyze product sales and trends</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(range)}
            >
              {range === '7d' && '7 Days'}
              {range === '30d' && '30 Days'}
              {range === '90d' && '90 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productStats.totalProductsSold.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Product Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(productStats.totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Units/Product</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productStats.averageUnitsPerProduct.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Selling Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
          <CardDescription>By revenue in selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productStats.topSellingProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" tickFormatter={(value) => `$${value}`} />
                <YAxis dataKey="productName" type="category" className="text-xs" width={150} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]}>
                  {productStats.topSellingProducts.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Performance & Low Performers */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Revenue distribution by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productStats.categoryPerformance}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill={CHART_COLORS[0]}
                    dataKey="revenue"
                  >
                    {productStats.categoryPerformance.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low Performing Products</CardTitle>
            <CardDescription>Products with lowest sales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {productStats.lowPerformingProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
              {productStats.lowPerformingProducts.map((product) => (
                <div key={product.productId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">{product.productName}</p>
                      {product.sku && (
                        <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{product.unitsSold} units</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
