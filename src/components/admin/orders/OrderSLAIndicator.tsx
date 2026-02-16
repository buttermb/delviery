/**
 * Order SLA Indicator Component
 * Displays SLA status for an order with visual indicators
 */

import { useMemo } from 'react';

import Clock from 'lucide-react/dist/esm/icons/clock';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  calculateOrderSLA,
  getSLAStatusDisplay,
  formatRemainingTime,
} from '@/lib/sla/slaCalculations';
import type { OrderWithSLATimestamps } from '@/types/sla';
import type { SLATargets } from '@/types/sla';
import { DEFAULT_SLA_TARGETS } from '@/types/sla';

interface OrderSLAIndicatorProps {
  order: OrderWithSLATimestamps;
  slaTargets?: SLATargets;
  /** Show compact version (just icon/badge) */
  compact?: boolean;
  /** Show detailed tooltip on hover */
  showTooltip?: boolean;
  className?: string;
}

/**
 * Get icon component for SLA status
 */
function getSLAIcon(status: 'on_track' | 'approaching' | 'overdue') {
  switch (status) {
    case 'on_track':
      return CheckCircle;
    case 'approaching':
      return AlertTriangle;
    case 'overdue':
      return XCircle;
  }
}

export function OrderSLAIndicator({
  order,
  slaTargets = DEFAULT_SLA_TARGETS,
  compact = false,
  showTooltip = true,
  className,
}: OrderSLAIndicatorProps) {
  const slaResult = useMemo(
    () => calculateOrderSLA(order, slaTargets),
    [order, slaTargets]
  );

  // No SLA tracking for terminal statuses
  if (!slaResult) {
    return null;
  }

  const { status, remainingMinutes, percentageUsed, currentStatus, nextStatus } = slaResult;
  const display = getSLAStatusDisplay(status);
  const Icon = getSLAIcon(status);
  const timeDisplay = formatRemainingTime(remainingMinutes);

  const indicator = compact ? (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
        display.bgClassName,
        display.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{timeDisplay}</span>
    </div>
  ) : (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border',
        display.bgClassName,
        display.className,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{display.label}</span>
      <span className="font-mono text-xs opacity-75">({timeDisplay})</span>
    </Badge>
  );

  if (!showTooltip) {
    return indicator;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5 text-sm">
            <div className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              SLA Status: {display.label}
            </div>
            <div className="text-muted-foreground space-y-0.5">
              <p>
                Current: <span className="capitalize">{currentStatus.replace('_', ' ')}</span>
                {nextStatus && (
                  <> → <span className="capitalize">{nextStatus.replace('_', ' ')}</span></>
                )}
              </p>
              <p>Time Used: {Math.round(percentageUsed)}% of target</p>
              <p>
                {remainingMinutes >= 0 ? (
                  <>Time Remaining: {timeDisplay}</>
                ) : (
                  <span className="text-red-500">Overdue by {timeDisplay.replace('-', '')}</span>
                )}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact SLA dot indicator for tables/lists
 */
export function OrderSLADot({
  order,
  slaTargets = DEFAULT_SLA_TARGETS,
  className,
}: {
  order: OrderWithSLATimestamps;
  slaTargets?: SLATargets;
  className?: string;
}) {
  const slaResult = useMemo(
    () => calculateOrderSLA(order, slaTargets),
    [order, slaTargets]
  );

  if (!slaResult) {
    return null;
  }

  const display = getSLAStatusDisplay(slaResult.status);
  const dotColorClass = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  }[display.color];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              dotColorClass,
              slaResult.status === 'overdue' && 'animate-pulse',
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          <span>
            SLA: {display.label} ({formatRemainingTime(slaResult.remainingMinutes)})
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
