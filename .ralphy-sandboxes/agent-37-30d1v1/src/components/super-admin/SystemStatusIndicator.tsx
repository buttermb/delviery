/**
 * System Status Indicator Component
 * Status indicator in nav bar showing overall system health
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SystemStatusIndicatorProps {
  status: 'healthy' | 'warning' | 'critical';
  className?: string;
}

export function SystemStatusIndicator({ status, className }: SystemStatusIndicatorProps) {
  const statusConfig = {
    healthy: {
      color: 'bg-success',
      label: 'System Healthy',
      tooltip: 'All systems operational',
    },
    warning: {
      color: 'bg-warning',
      label: 'System Warning',
      tooltip: 'Some systems experiencing issues',
    },
    critical: {
      color: 'bg-destructive',
      label: 'System Critical',
      tooltip: 'Critical system issues detected',
    },
  };

  const config = statusConfig[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'h-2 w-2 rounded-full cursor-pointer',
              config.color,
              className
            )}
            title={config.label}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

