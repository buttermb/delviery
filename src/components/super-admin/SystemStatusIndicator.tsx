import { Badge } from '@/components/ui/badge';

interface SystemStatusIndicatorProps {
  status: 'healthy' | 'warning' | 'critical';
}

const STATUS_CONFIG = {
  healthy: { variant: 'default' as const, label: 'Operational', dot: 'bg-green-500' },
  warning: { variant: 'secondary' as const, label: 'Degraded', dot: 'bg-yellow-500' },
  critical: { variant: 'destructive' as const, label: 'Outage', dot: 'bg-red-500' },
};

export function SystemStatusIndicator({ status }: SystemStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <div className={`h-2 w-2 rounded-full ${config.dot} animate-pulse`} />
      {config.label}
    </Badge>
  );
}
