/**
 * DeliveryAnalytics Component
 * Comprehensive delivery performance metrics dashboard
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  parseISO,
  differenceInMinutes,
  startOfDay,
  endOfDay,
  subDays,
  getDay,
  getHours,
  isWithinInterval,
} from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import {
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  Calendar,
  MapPin,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsDateRangePicker } from '@/components/admin/disposable-menus/AnalyticsDateRangePicker';

// Constants
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
);

// Types
interface DeliveryOrder {
  id: string;
  status: string;
  delivery_scheduled_at: string | null;
  delivery_completed_at: string | null;
  courier_id: string | null;
  created_at: string;
  total_amount: number;
  delivery_fee: number | null;
  delivery_zone_id: string | null;
  delivery_notes: string | null;
  couriers: {
    full_name: string;
  } | null;
  delivery_zones: {
    name: string;
  } | null;
}

interface DeliveryMetrics {
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  avgDeliveryTimeMinutes: number;
  onTimeRate: number;
  totalDeliveryFees: number;
  avgDeliveryFee: number;
}

interface ByZoneMetric {
  zone: string;
  zoneId: string | null;
  deliveries: number;
  avgTimeMinutes: number;
  onTimeRate: number;
}

interface ByRunnerMetric {
  runner: string;
  runnerId: string;
  deliveries: number;
  avgTimeMinutes: number;
  onTimeRate: number;
  deliveriesPerDay: number;
}

interface ByDayMetric {
  day: string;
  dayIndex: number;
  deliveries: number;
  avgTimeMinutes: number;
  onTimeRate: number;
}

interface OnTimeTrendPoint {
  date: string;
  label: string;
  onTimeRate: number;
  total: number;
}

interface HourlyHeatmapData {
  hour: number;
  dayOfWeek: number;
  count: number;
}

interface FailureReason {
  reason: string;
  count: number;
  percentage: number;
}

interface DeliveryAnalyticsProps {
  className?: string;
}

export function DeliveryAnalytics({ className }: DeliveryAnalyticsProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Fetch delivery data
  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.deliveries.all, 'analytics', tenantId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<DeliveryOrder[]> => {
      if (!tenantId || !dateRange?.from || !dateRange?.to) return [];

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();

      const { data: orders, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          delivery_scheduled_at,
          delivery_completed_at,
          courier_id,
          created_at,
          total_amount,
          delivery_fee,
          delivery_zone_id,
          delivery_notes,
          couriers(full_name),
          delivery_zones(name)
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['delivered', 'failed', 'cancelled', 'out_for_delivery', 'confirmed', 'pending'])
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('delivery_scheduled_at', 'is', null)
        .order('created_at', { ascending: false });

      if (fetchError) {
        logger.error('Error fetching delivery analytics', fetchError, { component: 'DeliveryAnalytics' });
        throw fetchError;
      }

      return (orders || []) as DeliveryOrder[];
    },
    enabled: !!tenantId && !!dateRange?.from && !!dateRange?.to,
    staleTime: 60000,
  });

  // Calculate metrics
  const metrics = useMemo((): DeliveryMetrics => {
    if (!data || data.length === 0) {
      return {
        totalDeliveries: 0,
        completedDeliveries: 0,
        failedDeliveries: 0,
        avgDeliveryTimeMinutes: 0,
        onTimeRate: 0,
        totalDeliveryFees: 0,
        avgDeliveryFee: 0,
      };
    }

    const completedOrders = data.filter((o) => o.status === 'delivered');
    const failedOrders = data.filter((o) => o.status === 'failed' || o.status === 'cancelled');

    // Calculate average delivery time
    const ordersWithTime = completedOrders.filter(
      (o) => o.delivery_scheduled_at && o.delivery_completed_at
    );
    let avgDeliveryTimeMinutes = 0;
    if (ordersWithTime.length > 0) {
      const totalMinutes = ordersWithTime.reduce((sum, order) => {
        const scheduled = parseISO(order.delivery_scheduled_at!);
        const completed = parseISO(order.delivery_completed_at!);
        return sum + Math.abs(differenceInMinutes(completed, scheduled));
      }, 0);
      avgDeliveryTimeMinutes = Math.round(totalMinutes / ordersWithTime.length);
    }

    // Calculate on-time rate (within 30 minutes of scheduled)
    let onTimeRate = 100;
    if (ordersWithTime.length > 0) {
      const onTimeCount = ordersWithTime.filter((order) => {
        const scheduled = parseISO(order.delivery_scheduled_at!);
        const completed = parseISO(order.delivery_completed_at!);
        return differenceInMinutes(completed, scheduled) <= 30;
      }).length;
      onTimeRate = Math.round((onTimeCount / ordersWithTime.length) * 100);
    }

    // Calculate delivery fees
    const totalDeliveryFees = completedOrders.reduce(
      (sum, o) => sum + (o.delivery_fee || 0),
      0
    );
    const avgDeliveryFee = completedOrders.length > 0
      ? totalDeliveryFees / completedOrders.length
      : 0;

    return {
      totalDeliveries: data.length,
      completedDeliveries: completedOrders.length,
      failedDeliveries: failedOrders.length,
      avgDeliveryTimeMinutes,
      onTimeRate,
      totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
      avgDeliveryFee: Math.round(avgDeliveryFee * 100) / 100,
    };
  }, [data]);

  // Metrics by zone
  const byZoneMetrics = useMemo((): ByZoneMetric[] => {
    if (!data || data.length === 0) return [];

    const zoneMap = new Map<string | null, DeliveryOrder[]>();
    data.forEach((order) => {
      const zoneId = order.delivery_zone_id;
      const existing = zoneMap.get(zoneId) || [];
      zoneMap.set(zoneId, [...existing, order]);
    });

    return Array.from(zoneMap.entries()).map(([zoneId, orders]) => {
      const completed = orders.filter((o) => o.status === 'delivered');
      const withTime = completed.filter(
        (o) => o.delivery_scheduled_at && o.delivery_completed_at
      );

      let avgTimeMinutes = 0;
      let onTimeRate = 100;

      if (withTime.length > 0) {
        const totalMinutes = withTime.reduce((sum, o) => {
          const scheduled = parseISO(o.delivery_scheduled_at!);
          const completed = parseISO(o.delivery_completed_at!);
          return sum + Math.abs(differenceInMinutes(completed, scheduled));
        }, 0);
        avgTimeMinutes = Math.round(totalMinutes / withTime.length);

        const onTimeCount = withTime.filter((o) => {
          const scheduled = parseISO(o.delivery_scheduled_at!);
          const completedTime = parseISO(o.delivery_completed_at!);
          return differenceInMinutes(completedTime, scheduled) <= 30;
        }).length;
        onTimeRate = Math.round((onTimeCount / withTime.length) * 100);
      }

      const zoneName = orders[0]?.delivery_zones?.name || 'No Zone';

      return {
        zone: zoneName,
        zoneId,
        deliveries: orders.length,
        avgTimeMinutes,
        onTimeRate,
      };
    }).sort((a, b) => b.deliveries - a.deliveries);
  }, [data]);

  // Metrics by runner
  const byRunnerMetrics = useMemo((): ByRunnerMetric[] => {
    if (!data || data.length === 0 || !dateRange?.from || !dateRange?.to) return [];

    const runnerMap = new Map<string, DeliveryOrder[]>();
    data.filter((o) => o.courier_id).forEach((order) => {
      const runnerId = order.courier_id!;
      const existing = runnerMap.get(runnerId) || [];
      runnerMap.set(runnerId, [...existing, order]);
    });

    const dayCount = Math.max(1, Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    ));

    return Array.from(runnerMap.entries()).map(([runnerId, orders]) => {
      const completed = orders.filter((o) => o.status === 'delivered');
      const withTime = completed.filter(
        (o) => o.delivery_scheduled_at && o.delivery_completed_at
      );

      let avgTimeMinutes = 0;
      let onTimeRate = 100;

      if (withTime.length > 0) {
        const totalMinutes = withTime.reduce((sum, o) => {
          const scheduled = parseISO(o.delivery_scheduled_at!);
          const completedTime = parseISO(o.delivery_completed_at!);
          return sum + Math.abs(differenceInMinutes(completedTime, scheduled));
        }, 0);
        avgTimeMinutes = Math.round(totalMinutes / withTime.length);

        const onTimeCount = withTime.filter((o) => {
          const scheduled = parseISO(o.delivery_scheduled_at!);
          const completedTime = parseISO(o.delivery_completed_at!);
          return differenceInMinutes(completedTime, scheduled) <= 30;
        }).length;
        onTimeRate = Math.round((onTimeCount / withTime.length) * 100);
      }

      const runnerName = orders[0]?.couriers?.full_name || 'Unknown Runner';

      return {
        runner: runnerName,
        runnerId,
        deliveries: orders.length,
        avgTimeMinutes,
        onTimeRate,
        deliveriesPerDay: Math.round((orders.length / dayCount) * 10) / 10,
      };
    }).sort((a, b) => b.deliveries - a.deliveries);
  }, [data, dateRange]);

  // Metrics by day of week
  const byDayMetrics = useMemo((): ByDayMetric[] => {
    if (!data || data.length === 0) return [];

    const dayMap = new Map<number, DeliveryOrder[]>();
    DAY_NAMES.forEach((_, index) => dayMap.set(index, []));

    data.forEach((order) => {
      const dayIndex = getDay(parseISO(order.created_at));
      const existing = dayMap.get(dayIndex) || [];
      dayMap.set(dayIndex, [...existing, order]);
    });

    return Array.from(dayMap.entries()).map(([dayIndex, orders]) => {
      const completed = orders.filter((o) => o.status === 'delivered');
      const withTime = completed.filter(
        (o) => o.delivery_scheduled_at && o.delivery_completed_at
      );

      let avgTimeMinutes = 0;
      let onTimeRate = orders.length > 0 ? 100 : 0;

      if (withTime.length > 0) {
        const totalMinutes = withTime.reduce((sum, o) => {
          const scheduled = parseISO(o.delivery_scheduled_at!);
          const completedTime = parseISO(o.delivery_completed_at!);
          return sum + Math.abs(differenceInMinutes(completedTime, scheduled));
        }, 0);
        avgTimeMinutes = Math.round(totalMinutes / withTime.length);

        const onTimeCount = withTime.filter((o) => {
          const scheduled = parseISO(o.delivery_scheduled_at!);
          const completedTime = parseISO(o.delivery_completed_at!);
          return differenceInMinutes(completedTime, scheduled) <= 30;
        }).length;
        onTimeRate = Math.round((onTimeCount / withTime.length) * 100);
      }

      return {
        day: DAY_NAMES[dayIndex],
        dayIndex,
        deliveries: orders.length,
        avgTimeMinutes,
        onTimeRate,
      };
    }).sort((a, b) => a.dayIndex - b.dayIndex);
  }, [data]);

  // On-time trend data (daily)
  const onTimeTrend = useMemo((): OnTimeTrendPoint[] => {
    if (!data || data.length === 0 || !dateRange?.from || !dateRange?.to) return [];

    const dateMap = new Map<string, DeliveryOrder[]>();

    data.forEach((order) => {
      const dateKey = format(parseISO(order.created_at), 'yyyy-MM-dd');
      const existing = dateMap.get(dateKey) || [];
      dateMap.set(dateKey, [...existing, order]);
    });

    return Array.from(dateMap.entries())
      .map(([dateKey, orders]) => {
        const completed = orders.filter(
          (o) => o.status === 'delivered' && o.delivery_scheduled_at && o.delivery_completed_at
        );

        let onTimeRate = 0;
        if (completed.length > 0) {
          const onTimeCount = completed.filter((o) => {
            const scheduled = parseISO(o.delivery_scheduled_at!);
            const completedTime = parseISO(o.delivery_completed_at!);
            return differenceInMinutes(completedTime, scheduled) <= 30;
          }).length;
          onTimeRate = Math.round((onTimeCount / completed.length) * 100);
        }

        return {
          date: dateKey,
          label: format(parseISO(dateKey), 'MMM d'),
          onTimeRate,
          total: orders.length,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, dateRange]);

  // Busiest hours heatmap data
  const heatmapData = useMemo((): HourlyHeatmapData[] => {
    if (!data || data.length === 0) return [];

    const heatmap: HourlyHeatmapData[] = [];

    // Initialize all combinations
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmap.push({ hour, dayOfWeek, count: 0 });
      }
    }

    // Count deliveries
    data.forEach((order) => {
      const date = parseISO(order.created_at);
      const dayOfWeek = getDay(date);
      const hour = getHours(date);

      const index = dayOfWeek * 24 + hour;
      if (heatmap[index]) {
        heatmap[index].count++;
      }
    });

    return heatmap;
  }, [data]);

  // Get max count for heatmap color scaling
  const maxHeatmapCount = useMemo(() => {
    return Math.max(1, ...heatmapData.map((d) => d.count));
  }, [heatmapData]);

  // Failed delivery reasons
  const failureReasons = useMemo((): FailureReason[] => {
    if (!data || data.length === 0) return [];

    const failedOrders = data.filter(
      (o) => o.status === 'failed' || o.status === 'cancelled'
    );

    if (failedOrders.length === 0) return [];

    const reasonMap = new Map<string, number>();

    failedOrders.forEach((order) => {
      // Extract reason from notes or default
      let reason = 'Unknown';
      if (order.delivery_notes) {
        const notes = order.delivery_notes.toLowerCase();
        if (notes.includes('customer') && notes.includes('unavailable')) {
          reason = 'Customer Unavailable';
        } else if (notes.includes('wrong') && notes.includes('address')) {
          reason = 'Wrong Address';
        } else if (notes.includes('refused')) {
          reason = 'Delivery Refused';
        } else if (notes.includes('closed')) {
          reason = 'Business Closed';
        } else if (notes.includes('cancel')) {
          reason = 'Cancelled by Customer';
        } else {
          reason = 'Other';
        }
      }

      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    });

    return Array.from(reasonMap.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: Math.round((count / failedOrders.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  // Export report handler
  const handleExportReport = useCallback(() => {
    if (!data || data.length === 0) return;

    const reportData = {
      dateRange: {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString(),
      },
      summary: metrics,
      byZone: byZoneMetrics,
      byRunner: byRunnerMetrics,
      byDayOfWeek: byDayMetrics,
      failureReasons,
      onTimeTrend,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `delivery-analytics-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('Delivery analytics report exported', { component: 'DeliveryAnalytics' });
  }, [data, dateRange, metrics, byZoneMetrics, byRunnerMetrics, byDayMetrics, failureReasons, onTimeTrend]);

  // Heatmap color helper
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    const intensity = count / maxHeatmapCount;
    if (intensity < 0.25) return 'bg-green-200 dark:bg-green-900';
    if (intensity < 0.5) return 'bg-green-400 dark:bg-green-700';
    if (intensity < 0.75) return 'bg-green-500 dark:bg-green-600';
    return 'bg-green-600 dark:bg-green-500';
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">Failed to load delivery analytics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Delivery Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Performance metrics and insights for your delivery operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AnalyticsDateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <Button variant="outline" onClick={handleExportReport} disabled={!data || data.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.totalDeliveries}</p>
                <p className="text-xs text-muted-foreground">Total Deliveries</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                {metrics.completedDeliveries} completed
              </Badge>
              {metrics.failedDeliveries > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600">
                  {metrics.failedDeliveries} failed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {metrics.avgDeliveryTimeMinutes > 0 ? `${metrics.avgDeliveryTimeMinutes}m` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Delivery Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                metrics.onTimeRate >= 80 ? 'bg-green-500/10' : 'bg-amber-500/10'
              )}>
                {metrics.onTimeRate >= 80 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-amber-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.onTimeRate}%</p>
                <p className="text-xs text-muted-foreground">On-Time Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${metrics.totalDeliveryFees.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Delivery Fee Revenue</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Avg ${metrics.avgDeliveryFee.toFixed(2)} per delivery
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="failures">Failures</TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>On-Time Delivery Rate Trend</CardTitle>
              <CardDescription>Daily on-time delivery percentage over time</CardDescription>
            </CardHeader>
            <CardContent>
              {onTimeTrend.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={onTimeTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval={Math.floor(onTimeTrend.length / 10)}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v: number) => `${v}%`}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={50}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, 'On-Time Rate']}
                        labelFormatter={(label) => `Date: ${label}`}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="onTimeRate"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deliveries by Day of Week */}
          <Card>
            <CardHeader>
              <CardTitle>Deliveries by Day of Week</CardTitle>
              <CardDescription>Average delivery time and volume by day</CardDescription>
            </CardHeader>
            <CardContent>
              {byDayMetrics.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byDayMetrics}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={50}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(v: number) => `${v}m`}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="deliveries" name="Deliveries" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="avgTimeMinutes" name="Avg Time (min)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Zone */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Performance by Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byZoneMetrics.length > 0 ? (
                  <div className="space-y-3">
                    {byZoneMetrics.slice(0, 8).map((zone) => (
                      <div
                        key={zone.zoneId || 'no-zone'}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{zone.zone}</p>
                          <p className="text-xs text-muted-foreground">
                            {zone.deliveries} deliveries • {zone.avgTimeMinutes}m avg
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            zone.onTimeRate >= 80
                              ? 'bg-green-500/10 text-green-600'
                              : zone.onTimeRate >= 60
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-red-500/10 text-red-600'
                          )}
                        >
                          {zone.onTimeRate}% on-time
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No zone data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Runner */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Performance by Runner
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byRunnerMetrics.length > 0 ? (
                  <div className="space-y-3">
                    {byRunnerMetrics.slice(0, 8).map((runner) => (
                      <div
                        key={runner.runnerId}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{runner.runner}</p>
                          <p className="text-xs text-muted-foreground">
                            {runner.deliveries} deliveries • {runner.deliveriesPerDay}/day
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              runner.onTimeRate >= 80
                                ? 'bg-green-500/10 text-green-600'
                                : runner.onTimeRate >= 60
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-red-500/10 text-red-600'
                            )}
                          >
                            {runner.onTimeRate}% on-time
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {runner.avgTimeMinutes}m avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No runner data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Heatmap Tab */}
        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <CardTitle>Busiest Delivery Hours</CardTitle>
              <CardDescription>
                Heatmap showing delivery volume by day and hour
              </CardDescription>
            </CardHeader>
            <CardContent>
              {heatmapData.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Hour labels */}
                    <div className="flex mb-2">
                      <div className="w-12" />
                      {HOUR_LABELS.filter((_, i) => i % 2 === 0).map((hour, i) => (
                        <div
                          key={i}
                          className="flex-1 text-xs text-muted-foreground text-center"
                          style={{ minWidth: '28px' }}
                        >
                          {hour}
                        </div>
                      ))}
                    </div>

                    {/* Grid */}
                    {DAY_NAMES.map((day, dayIndex) => (
                      <div key={day} className="flex items-center mb-1">
                        <div className="w-12 text-xs text-muted-foreground">{day}</div>
                        <div className="flex flex-1 gap-0.5">
                          {Array.from({ length: 24 }).map((_, hour) => {
                            const cell = heatmapData.find(
                              (d) => d.dayOfWeek === dayIndex && d.hour === hour
                            );
                            return (
                              <div
                                key={hour}
                                className={cn(
                                  'flex-1 h-6 rounded-sm transition-colors',
                                  getHeatmapColor(cell?.count || 0)
                                )}
                                title={`${day} ${HOUR_LABELS[hour]}: ${cell?.count || 0} deliveries`}
                                style={{ minWidth: '14px' }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                      <span>Less</span>
                      <div className="flex gap-0.5">
                        <div className="w-4 h-4 rounded-sm bg-muted" />
                        <div className="w-4 h-4 rounded-sm bg-green-200 dark:bg-green-900" />
                        <div className="w-4 h-4 rounded-sm bg-green-400 dark:bg-green-700" />
                        <div className="w-4 h-4 rounded-sm bg-green-500 dark:bg-green-600" />
                        <div className="w-4 h-4 rounded-sm bg-green-600 dark:bg-green-500" />
                      </div>
                      <span>More</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failures Tab */}
        <TabsContent value="failures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Failed Delivery Reasons
              </CardTitle>
              <CardDescription>
                Breakdown of why deliveries failed or were cancelled
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.failedDeliveries > 0 && failureReasons.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="destructive">
                      {metrics.failedDeliveries} failed deliveries
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({Math.round((metrics.failedDeliveries / metrics.totalDeliveries) * 100)}% failure rate)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {failureReasons.map((reason) => (
                      <div key={reason.reason} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{reason.reason}</span>
                          <span className="text-muted-foreground">
                            {reason.count} ({reason.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full transition-all"
                            style={{ width: `${reason.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="font-medium">No failed deliveries</p>
                  <p className="text-sm">All deliveries in this period were successful</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DeliveryAnalytics;
