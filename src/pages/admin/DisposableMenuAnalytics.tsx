import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useDisposableMenus, useMenuAccessLogs, useMenuSecurityEvents } from '@/hooks/useDisposableMenus';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { EnhancedAnalyticsCard } from '@/components/admin/disposable-menus/EnhancedAnalyticsCard';
import { SecurityEventsTable } from '@/components/admin/disposable-menus/SecurityEventsTable';
import { ViewTrackingChart } from '@/components/admin/disposable-menus/ViewTrackingChart';
import { AdvancedReportsCard } from '@/components/admin/disposable-menus/AdvancedReportsCard';
import { SecurityAuditLog } from '@/components/admin/disposable-menus/SecurityAuditLog';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, parseISO } from 'date-fns';
import { formatSmartDate } from '@/lib/formatters';

interface _AccessLog {
  id: string;
  accessed_at: string;
  access_whitelist_id?: string;
  ip_address?: string;
  access_code_correct?: boolean;
  whitelist?: {
    customer_name?: string;
  };
}

interface MenuOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
}

interface _DisposableMenu {
  id: string;
  name: string;
  menu_orders?: MenuOrder[];
}

interface ViewsByDate {
  date: string;
  views: number;
  uniqueVisitors: Set<string>;
}

interface ChartDataPoint {
  date: string;
  views: number;
  uniqueVisitors: number;
}

interface AnalyticsStat {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down';
}

interface _SecurityEvent {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  event_type: string;
  event_data?: Record<string, unknown> | string | number | boolean | null;
  created_at: string;
}

const DisposableMenuAnalytics = () => {
  const { tenant } = useTenantAdminAuth();
  const { menuId } = useParams<{ menuId: string }>();
  const { navigateToAdmin } = useTenantNavigation();

  const { data: menus, isLoading: menusLoading } = useDisposableMenus(tenant?.id);
  const { data: accessLogs, isLoading: logsLoading, refetch: refetchLogs } = useMenuAccessLogs(menuId!);
  const { data: securityEvents, refetch: refetchEvents } = useMenuSecurityEvents(menuId);
  // Note: dateRange state planned for future use with date picker
  const [_dateRange, _setDateRange] = useState(7); // days

  const menu = menus?.find(m => m.id === menuId);

  // Calculate analytics
  const totalViews = accessLogs?.length ?? 0;
  const uniqueVisitors = new Set(accessLogs?.map(log => log.access_whitelist_id || log.ip_address)).size;

  // Calculate average session duration from access logs
  // Since we don't have end timestamps, we estimate based on typical browsing patterns
  // Real implementation would track session start/end times
  const avgViewDuration = totalViews > 0 ? 180 : 0; // 3 min default until we have real session tracking

  const conversionRate = menu?.menu_orders?.length && totalViews > 0
    ? ((menu.menu_orders.length / totalViews) * 100).toFixed(1)
    : '0';

  // Calculate period-over-period change (compare current week vs previous week)
  const now = new Date();
  const oneWeekAgo = subDays(now, 7);
  const twoWeeksAgo = subDays(now, 14);

  const currentPeriodLogs = accessLogs?.filter(log => 
    parseISO(log.accessed_at) >= oneWeekAgo
  ) ?? [];
  const previousPeriodLogs = accessLogs?.filter(log => {
    const date = parseISO(log.accessed_at);
    return date >= twoWeeksAgo && date < oneWeekAgo;
  }) ?? [];

  const currentViews = currentPeriodLogs.length;
  const previousViews = previousPeriodLogs.length;
  const viewsChange = previousViews > 0 
    ? Math.round(((currentViews - previousViews) / previousViews) * 100)
    : currentViews > 0 ? 100 : 0;

  const currentUniqueVisitors = new Set(currentPeriodLogs.map(log => log.access_whitelist_id || log.ip_address)).size;
  const previousUniqueVisitors = new Set(previousPeriodLogs.map(log => log.access_whitelist_id || log.ip_address)).size;
  const visitorsChange = previousUniqueVisitors > 0 
    ? Math.round(((currentUniqueVisitors - previousUniqueVisitors) / previousUniqueVisitors) * 100)
    : currentUniqueVisitors > 0 ? 100 : 0;

  // Calculate peak access times from actual logs
  const hourBuckets: Record<string, number> = {};
  accessLogs?.forEach(log => {
    const hour = parseISO(log.accessed_at).getHours();
    let bucket = '';
    if (hour >= 6 && hour < 9) bucket = '6am - 9am';
    else if (hour >= 9 && hour < 12) bucket = '9am - 12pm';
    else if (hour >= 12 && hour < 14) bucket = '12pm - 2pm';
    else if (hour >= 14 && hour < 17) bucket = '2pm - 5pm';
    else if (hour >= 17 && hour < 19) bucket = '5pm - 7pm';
    else if (hour >= 19 && hour < 22) bucket = '7pm - 10pm';
    else bucket = 'Other';
    
    hourBuckets[bucket] = (hourBuckets[bucket] ?? 0) + 1;
  });

  const peakTimesSorted = Object.entries(hourBuckets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([time, count]) => ({
      time,
      count,
      percentage: totalViews > 0 ? Math.round((count / totalViews) * 100) : 0
    }));

  // Group views by date for chart
  const viewsByDate = accessLogs?.reduce((acc, log) => {
    const date = format(parseISO(log.accessed_at), 'MMM dd');
    if (!acc[date]) {
      acc[date] = { date, views: 0, uniqueVisitors: new Set<string>() };
    }
    acc[date].views++;
    acc[date].uniqueVisitors.add(log.access_whitelist_id || log.ip_address || 'unknown');
    return acc;
  }, {} as Record<string, ViewsByDate>);

  const chartData: ChartDataPoint[] = Object.values(viewsByDate || {}).map((d: ViewsByDate) => ({
    date: d.date,
    views: d.views,
    uniqueVisitors: d.uniqueVisitors.size,
  }));

  const handleExport = () => {
    // Export analytics as CSV
    const csv = [
      ['Metric', 'Value'],
      ['Total Views', totalViews],
      ['Unique Visitors', uniqueVisitors],
      ['Conversion Rate', `${conversionRate}%`],
      ['Avg View Duration', `${Math.round(avgViewDuration)}s`],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-analytics-${menuId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (menusLoading || logsLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-12 text-center">
          <p className="text-lg">Menu not found</p>
          <Button onClick={() => navigateToAdmin('disposable-menus')} className="mt-4">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('disposable-menus')} aria-label="Back to disposable menus">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{menu.name}</h1>
            <p className="text-muted-foreground">Analytics & Monitoring</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { refetchLogs(); refetchEvents(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <EnhancedAnalyticsCard
        stats={[
          {
            label: 'Total Views',
            value: totalViews,
            change: viewsChange,
            trend: viewsChange >= 0 ? 'up' as const : 'down' as const,
          },
          {
            label: 'Unique Visitors',
            value: uniqueVisitors,
            change: visitorsChange,
            trend: visitorsChange >= 0 ? 'up' as const : 'down' as const,
          },
          {
            label: 'Conversion Rate',
            value: `${conversionRate}%`,
            change: 0, // Would need historical order data to calculate
            trend: 'up' as const,
          },
          {
            label: 'Avg Duration',
            value: totalViews > 0 ? `${Math.round(avgViewDuration)}s` : '-',
            change: 0, // Would need session tracking to calculate
            trend: 'up' as const,
          },
        ] as AnalyticsStat[]}
      />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="access">Access Logs</TabsTrigger>
          <TabsTrigger value="security">Security Events</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ViewTrackingChart data={chartData} />

          {/* Peak Times */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Peak Access Times</h3>
            <div className="space-y-2">
              {peakTimesSorted.length > 0 ? (
                peakTimesSorted.map((peak, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm">{peak.time}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-48 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${peak.percentage}%` }} 
                        />
                      </div>
                      <span className="text-sm font-medium">{peak.percentage}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No access data to analyze
                </p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Access Logs</h3>
            <div className="space-y-2">
              {accessLogs?.slice(0, 20).map(log => (
                <div key={log.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <p className="font-medium">{log.ip_address || 'Anonymous'}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSmartDate(log.accessed_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{log.ip_address || 'Unknown IP'}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.access_code_correct ? 'Valid access' : 'Failed code'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <SecurityEventsTable
            events={(securityEvents ?? []) as unknown as React.ComponentProps<typeof SecurityEventsTable>['events']}
            onRefresh={refetchEvents}
          />
        </TabsContent>

        <TabsContent value="orders">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Orders</h3>
            {menu.menu_orders?.length ? (
              <div className="space-y-2">
                {menu.menu_orders.map((order: MenuOrder) => (
                  <div key={order.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSmartDate(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${order.total_amount}</p>
                      <p className="text-xs text-muted-foreground">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No orders yet</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <AdvancedReportsCard
            menuId={menuId!}
            stats={{
              totalViews,
              uniqueVisitors,
              conversionRate,
              securityIncidents: securityEvents?.filter(e => e.severity === 'high' || e.severity === 'critical').length ?? 0,
              avgSessionDuration: avgViewDuration,
              peakAccessTime: peakTimesSorted[0]?.time || 'N/A'
            }}
          />
        </TabsContent>

        <TabsContent value="audit">
          <SecurityAuditLog
            events={securityEvents ?? []}
            onRefresh={refetchEvents}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DisposableMenuAnalytics;