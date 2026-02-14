import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalyticsDrillDown } from '@/hooks/useAnalyticsDrillDown';
import { AnalyticsDrillDown } from '@/components/admin/analytics/AnalyticsDrillDown';
import type { DrillDownRecord } from '@/hooks/useAnalyticsDrillDown';
import { logger } from '@/lib/logger';

interface DayData {
  day: string;
  orders: number;
  revenue: number;
}

interface OrderRecord {
  id: string;
  created_at: string;
  total?: number | string;
  status?: string;
  customer_name?: string;
  tenant_id: string;
  [key: string]: unknown;
}

export default function OrderAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    drillDown,
    openDrillDown,
    closeDrillDown,
    navigateToRecord,
    isOpen,
    breadcrumbTrail,
  } = useAnalyticsDrillDown('Order Analytics');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['order-analytics', tenantId],
    queryFn: async (): Promise<OrderRecord[]> => {
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
        return (data || []) as unknown as OrderRecord[];
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && (error as Record<string, unknown>).code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const ordersByDay = useMemo(() => {
    return (orders || []).reduce((acc: DayData[], order) => {
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
  }, [orders]);

  const totalOrders = orders?.length || 0;
  const totalRevenue = useMemo(
    () => (orders || []).reduce((sum, o) => sum + parseFloat(String(o.total || 0)), 0),
    [orders]
  );
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const handleBarClick = useCallback(
    (data: Record<string, unknown>) => {
      const dayLabel = data.day as string;
      if (!dayLabel || !orders) return;

      logger.debug('[OrderAnalytics] Bar clicked', { day: dayLabel });

      const dayOrders = orders.filter((order) => {
        const orderDay = new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'short' });
        return orderDay === dayLabel;
      });

      const records: DrillDownRecord[] = dayOrders.map((order) => ({
        id: order.id,
        label: `Order #${order.id.slice(0, 8)}`,
        sublabel: new Date(order.created_at).toLocaleString(),
        value: `$${parseFloat(String(order.total || 0)).toFixed(2)}`,
        entityType: 'ORDER' as const,
      }));

      openDrillDown({
        entityType: 'ORDER',
        title: `Orders on ${dayLabel}`,
        filterKey: dayLabel,
        filterLabel: dayLabel,
        records,
      });
    },
    [orders, openDrillDown]
  );

  const handleRecordClick = useCallback(
    (record: DrillDownRecord) => {
      navigateToRecord(record.entityType, record.id);
    },
    [navigateToRecord]
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order Analytics</h1>
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
          <CardDescription>Click a bar to see orders for that day</CardDescription>
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
                <Bar
                  dataKey="orders"
                  fill="hsl(var(--chart-1))"
                  cursor="pointer"
                  onClick={handleBarClick}
                />
                <Bar
                  dataKey="revenue"
                  fill="hsl(var(--chart-2))"
                  cursor="pointer"
                  onClick={handleBarClick}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No order data available</div>
          )}
        </CardContent>
      </Card>

      <AnalyticsDrillDown
        open={isOpen}
        onOpenChange={(open) => { if (!open) closeDrillDown(); }}
        drillDown={drillDown}
        breadcrumbTrail={breadcrumbTrail}
        onRecordClick={handleRecordClick}
      />
    </div>
  );
}
