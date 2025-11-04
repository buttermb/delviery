/**
 * Live Metrics Chart
 * Real-time line charts for system metrics using Recharts
 * Updates via WebSocket connection for live data
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

interface MetricDataPoint {
  timestamp: string;
  value: number;
  formattedTime: string;
}

interface LiveMetricsChartProps {
  metricType: 'cpu' | 'memory' | 'disk' | 'api_latency' | 'error_rate' | 'database_connections';
  timeRange?: '1h' | '6h' | '24h' | '7d';
  refreshInterval?: number;
}

export function LiveMetricsChart({
  metricType,
  timeRange = '24h',
  refreshInterval = 60000,
}: LiveMetricsChartProps) {
  const [selectedRange, setSelectedRange] = useState<string>(timeRange);
  const queryClient = useQueryClient();

  // Calculate time window based on range
  const getTimeWindow = (range: string) => {
    const now = new Date();
    switch (range) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  };

  // Fetch historical metrics
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['live-metrics', metricType, selectedRange],
    queryFn: async () => {
      const timeWindow = getTimeWindow(selectedRange);
      
      // Determine interval based on time range
      let interval = '1 hour';
      let formatString = 'HH:mm';
      
      if (selectedRange === '1h') {
        interval = '1 minute';
        formatString = 'HH:mm';
      } else if (selectedRange === '6h') {
        interval = '5 minutes';
        formatString = 'HH:mm';
      } else if (selectedRange === '24h') {
        interval = '15 minutes';
        formatString = 'HH:mm';
      } else {
        interval = '1 hour';
        formatString = 'MMM dd HH:mm';
      }

      const { data, error } = await supabase
        .from('system_metrics')
        .select('*')
        .eq('metric_type', metricType)
        .gte('timestamp', timeWindow.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      // Group by interval and average values
      const grouped: Record<string, number[]> = {};
      
      (data || []).forEach((metric: any) => {
        const timestamp = new Date(metric.timestamp);
        const intervalKey = format(timestamp, formatString);
        
        if (!grouped[intervalKey]) {
          grouped[intervalKey] = [];
        }
        grouped[intervalKey].push(metric.value);
      });

      // Calculate averages and create chart data
      const chartDataPoints: MetricDataPoint[] = Object.entries(grouped).map(([time, values]) => {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        return {
          timestamp: time,
          value: Math.round(avg * 10) / 10,
          formattedTime: time,
        };
      });

      return chartDataPoints;
    },
    refetchInterval: refreshInterval,
  });

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('system-metrics-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_metrics',
          filter: `metric_type=eq.${metricType}`,
        },
        () => {
          // Refetch on new data
          queryClient.invalidateQueries({ queryKey: ['live-metrics', metricType] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [metricType, queryClient]);

  const getMetricLabel = (type: string) => {
    const labels: Record<string, string> = {
      cpu: 'CPU Usage',
      memory: 'Memory Usage',
      disk: 'Disk Usage',
      api_latency: 'API Latency',
      error_rate: 'Error Rate',
      database_connections: 'Database Connections',
    };
    return labels[type] || type;
  };

  const getMetricUnit = (type: string) => {
    const units: Record<string, string> = {
      cpu: '%',
      memory: '%',
      disk: '%',
      api_latency: 'ms',
      error_rate: '%',
      database_connections: 'connections',
    };
    return units[type] || '';
  };

  const getColor = (type: string) => {
    const colors: Record<string, string> = {
      cpu: '#3b82f6', // blue
      memory: '#10b981', // green
      disk: '#f59e0b', // amber
      api_latency: '#8b5cf6', // purple
      error_rate: '#ef4444', // red
      database_connections: '#06b6d4', // cyan
    };
    return colors[type] || '#3b82f6';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {getMetricLabel(metricType)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {getMetricLabel(metricType)}
          </CardTitle>
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="formattedTime"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                label={{ 
                  value: getMetricUnit(metricType), 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' }
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: any) => [`${value} ${getMetricUnit(metricType)}`, getMetricLabel(metricType)]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={getColor(metricType)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={getMetricLabel(metricType)}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
            <div className="text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No data available</p>
              <p className="text-xs mt-1">Metrics will appear here once collected</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


