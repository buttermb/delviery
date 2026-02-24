/**
 * Storefront Analytics Page
 * Displays aggregated metrics for the storefront including
 * revenue, orders, conversion rate, AOV, top products, and traffic sources.
 */

import { useState } from 'react';
import { subDays } from 'date-fns';
import { ShoppingCart, DollarSign, TrendingUp, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { RevenueChart } from '@/components/admin/analytics/RevenueChart';
import { AverageOrderValueChart } from '@/components/admin/analytics/AverageOrderValueChart';
import { TopSellingProducts } from '@/components/admin/analytics/TopSellingProducts';
import { TrafficSources } from '@/components/admin/analytics/TrafficSources';
import { ConversionRateChart } from '@/components/admin/analytics/ConversionRateChart';
import { CustomerRetentionChart } from '@/components/admin/analytics/CustomerRetentionChart';

interface OrderMetrics {
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  averageOrderValue: number;
}

export default function StorefrontAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  // Get the store ID for this tenant
  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: queryKeys.storefrontAnalyticsStore.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data } = await supabase
        .from('marketplace_profiles')
        .select('id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch summary metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: queryKeys.analytics.orders(tenant?.id, { storeId: store?.id, from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() }),
    queryFn: async (): Promise<OrderMetrics> => {
      if (!store?.id) return { totalOrders: 0, totalRevenue: 0, conversionRate: 0, averageOrderValue: 0 };

      let query = supabase
        .from('storefront_orders')
        .select('id, total, status, created_at')
        .eq('store_id', store.id);

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data: orders, error } = await query;

      if (error || !orders?.length) {
        if (error) logger.warn('Failed to fetch order metrics', error);
        return { totalOrders: 0, totalRevenue: 0, conversionRate: 0, averageOrderValue: 0 };
      }

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const completedOrders = orders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
      // Conversion rate: completed orders vs estimated visitors (5x order count)
      const estimatedVisitors = totalOrders * 5;
      const conversionRate = estimatedVisitors > 0
        ? Math.round((completedOrders / estimatedVisitors) * 1000) / 10
        : 0;
      const averageOrderValue = totalOrders > 0
        ? Math.round((totalRevenue / totalOrders) * 100) / 100
        : 0;

      return { totalOrders, totalRevenue: Math.round(totalRevenue * 100) / 100, conversionRate, averageOrderValue };
    },
    enabled: !!store?.id,
  });

  if (storeLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No active storefront found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header with date range filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Storefront Analytics</h2>
          <p className="text-muted-foreground">
            Insights into your customers and sales performance.
          </p>
        </div>
        <DateRangePickerWithPresets
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          className="w-[280px]"
        />
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">${(metrics?.totalRevenue || 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.totalOrders || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.conversionRate || 0}%</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">${(metrics?.averageOrderValue || 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart - full width */}
      <RevenueChart storeId={store.id} dateRange={dateRange} />

      {/* Two-column grid for remaining charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopSellingProducts storeId={store.id} dateRange={dateRange} />
        <TrafficSources storeId={store.id} dateRange={dateRange} />
        <AverageOrderValueChart storeId={store.id} />
        <ConversionRateChart storeId={store.id} />
        <CustomerRetentionChart storeId={store.id} />
      </div>
    </div>
  );
}
