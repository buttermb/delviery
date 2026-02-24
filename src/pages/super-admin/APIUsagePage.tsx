import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, Zap, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from 'react';
import { queryKeys } from '@/lib/queryKeys';

export default function APIUsagePage() {
  // Fetch API logs from database
  const { data: apiLogs = [], isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.apiUsageLogs(),
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from('api_logs')
        .select('endpoint, method, status_code, response_time_ms, timestamp')
        .gte('timestamp', sevenDaysAgo)
        .order('timestamp', { ascending: false })
        .limit(10000);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Calculate daily usage data
  const usageData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyStats = new Map<string, { requests: number; errors: number }>();

    apiLogs.forEach((log: any) => {
      const date = new Date(log.timestamp || 0);
      const dayKey = days[date.getDay()];
      const existing = dailyStats.get(dayKey) || { requests: 0, errors: 0 };
      
      existing.requests += 1;
      if ((log.status_code || 200) >= 400) {
        existing.errors += 1;
      }
      
      dailyStats.set(dayKey, existing);
    });

    return days.map(day => ({
      day,
      requests: dailyStats.get(day)?.requests || 0,
      errors: dailyStats.get(day)?.errors || 0,
    }));
  }, [apiLogs]);

  // Calculate endpoint statistics
  const endpointStats = useMemo(() => {
    const endpointMap = new Map<string, { requests: number; totalResponseTime: number; errors: number }>();

    apiLogs.forEach((log: any) => {
      const endpoint = log.endpoint || 'unknown';
      const existing = endpointMap.get(endpoint) || { requests: 0, totalResponseTime: 0, errors: 0 };
      
      existing.requests += 1;
      existing.totalResponseTime += log.response_time_ms || 0;
      if ((log.status_code || 200) >= 400) {
        existing.errors += 1;
      }
      
      endpointMap.set(endpoint, existing);
    });

    return Array.from(endpointMap.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.requests,
        avgResponse: Math.round(stats.totalResponseTime / stats.requests) || 0,
        errors: stats.errors,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }, [apiLogs]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = apiLogs.filter((log: any) => new Date(log.timestamp || 0) >= last24Hours);
    
    const totalRequests = recentLogs.length;
    const totalResponseTime = recentLogs.reduce((sum: number, log: any) => sum + (log.response_time_ms || 0), 0);
    const avgResponse = totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0;
    const errors = recentLogs.filter((log: any) => (log.status_code || 200) >= 400).length;
    const errorRate = totalRequests > 0 ? ((errors / totalRequests) * 100).toFixed(2) : '0.00';

    return { totalRequests, avgResponse, errors, errorRate };
  }, [apiLogs]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🔌 API Usage</h1>
        <p className="text-sm text-muted-foreground">Monitor API performance & rate limits</p>
      </div>
        {/* API Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Requests</CardTitle>
              <Activity className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {isLoading ? '...' : overallStats.totalRequests.toLocaleString()}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Avg Response</CardTitle>
              <Clock className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {isLoading ? '...' : `${overallStats.avgResponse}ms`}
              </div>
              <p className="text-xs text-green-400 mt-1">Average response time</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Error Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-[hsl(var(--super-admin-accent))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {isLoading ? '...' : `${overallStats.errorRate}%`}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">
                {overallStats.errors} errors
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Rate Limits</CardTitle>
              <Zap className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">1,000</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">per minute</p>
            </CardContent>
          </Card>
        </div>

        {/* Request Chart */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">API Requests (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--super-admin-surface))', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="requests" fill="hsl(var(--super-admin-primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Endpoints */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">Top Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Endpoint</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Requests</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Avg Response</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpointStats.map((endpoint) => (
                    <TableRow key={endpoint.endpoint} className="border-white/10">
                      <TableCell className="text-[hsl(var(--super-admin-text))] font-mono text-sm">{endpoint.endpoint}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{endpoint.requests.toLocaleString()}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{endpoint.avgResponse}ms</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          endpoint.errors > 20 
                            ? 'bg-[hsl(var(--super-admin-accent))]/20 text-[hsl(var(--super-admin-accent))]'
                            : 'bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]'
                        }`}>
                          {endpoint.errors}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
