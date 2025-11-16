// @ts-nocheck
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useDisposableMenus, useMenuAccessLogs, useMenuSecurityEvents } from '@/hooks/useDisposableMenus';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { EnhancedAnalyticsCard } from '@/components/admin/disposable-menus/EnhancedAnalyticsCard';
import { SecurityEventsTable } from '@/components/admin/disposable-menus/SecurityEventsTable';
import { ViewTrackingChart } from '@/components/admin/disposable-menus/ViewTrackingChart';
import { AdvancedReportsCard } from '@/components/admin/disposable-menus/AdvancedReportsCard';
import { SecurityAuditLog } from '@/components/admin/disposable-menus/SecurityAuditLog';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, parseISO } from 'date-fns';

const DisposableMenuAnalytics = () => {
  const { tenant } = useTenantAdminAuth();
  const { menuId } = useParams();
  const [dateRange, setDateRange] = useState(7); // days

  const { data: menus, isLoading: menusLoading } = useDisposableMenus(tenant?.id);
  const { data: accessLogs, isLoading: logsLoading, refetch: refetchLogs } = useMenuAccessLogs(menuId!);
  const { data: securityEvents, refetch: refetchEvents } = useMenuSecurityEvents(menuId);

  const menu = menus?.find(m => m.id === menuId);

  // Calculate analytics
  const totalViews = accessLogs?.length || 0;
  const uniqueVisitors = new Set(accessLogs?.map(log => log.access_whitelist_id || log.ip_address)).size;
  const avgViewDuration = accessLogs?.reduce((sum, log) => {
    // Calculate duration if we had timestamps
    return sum + 180; // Mock: 3 minutes average
  }, 0) / (totalViews || 1);

  const conversionRate = menu?.menu_orders?.length 
    ? ((menu.menu_orders.length / totalViews) * 100).toFixed(1)
    : '0';

  // Group views by date for chart
  const viewsByDate = accessLogs?.reduce((acc, log) => {
    const date = format(parseISO(log.accessed_at), 'MMM dd');
    if (!acc[date]) {
      acc[date] = { date, views: 0, uniqueVisitors: new Set() };
    }
    acc[date].views++;
    acc[date].uniqueVisitors.add(log.access_whitelist_id || log.ip_address);
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(viewsByDate || {}).map((d: any) => ({
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
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-12 text-center">
          <p className="text-lg">Menu not found</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{menu.name}</h1>
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
            change: 23,
            trend: 'up',
          },
          {
            label: 'Unique Visitors',
            value: uniqueVisitors,
            change: 15,
            trend: 'up',
          },
          {
            label: 'Conversion Rate',
            value: `${conversionRate}%`,
            change: -5,
            trend: 'down',
          },
          {
            label: 'Avg Duration',
            value: `${Math.round(avgViewDuration)}s`,
            change: 8,
            trend: 'up',
          },
        ]}
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
              <div className="flex justify-between items-center">
                <span className="text-sm">9am - 12pm</span>
                <div className="flex items-center gap-2">
                  <div className="w-48 bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '65%' }} />
                  </div>
                  <span className="text-sm font-medium">34%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">2pm - 5pm</span>
                <div className="flex items-center gap-2">
                  <div className="w-48 bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '48%' }} />
                  </div>
                  <span className="text-sm font-medium">28%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">7pm - 10pm</span>
                <div className="flex items-center gap-2">
                  <div className="w-48 bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '38%' }} />
                  </div>
                  <span className="text-sm font-medium">25%</span>
                </div>
              </div>
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
                    <p className="font-medium">{log.whitelist?.customer_name || 'Anonymous'}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(log.accessed_at), 'MMM dd, yyyy HH:mm')}
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
            events={securityEvents || []} 
            onRefresh={refetchEvents}
          />
        </TabsContent>

        <TabsContent value="orders">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Orders</h3>
            {menu.menu_orders?.length ? (
              <div className="space-y-2">
                {menu.menu_orders.map((order: any) => (
                  <div key={order.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(order.created_at), 'MMM dd, yyyy HH:mm')}
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
              securityIncidents: securityEvents?.filter(e => e.severity === 'high' || e.severity === 'critical').length || 0,
              avgSessionDuration: avgViewDuration,
              peakAccessTime: '2-5pm'
            }}
          />
        </TabsContent>

        <TabsContent value="audit">
          <SecurityAuditLog
            events={securityEvents || []}
            onRefresh={refetchEvents}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DisposableMenuAnalytics;