/**
 * API Usage Dashboard - Placeholder
 * Shows mock data for API monitoring
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export function APIUsageDashboard() {
  // Static demo data - NOT connected to real API logs
  const stats = {
    totalRequests: 125430,
    requestsToday: 8234,
    avgResponseTime: 145,
    errorRate: 0.8,
    topEndpoints: [
      { endpoint: '/api/tenants', count: 15234, avgResponseTime: 120 },
      { endpoint: '/api/auth/login', count: 12450, avgResponseTime: 95 },
      { endpoint: '/api/orders', count: 10234, avgResponseTime: 180 },
      { endpoint: '/api/products', count: 8934, avgResponseTime: 150 },
      { endpoint: '/api/users', count: 7234, avgResponseTime: 110 },
      { endpoint: '/api/reports', count: 5234, avgResponseTime: 280 },
      { endpoint: '/api/analytics', count: 4234, avgResponseTime: 220 },
      { endpoint: '/api/webhooks', count: 3234, avgResponseTime: 90 },
      { endpoint: '/api/billing', count: 2234, avgResponseTime: 160 },
      { endpoint: '/api/settings', count: 1234, avgResponseTime: 130 },
    ],
    // Static hourly data instead of random
    requestsByHour: Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      count: 200 + (i >= 9 && i <= 17 ? 300 : 50), // Higher during business hours
    })),
  };

  return (
    <div className="space-y-6">
      {/* Demo Data Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
        <Activity className="h-5 w-5 text-amber-500" />
        <div>
          <p className="font-semibold text-amber-600 dark:text-amber-400">Demo Data</p>
          <p className="text-sm text-muted-foreground">This dashboard shows sample data. Connect API logging to see real metrics.</p>
        </div>
      </div>
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
            <Badge variant="default" className="mt-1">Low</Badge>
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
                      <span className={endpoint.avgResponseTime > 500 ? 'text-warning' : ''}>
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
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            Demo data - Connect API logging to see real metrics
          </div>
        </CardContent>
      </Card>
    </div>
  );
}