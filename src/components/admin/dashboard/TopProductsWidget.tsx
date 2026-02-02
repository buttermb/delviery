/**
 * Top Products Widget
 * Displays best-selling products with a bar chart visualization
 */

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Package from "lucide-react/dist/esm/icons/package";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { formatWeight } from '@/lib/utils/formatWeight';
import { useNavigate, useParams } from 'react-router-dom';
import { subDays } from 'date-fns';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

interface TopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_value: number;
  order_count: number;
}

interface ChartDataPoint {
  name: string;
  value: number;
  fullName: string;
  product_id: string;
  quantity: number;
  orders: number;
}

// Color palette for chart bars
const CHART_COLORS = [
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
  '#0ea5e9', // sky-500
  '#3b82f6', // blue-500
];

export function TopProductsWidget() {
  const { account } = useAccount();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const { data: topProducts, isLoading } = useQuery({
    queryKey: ['top-products', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const last30Days = subDays(new Date(), 30);

      // Get order items from completed orders
      // @ts-expect-error - Complex Supabase query exceeds TypeScript recursion depth limit
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('id, created_at, status')
        .eq('account_id', account.id)
        .eq('status', 'completed')
        .gte('created_at', last30Days.toISOString());

      if (!orders || orders.length === 0) return [];

      interface OrderRow {
        id: string;
        created_at: string;
        status: string;
      }

      const orderIds = (orders as OrderRow[]).map((o) => o.id);

      // Get order items
      const { data: orderItems } = await supabase
        .from('wholesale_order_items')
        .select('product_id, quantity_lbs, unit_price')
        .in('order_id', orderIds);

      if (!orderItems || orderItems.length === 0) return [];

      // Aggregate by product
      const productMap = new Map<string, TopProduct>();

      interface OrderItemRow {
        product_id: string;
        quantity_lbs: number | null;
        unit_price: number | null;
      }

      (orderItems as unknown as OrderItemRow[]).forEach((item: OrderItemRow) => {
        const productId = item.product_id;
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_id: productId,
            product_name: `Product ${productId.slice(0, 8)}`,
            total_quantity: 0,
            total_value: 0,
            order_count: 0,
          });
        }

        const product = productMap.get(productId)!;
        product.total_quantity += Number(item.quantity_lbs || 0);
        product.total_value +=
          Number(item.quantity_lbs || 0) * Number(item.unit_price || 0);
        product.order_count += 1;
      });

      // Get product names
      const productIds = Array.from(productMap.keys());
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);

      interface ProductRow {
        id: string;
        name: string;
      }

      if (products) {
        (products as ProductRow[]).forEach((product) => {
          const topProduct = productMap.get(product.id);
          if (topProduct) {
            topProduct.product_name = product.name;
          }
        });
      }

      // Sort by total value and take top 5
      return Array.from(productMap.values())
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 5);
    },
    enabled: !!account?.id,
  });

  // Transform data for bar chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    return (topProducts || []).map((product) => ({
      name: truncateLabel(product.product_name, 12),
      value: Math.round(product.total_value * 100) / 100,
      fullName: product.product_name,
      product_id: product.product_id,
      quantity: product.total_quantity,
      orders: product.order_count,
    }));
  }, [topProducts]);

  // Calculate total revenue for the summary
  const totalRevenue = useMemo(() => {
    return (topProducts || []).reduce(
      (sum, p) => sum + p.total_value,
      0
    );
  }, [topProducts]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Top Products
          </h3>
          {topProducts && topProducts.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Total: <span className="font-semibold text-foreground">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="ml-2">Last 30 days</span>
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(getFullPath('/admin/analytics/comprehensive'))}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {/* Chart skeleton */}
          <Skeleton className="h-[180px] w-full" />
          {/* List skeleton */}
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-6 h-6 rounded" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : topProducts && topProducts.length > 0 ? (
        <div className="space-y-4">
          {/* Bar Chart */}
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) =>
                    `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
                  }
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Product List */}
          <div className="space-y-2 border-t pt-4">
            {topProducts.map((product, index) => (
              <div
                key={product.product_id}
                className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() =>
                  navigate(
                    getFullPath(
                      `/admin/inventory/products?product=${product.product_id}`
                    )
                  )
                }
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{
                      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {product.product_name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{formatWeight(product.total_quantity)}</span>
                      <span>•</span>
                      <span>{product.order_count} orders</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="font-semibold text-sm">
                    ${product.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {index === 0 && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      <TrendingUp className="h-2 w-2 mr-1" />
                      #1
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-[280px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No product data</p>
            <p className="text-xs mt-1">
              Complete some orders to see top products
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

// Helper function to truncate long labels for the chart
function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

// Custom tooltip component for the bar chart
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartDataPoint;
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="font-medium text-sm mb-1">{data.fullName}</p>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Revenue:{' '}
          <span className="font-semibold text-foreground">
            ${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
        <p>
          Quantity:{' '}
          <span className="font-semibold text-foreground">
            {formatWeight(data.quantity)}
          </span>
        </p>
        <p>
          Orders:{' '}
          <span className="font-semibold text-foreground">{data.orders}</span>
        </p>
      </div>
    </div>
  );
}

