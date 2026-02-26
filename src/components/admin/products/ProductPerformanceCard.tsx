/**
 * ProductPerformanceCard Component
 *
 * Analytics card for product detail page showing:
 * - Units sold (7d/30d/90d)
 * - Revenue generated
 * - Average order quantity
 * - Sales trend chart (recharts)
 * - Customer segments buying this product
 * - Best performing day of week
 * - Comparison to category average
 *
 * Task 103: Create product performance analytics card
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Users from 'lucide-react/dist/esm/icons/users';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Package from 'lucide-react/dist/esm/icons/package';
import Target from 'lucide-react/dist/esm/icons/target';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';

// ============================================================================
// Types
// ============================================================================

interface ProductPerformanceCardProps {
  productId: string | undefined;
  productCategory?: string | null;
  className?: string;
}

interface SalesTrendPoint {
  date: string;
  label: string;
  units: number;
  revenue: number;
}

interface CustomerSegment {
  segment: string;
  count: number;
  percentage: number;
}

interface DayPerformance {
  day: string;
  dayIndex: number;
  units: number;
  revenue: number;
}

interface ProductPerformanceData {
  // Units sold by period
  unitsSold7d: number;
  unitsSold30d: number;
  unitsSold90d: number;
  // Revenue
  revenue7d: number;
  revenue30d: number;
  revenue90d: number;
  // Averages
  avgOrderQuantity: number;
  totalOrders: number;
  // Trend data for chart
  salesTrend: SalesTrendPoint[];
  // Customer segments
  customerSegments: CustomerSegment[];
  // Best performing day
  dayPerformance: DayPerformance[];
  bestDay: DayPerformance | null;
  // Category comparison
  categoryAvgUnits30d: number;
  categoryAvgRevenue30d: number;
  performanceVsCategory: number; // percentage vs category average
}

// ============================================================================
// Query Keys
// ============================================================================

const productPerformanceKeys = {
  all: ['product-performance'] as const,
  detail: (tenantId: string, productId: string) =>
    [...productPerformanceKeys.all, tenantId, productId] as const,
};

// ============================================================================
// Day names helper
// ============================================================================

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================================================
// Hook
// ============================================================================

function useProductPerformance(productId: string | undefined, productCategory?: string | null) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: productPerformanceKeys.detail(tenant?.id ?? '', productId ?? ''),
    queryFn: async (): Promise<ProductPerformanceData> => {
      if (!tenant?.id || !productId) {
        throw new Error('Missing tenant or product ID');
      }

      const now = new Date();
      const date7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const date30dAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const date90dAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Fetch order items for this product in the last 90 days
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          total,
          orders!inner(
            id,
            created_at,
            tenant_id,
            customer_id,
            customers(
              id,
              name,
              customer_type,
              tier
            )
          )
        `)
        .eq('product_id', productId)
        .eq('orders.tenant_id', tenant.id)
        .gte('orders.created_at', date90dAgo.toISOString());

      if (orderItemsError) {
        logger.error('Failed to fetch product order items', orderItemsError, {
          component: 'ProductPerformanceCard',
          productId,
        });
        throw orderItemsError;
      }

      const items = orderItems ?? [];

      // Calculate units and revenue by period
      let unitsSold7d = 0;
      let unitsSold30d = 0;
      let unitsSold90d = 0;
      let revenue7d = 0;
      let revenue30d = 0;
      let revenue90d = 0;
      let totalQuantity = 0;

      // Track by day for trend
      const dailyStats = new Map<string, { units: number; revenue: number }>();
      // Track by day of week
      const dayOfWeekStats = new Map<number, { units: number; revenue: number }>();
      // Track customer segments
      const segmentCounts = new Map<string, Set<string>>();

      items.forEach((item) => {
        const order = item.orders as unknown as {
          id: string;
          created_at: string;
          customer_id: string | null;
          customers: { id: string; name: string; customer_type: string | null; tier: string | null } | null;
        };
        const orderDate = new Date(order.created_at);
        const quantity = item.quantity ?? 0;
        const total = item.total ?? 0;

        // Calculate period totals
        if (orderDate >= date7dAgo) {
          unitsSold7d += quantity;
          revenue7d += total;
        }
        if (orderDate >= date30dAgo) {
          unitsSold30d += quantity;
          revenue30d += total;
        }
        unitsSold90d += quantity;
        revenue90d += total;
        totalQuantity += quantity;

        // Daily tracking for trend chart (last 30 days)
        if (orderDate >= date30dAgo) {
          const dateKey = orderDate.toISOString().split('T')[0];
          const existing = dailyStats.get(dateKey) ?? { units: 0, revenue: 0 };
          dailyStats.set(dateKey, {
            units: existing.units + quantity,
            revenue: existing.revenue + total,
          });
        }

        // Day of week tracking
        const dayIndex = orderDate.getDay();
        const existingDay = dayOfWeekStats.get(dayIndex) ?? { units: 0, revenue: 0 };
        dayOfWeekStats.set(dayIndex, {
          units: existingDay.units + quantity,
          revenue: existingDay.revenue + total,
        });

        // Customer segment tracking
        const customer = order.customers;
        if (customer && order.customer_id) {
          const segmentKey = customer.tier ?? customer.customer_type ?? 'Standard';
          if (!segmentCounts.has(segmentKey)) {
            segmentCounts.set(segmentKey, new Set());
          }
          const segmentSet = segmentCounts.get(segmentKey);
          if (segmentSet) segmentSet.add(order.customer_id);
        }
      });

      // Build sales trend data for the last 30 days
      const salesTrend: SalesTrendPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        const stats = dailyStats.get(dateKey) ?? { units: 0, revenue: 0 };
        salesTrend.push({
          date: dateKey,
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          units: stats.units,
          revenue: Math.round(stats.revenue * 100) / 100,
        });
      }

      // Build day performance data
      const dayPerformance: DayPerformance[] = DAY_NAMES.map((day, index) => {
        const stats = dayOfWeekStats.get(index) ?? { units: 0, revenue: 0 };
        return {
          day,
          dayIndex: index,
          units: stats.units,
          revenue: Math.round(stats.revenue * 100) / 100,
        };
      });

      // Find best performing day
      const bestDay = dayPerformance.reduce<DayPerformance | null>((best, current) => {
        if (!best || current.revenue > best.revenue) {
          return current;
        }
        return best;
      }, null);

      // Build customer segments
      const totalUniqueCustomers = Array.from(segmentCounts.values()).reduce(
        (sum, set) => sum + set.size,
        0
      );
      const customerSegments: CustomerSegment[] = Array.from(segmentCounts.entries())
        .map(([segment, customers]) => ({
          segment,
          count: customers.size,
          percentage: totalUniqueCustomers > 0
            ? Math.round((customers.size / totalUniqueCustomers) * 100)
            : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate category average (if category provided)
      let categoryAvgUnits30d = 0;
      let categoryAvgRevenue30d = 0;
      let performanceVsCategory = 0;

      if (productCategory) {
        // Get all products in category
        const { data: categoryProducts, error: categoryError } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('category', productCategory);

        if (categoryError) {
          logger.warn('Failed to fetch category products for comparison', {
            component: 'ProductPerformanceCard',
            category: productCategory,
            error: categoryError,
          });
        }

        if (!categoryError && categoryProducts && categoryProducts.length > 1) {
          const categoryProductIds = categoryProducts.map(p => p.id);

          // Get order items for category products in last 30 days
          const { data: categoryItems } = await supabase
            .from('order_items')
            .select(`
              quantity,
              total,
              orders!inner(created_at, tenant_id)
            `)
            .in('product_id', categoryProductIds)
            .eq('orders.tenant_id', tenant.id)
            .gte('orders.created_at', date30dAgo.toISOString());

          if (categoryItems && categoryItems.length > 0) {
            const categoryTotalUnits = categoryItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
            const categoryTotalRevenue = categoryItems.reduce((sum, item) => sum + (item.total ?? 0), 0);
            categoryAvgUnits30d = Math.round(categoryTotalUnits / categoryProducts.length);
            categoryAvgRevenue30d = Math.round((categoryTotalRevenue / categoryProducts.length) * 100) / 100;

            // Calculate performance vs category
            if (categoryAvgRevenue30d > 0) {
              performanceVsCategory = Math.round(((revenue30d - categoryAvgRevenue30d) / categoryAvgRevenue30d) * 100);
            }
          }
        }
      }

      // Calculate average order quantity
      const avgOrderQuantity = items.length > 0
        ? Math.round((totalQuantity / items.length) * 10) / 10
        : 0;

      return {
        unitsSold7d,
        unitsSold30d,
        unitsSold90d,
        revenue7d: Math.round(revenue7d * 100) / 100,
        revenue30d: Math.round(revenue30d * 100) / 100,
        revenue90d: Math.round(revenue90d * 100) / 100,
        avgOrderQuantity,
        totalOrders: items.length,
        salesTrend,
        customerSegments,
        dayPerformance,
        bestDay,
        categoryAvgUnits30d,
        categoryAvgRevenue30d,
        performanceVsCategory,
      };
    },
    enabled: !!tenant?.id && !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
}) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
      {trend !== undefined && trend !== 0 && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{trend > 0 ? '+' : ''}{trend}% vs category</span>
        </div>
      )}
    </div>
  );
}

function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        No sales data available
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => [
              name === 'revenue' ? formatCurrency(value) : value,
              name === 'revenue' ? 'Revenue' : 'Units',
            ]}
          />
          <Line
            type="monotone"
            dataKey="units"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomerSegmentsDisplay({ segments }: { segments: CustomerSegment[] }) {
  if (!segments.length) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No customer data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((segment) => (
        <div key={segment.segment} className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{segment.segment}</span>
              <span className="text-sm text-muted-foreground">{segment.count} customers</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${segment.percentage}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium w-12 text-right">{segment.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

function DayPerformanceDisplay({ days, bestDay }: { days: DayPerformance[]; bestDay: DayPerformance | null }) {
  const maxRevenue = Math.max(...days.map(d => d.revenue), 1);

  return (
    <div className="space-y-2">
      {days.map((day) => (
        <div key={day.day} className="flex items-center gap-3">
          <span className={`text-sm w-20 ${day.day === bestDay?.day ? 'font-bold text-primary' : ''}`}>
            {day.day.slice(0, 3)}
          </span>
          <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${day.day === bestDay?.day ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              style={{ width: `${(day.revenue / maxRevenue) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-20 text-right">
            {formatCurrency(day.revenue)}
          </span>
        </div>
      ))}
      {bestDay && (
        <div className="mt-2 p-2 bg-primary/10 rounded-lg text-center">
          <p className="text-sm">
            <Calendar className="inline h-4 w-4 mr-1" />
            Best day: <span className="font-bold">{bestDay.day}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProductPerformanceCard({
  productId,
  productCategory,
  className,
}: ProductPerformanceCardProps) {
  const { data, isLoading, error } = useProductPerformance(productId, productCategory);

  // Memoize has data check
  const hasData = useMemo(() => {
    return data && (data.unitsSold90d > 0 || data.revenue90d > 0);
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    logger.warn('ProductPerformanceCard error', error as Error, {
      component: 'ProductPerformanceCard',
      productId,
    });
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Unable to load analytics data
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!hasData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Analytics
          </CardTitle>
          <CardDescription>Sales and performance data for this product</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sales data available yet</p>
            <p className="text-sm mt-1">Analytics will appear once this product has orders</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Analytics
            </CardTitle>
            <CardDescription>Sales and performance data for this product</CardDescription>
          </div>
          {data.performanceVsCategory !== 0 && (
            <Badge
              variant={data.performanceVsCategory > 0 ? 'default' : 'secondary'}
              className={data.performanceVsCategory > 0 ? 'bg-green-500' : ''}
            >
              {data.performanceVsCategory > 0 ? '+' : ''}
              {data.performanceVsCategory}% vs category
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Units Sold (30d)"
            value={data.unitsSold30d}
            subValue={`7d: ${data.unitsSold7d} | 90d: ${data.unitsSold90d}`}
            icon={ShoppingCart}
          />
          <StatCard
            label="Revenue (30d)"
            value={formatCurrency(data.revenue30d)}
            subValue={`7d: ${formatCurrency(data.revenue7d)}`}
            icon={DollarSign}
            trend={data.performanceVsCategory}
          />
          <StatCard
            label="Avg Order Qty"
            value={data.avgOrderQuantity}
            subValue={`${data.totalOrders} total orders`}
            icon={Package}
          />
          <StatCard
            label="Category Avg"
            value={formatCurrency(data.categoryAvgRevenue30d)}
            subValue={`${data.categoryAvgUnits30d} units avg`}
            icon={Target}
          />
        </div>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trend">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trend
            </TabsTrigger>
            <TabsTrigger value="customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="days">
              <Calendar className="h-4 w-4 mr-2" />
              By Day
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-4">
            <SalesTrendChart data={data.salesTrend} />
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            <CustomerSegmentsDisplay segments={data.customerSegments} />
          </TabsContent>

          <TabsContent value="days" className="mt-4">
            <DayPerformanceDisplay days={data.dayPerformance} bestDay={data.bestDay} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ProductPerformanceCard;
