/**
 * Super Admin Monitoring Page
 * Real-time system health dashboard with metrics and charts
 */

import { SystemHealthWidget } from '@/components/super-admin/monitoring/SystemHealthWidget';
import { LiveMetricsChart } from '@/components/super-admin/monitoring/LiveMetricsChart';
import { UptimeMonitor } from '@/components/super-admin/monitoring/UptimeMonitor';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, TrendingUp, Server } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <>
      <SEOHead title="System Monitoring - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="System Monitoring"
          description="Real-time system health metrics and performance monitoring"
          icon={Activity}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SystemHealthWidget />
          <UptimeMonitor />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cpu">CPU</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="disk">Disk</TabsTrigger>
            <TabsTrigger value="api">API Latency</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LiveMetricsChart metricType="cpu" timeRange="24h" />
              <LiveMetricsChart metricType="memory" timeRange="24h" />
              <LiveMetricsChart metricType="disk" timeRange="24h" />
              <LiveMetricsChart metricType="api_latency" timeRange="24h" />
            </div>
          </TabsContent>

          <TabsContent value="cpu">
            <LiveMetricsChart metricType="cpu" timeRange="24h" />
          </TabsContent>

          <TabsContent value="memory">
            <LiveMetricsChart metricType="memory" timeRange="24h" />
          </TabsContent>

          <TabsContent value="disk">
            <LiveMetricsChart metricType="disk" timeRange="24h" />
          </TabsContent>

          <TabsContent value="api">
            <LiveMetricsChart metricType="api_latency" timeRange="24h" />
          </TabsContent>

          <TabsContent value="errors">
            <LiveMetricsChart metricType="error_rate" timeRange="24h" />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

