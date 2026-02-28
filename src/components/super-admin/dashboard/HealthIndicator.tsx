import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

interface HealthIndicatorProps {
  label: string;
  status: 'healthy' | 'warning' | 'critical';
  latency?: string;
  usage?: string;
  executions?: string;
  children?: ReactNode;
}

const STATUS_CONFIG = {
  healthy: { variant: 'default' as const, label: 'Healthy', dot: 'bg-green-500' },
  warning: { variant: 'secondary' as const, label: 'Warning', dot: 'bg-yellow-500' },
  critical: { variant: 'destructive' as const, label: 'Critical', dot: 'bg-red-500' },
};

export function HealthIndicator({ label, status, latency, usage, executions, children }: HealthIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {latency && <span className="text-xs text-muted-foreground">{latency}</span>}
          {usage && <span className="text-xs text-muted-foreground">{usage}</span>}
          {executions && <span className="text-xs text-muted-foreground">{executions}/hr</span>}
          <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
        </div>
      </div>
      {children}
    </div>
  );
}
