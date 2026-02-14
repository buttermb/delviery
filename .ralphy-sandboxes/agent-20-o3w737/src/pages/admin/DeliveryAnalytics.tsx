import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Truck, Clock, Package, TrendingUp } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { useAnalyticsDrillDown } from '@/hooks/useAnalyticsDrillDown';
import { AnalyticsDrillDown } from '@/components/admin/analytics/AnalyticsDrillDown';
import type { DrillDownRecord } from '@/hooks/useAnalyticsDrillDown';
import { logger } from '@/lib/logger';

interface DeliveryRecord {
  id: string;
  created_at: string;
  status?: string;
  driver_name?: string;
  delivery_address?: string;
  tenant_id: string;
  [key: string]: unknown;
}

export default function DeliveryAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    drillDown,
    openDrillDown,
    closeDrillDown,
    navigateToRecord,
    isOpen,
    breadcrumbTrail,
  } = useAnalyticsDrillDown('Delivery Analytics');

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['delivery-analytics', tenantId],
    queryFn: async (): Promise<DeliveryRecord[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('deliveries' as never)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data || []) as unknown as DeliveryRecord[];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const deliveryStats = useMemo(() => {
    return (deliveries || [])
      .reduce((acc: Array<{ date: string; count: number; completed: number }>, delivery) => {
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
      }, [])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [deliveries]);

  const totalDeliveries = deliveries?.length || 0;
  const completedDeliveries = useMemo(
    () => (deliveries || []).filter((d) => d.status === 'completed').length,
    [deliveries]
  );
  const successRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;

  const handleBarClick = useCallback(
    (data: Record<string, unknown>) => {
      const dateLabel = data.date as string;
      if (!dateLabel || !deliveries) return;

      logger.debug('[DeliveryAnalytics] Bar clicked', { date: dateLabel });

      const dateDeliveries = deliveries.filter((d) => {
        const delivDate = new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return delivDate === dateLabel;
      });

      const records: DrillDownRecord[] = dateDeliveries.map((d) => ({
        id: d.id,
        label: `Delivery #${d.id.slice(0, 8)}`,
        sublabel: d.driver_name || d.delivery_address || new Date(d.created_at).toLocaleString(),
        value: d.status || 'unknown',
        entityType: 'DELIVERY' as const,
      }));

      openDrillDown({
        entityType: 'DELIVERY',
        title: `Deliveries on ${dateLabel}`,
        filterKey: dateLabel,
        filterLabel: dateLabel,
        records,
      });
    },
    [deliveries, openDrillDown]
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
        <h1 className="text-3xl font-bold">Delivery Analytics</h1>
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
          <CardDescription>Click a bar to see deliveries for that day</CardDescription>
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
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-1))"
                  cursor="pointer"
                  onClick={handleBarClick}
                />
                <Bar
                  dataKey="completed"
                  fill="hsl(var(--chart-2))"
                  cursor="pointer"
                  onClick={handleBarClick}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No delivery data available</div>
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
