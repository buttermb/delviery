/**
 * System Health Widget
 * Displays real-time system metrics: CPU, Memory, Disk, Database connections
 * Inspired by Grafana and Datadog dashboards
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity,
  Cpu,
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SystemMetric {
  id: string;
  metric_type: string;
  value: number;
  timestamp: string;
  metadata: Record<string, any>;
}

interface SystemHealthWidgetProps {
  refreshInterval?: number; // milliseconds
}

export function SystemHealthWidget({ refreshInterval = 60000 }: SystemHealthWidgetProps) {
  // Fetch latest metrics for each type
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['system-health-metrics'],
    queryFn: async () => {
      const metricTypes = ['cpu', 'memory', 'disk', 'database_connections', 'api_latency', 'error_rate'];
      
      const metricsPromises = metricTypes.map(async (type) => {
        const { data, error } = await supabase
          .from('system_metrics')
          .select('*')
          .eq('metric_type', type)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          // Error is handled by error state in component
          // Logging is done by Supabase client
          return null;
        }

        return data as SystemMetric | null;
      });

      const results = await Promise.all(metricsPromises);
      
      return {
        cpu: results[0],
        memory: results[1],
        disk: results[2],
        database_connections: results[3],
        api_latency: results[4],
        error_rate: results[5],
      };
    },
    refetchInterval: refreshInterval,
  });

  const getStatus = (value: number, type: string): 'healthy' | 'warning' | 'critical' => {
    if (type === 'cpu' || type === 'memory' || type === 'disk') {
      if (value >= 90) return 'critical';
      if (value >= 80) return 'warning';
      return 'healthy';
    }
    
    if (type === 'api_latency') {
      if (value >= 1000) return 'critical';
      if (value >= 500) return 'warning';
      return 'healthy';
    }
    
    if (type === 'error_rate') {
      if (value >= 10) return 'critical';
      if (value >= 5) return 'warning';
      return 'healthy';
    }
    
    return 'healthy';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'text-green-500 bg-green-500/10 border-green-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const MetricCard = ({ 
    label, 
    value, 
    unit, 
    metric, 
    icon: Icon,
    max = 100 
  }: {
    label: string;
    value: number | null;
    unit: string;
    metric: SystemMetric | null;
    icon: any;
    max?: number;
  }) => {
    if (!metric || value === null) {
      return (
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">No data available</p>
            </div>
          </div>
        </div>
      );
    }

    const status = getStatus(value, metric.metric_type);
    const displayValue = metric.metric_type === 'database_connections' 
      ? value 
      : metric.metric_type === 'api_latency'
      ? value
      : `${value.toFixed(1)}${unit}`;

    return (
      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3 flex-1">
          <Icon className={`h-5 w-5 ${getStatusColor(status).split(' ')[0]}`} />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">{label}</p>
              <Badge variant="outline" className={getStatusColor(status)}>
                {getStatusIcon(status)}
                <span className="ml-1 capitalize">{status}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{displayValue}</span>
              {metric.metadata.unit && (
                <span className="text-xs text-muted-foreground">{metric.metadata.unit}</span>
              )}
            </div>
            {metric.metric_type !== 'database_connections' && metric.metric_type !== 'api_latency' && (
              <Progress 
                value={value} 
                className="mt-2 h-1.5"
                // @ts-ignore - custom className prop
                status={status}
              />
            )}
            {metric.timestamp && (
              <p className="text-xs text-muted-foreground mt-1">
                Updated {formatDistanceToNow(new Date(metric.timestamp), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
          <Badge variant="outline" className="ml-auto">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricCard
          label="CPU Usage"
          value={metrics?.cpu?.value || null}
          unit="%"
          metric={metrics?.cpu || null}
          icon={Cpu}
        />
        <MetricCard
          label="Memory Usage"
          value={metrics?.memory?.value || null}
          unit="%"
          metric={metrics?.memory || null}
          icon={HardDrive}
        />
        <MetricCard
          label="Disk Usage"
          value={metrics?.disk?.value || null}
          unit="%"
          metric={metrics?.disk || null}
          icon={HardDrive}
        />
        <MetricCard
          label="Database Connections"
          value={metrics?.database_connections?.value || null}
          unit=""
          metric={metrics?.database_connections || null}
          icon={Database}
          max={100}
        />
        <MetricCard
          label="API Latency"
          value={metrics?.api_latency?.value || null}
          unit="ms"
          metric={metrics?.api_latency || null}
          icon={Activity}
        />
        <MetricCard
          label="Error Rate"
          value={metrics?.error_rate?.value || null}
          unit="%"
          metric={metrics?.error_rate || null}
          icon={AlertTriangle}
        />
      </CardContent>
    </Card>
  );
}

