/**
 * API Usage Dashboard
 * Shows API request metrics, most-used endpoints, error rates
 * Inspired by Kong and AWS API Gateway dashboards
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Activity, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';

interface APIUsageStats {
  totalRequests: number;
  requestsToday: number;
  avgResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
  }>;
  requestsByHour: Array<{
    hour: string;
    count: number;
  }>;
}

export function APIUsageDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['api-usage-stats'],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get all requests
      const { data: allRequests, error } = await supabase
        .from('api_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10000);

      if (error) throw error;

      // Get today's requests
      const requestsToday = (allRequests || []).filter(
        (r) => new Date(r.timestamp) >= todayStart
      ).length;

      // Calculate average response time
      const avgResponseTime =
        (allRequests || []).reduce((sum, r) => sum + (r.response_time_ms || 0), 0) /
        (allRequests?.length || 1);

      // Calculate error rate
      const errors = (allRequests || []).filter((r) => r.status_code && r.status_code >= 400).length;
      const errorRate = (allRequests || []).length > 0 ? (errors / allRequests.length) * 100 : 0;

      // Top endpoints
      const endpointMap = new Map<string, { count: number; totalTime: number }>();
      
      (allRequests || []).forEach((req) => {
        const key = req.endpoint;
        if (!endpointMap.has(key)) {
          endpointMap.set(key, { count: 0, totalTime: 0 });
        }
        const stats = endpointMap.get(key)!;
        stats.count++;
        stats.totalTime += req.response_time_ms || 0;
      });

      const topEndpoints = Array.from(endpointMap.entries())
        .map(([endpoint, stats]) => ({
          endpoint,
          count: stats.count,
          avgResponseTime: stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Requests by hour (last 24 hours)
      const hourMap = new Map<string, number>();
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourKey = format(hour, 'HH:00');
        hourMap.set(hourKey, 0);
      }

      (allRequests || [])
        .filter((r) => new Date(r.timestamp) >= last24Hours)
        .forEach((req) => {
          const hour = format(new Date(req.timestamp), 'HH:00');
          hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
        });

      const requestsByHour = Array.from(hourMap.entries()).map(([hour, count]) => ({
        hour,
        count,
      }));

      return {
        totalRequests: allRequests?.length || 0,
        requestsToday,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: Math.round(errorRate * 10) / 10,
        topEndpoints,
        requestsByHour,
      } as APIUsageStats;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            API Usage Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.requestsToday.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.avgResponseTime}ms</p>
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3 inline" /> Average
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.errorRate}%</p>
            <Badge
              variant={stats.errorRate > 5 ? 'destructive' : stats.errorRate > 1 ? 'secondary' : 'default'}
              className="mt-1"
            >
              {stats.errorRate > 5 ? 'High' : stats.errorRate > 1 ? 'Medium' : 'Low'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests by Hour */}
        <Card>
          <CardHeader>
            <CardTitle>Requests (Last 24 Hours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.requestsByHour}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Top Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topEndpoints.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="endpoint"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Endpoint Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoint Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-semibold">Endpoint</th>
                  <th className="text-right p-2 font-semibold">Requests</th>
                  <th className="text-right p-2 font-semibold">Avg Response Time</th>
                  <th className="text-right p-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.topEndpoints.map((endpoint) => (
                  <tr key={endpoint.endpoint} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono text-xs">{endpoint.endpoint}</td>
                    <td className="p-2 text-right">{endpoint.count.toLocaleString()}</td>
                    <td className="p-2 text-right">
                      <span className={endpoint.avgResponseTime > 500 ? 'text-yellow-500' : ''}>
                        {endpoint.avgResponseTime}ms
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {endpoint.avgResponseTime > 1000 ? (
                        <Badge variant="destructive">Slow</Badge>
                      ) : endpoint.avgResponseTime > 500 ? (
                        <Badge variant="secondary">Warning</Badge>
                      ) : (
                        <Badge variant="default">Good</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

