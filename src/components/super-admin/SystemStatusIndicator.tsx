import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface SystemStatusIndicatorProps {
  status: 'healthy' | 'degraded' | 'down' | string;
}

export function SystemStatusIndicator({ status }: SystemStatusIndicatorProps) {
  const colors: Record<string, string> = {
    healthy: 'bg-emerald-500/10 text-emerald-600',
    degraded: 'bg-amber-500/10 text-amber-600',
    down: 'bg-red-500/10 text-red-600',
  };

  return (
    <Badge className={colors[status] ?? colors.healthy} variant="secondary">
      <Activity className="h-3 w-3 mr-1" />
      {status === 'healthy' ? 'All Systems Operational' : status}
    </Badge>
  );
}
