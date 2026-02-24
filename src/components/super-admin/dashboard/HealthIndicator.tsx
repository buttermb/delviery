import { Badge } from '@/components/ui/badge';
import { ReactNode } from 'react';

interface HealthIndicatorProps {
  label: string;
  status?: 'healthy' | 'warning' | 'critical';
  value?: number;
  threshold?: number;
  unit?: string;
  latency?: string;
  executions?: string;
  usage?: string;
  children?: ReactNode;
}

export function HealthIndicator({ label, status = 'healthy', children }: HealthIndicatorProps) {
  const colors = {
    healthy: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    critical: 'bg-red-500/10 text-red-600',
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge className={colors[status]} variant="secondary">
          {status}
        </Badge>
      </div>
      {children}
    </div>
  );
}
