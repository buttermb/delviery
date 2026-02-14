/**
 * Health Indicator Component
 * System health status with metrics
 */

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HealthIndicatorProps {
  label: string;
  status: 'healthy' | 'warning' | 'critical';
  latency?: string;
  usage?: string;
  executions?: string;
  children?: React.ReactNode;
  className?: string;
}

export function HealthIndicator({
  label,
  status,
  latency,
  usage,
  executions,
  children,
  className,
}: HealthIndicatorProps) {
  const statusConfig = {
    healthy: {
      color: 'text-success',
      bg: 'bg-success/10',
      badge: 'default' as const,
      label: 'Healthy',
    },
    warning: {
      color: 'text-warning',
      bg: 'bg-warning/10',
      badge: 'secondary' as const,
      label: 'Warning',
    },
    critical: {
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      badge: 'destructive' as const,
      label: 'Critical',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={config.badge} className={config.bg}>
          {config.label}
        </Badge>
      </div>
      {latency && (
        <div className="text-xs text-muted-foreground">Latency: {latency}</div>
      )}
      {usage && (
        <div className="space-y-1">
          <Progress
            value={parseFloat(usage.replace('%', ''))}
            className="h-2"
          />
          <div className="text-xs text-muted-foreground">Usage: {usage}</div>
        </div>
      )}
      {executions && (
        <div className="text-xs text-muted-foreground">
          {executions} executions/hr
        </div>
      )}
      {children}
    </div>
  );
}

