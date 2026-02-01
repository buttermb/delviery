/**
 * CreditCostBadge Component
 * 
 * Small badge that displays credit cost for an action.
 * Shows on buttons to indicate how many credits will be used.
 * Changes color based on user's ability to afford the action.
 */

import { Coins, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCredits } from '@/hooks/useCredits';
import { getCreditCost, getCreditCostInfo } from '@/lib/credits';

export interface CreditCostBadgeProps {
  /** The action key from CREDIT_COSTS */
  actionKey?: string;
  /** Direct credit cost (if not using actionKey) */
  cost?: number;
  /** Show as inline text instead of badge */
  inline?: boolean;
  /** Additional class names */
  className?: string;
  /** Show tooltip with details */
  showTooltip?: boolean;
  /** Compact mode - just show number */
  compact?: boolean;
  /** Hover mode - only show on parent hover (typically used inside buttons) */
  hoverMode?: boolean;
}

export function CreditCostBadge({
  actionKey,
  cost: directCost,
  inline = false,
  className,
  showTooltip = true,
  compact = false,
  hoverMode = false,
}: CreditCostBadgeProps) {
  const { balance, isFreeTier, isLoading } = useCredits();

  // Get cost from action key or direct prop
  const cost = directCost ?? (actionKey ? getCreditCost(actionKey) : 0);
  const costInfo = actionKey ? getCreditCostInfo(actionKey) : null;

  // Don't render if not on free tier or cost is 0
  if (!isFreeTier || cost === 0 || isLoading) {
    return null;
  }

  const canAfford = balance >= cost;
  const wouldBeLow = balance - cost < 1000;
  const wouldBeCritical = balance - cost < 500;

  // Determine color based on affordability
  const getColorClasses = () => {
    if (!canAfford) {
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    }
    if (wouldBeCritical) {
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    }
    if (wouldBeLow) {
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 transiton-all duration-300',
        inline ? 'text-xs' : '',
        hoverMode ? 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0' : '',
        className
      )}
    >
      {!canAfford && <AlertTriangle className="h-3 w-3" />}
      {!compact && <Coins className="h-3 w-3" />}
      <span>{cost.toLocaleString()}</span>
      {!compact && !inline && <span className="hidden sm:inline">credits</span>}
    </span>
  );

  if (inline) {
    return (
      <span className={cn('text-xs', getColorClasses().split(' ').find(c => c.startsWith('text-')), className)}>
        ({cost} credits)
      </span>
    );
  }

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-normal gap-1 px-1.5 py-0.5',
        getColorClasses(),
        hoverMode ? 'opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100' : '',
        className
      )}
    >
      {!canAfford && <AlertTriangle className="h-3 w-3" />}
      {!compact && <Coins className="h-3 w-3" />}
      <span>{cost.toLocaleString()}</span>
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <div className="space-y-2">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Coins className="h-3 w-3 text-muted-foreground" />
                {costInfo?.actionName || 'Credit Cost'}
              </p>
              {costInfo?.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {costInfo.description}
                </p>
              )}
            </div>

            <div className="text-xs pt-2 border-t flex justify-between items-center">
              <span>Cost:</span>
              <span className="font-medium">{cost} credits</span>
            </div>

            <div className="text-xs flex justify-between items-center">
              <span>Remaining:</span>
              <span className={cn("font-medium", !canAfford && "text-red-500")}>
                {(balance - cost).toLocaleString()} credits
              </span>
            </div>

            {!canAfford && (
              <p className="text-xs text-red-500 bg-red-50 p-1.5 rounded flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                Insufficient credits for this action.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Button with Credit Cost
// ============================================================================

export interface CreditCostButtonProps {
  actionKey: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Wrapper component that adds credit cost badge to any button content
 * Usage: <CreditCostButton actionKey="export_csv">Export CSV</CreditCostButton>
 */
export function CreditCostButtonContent({
  actionKey,
  children,
}: {
  actionKey: string;
  children: React.ReactNode;
}) {
  const { isFreeTier } = useCredits();
  const cost = getCreditCost(actionKey);

  if (!isFreeTier || cost === 0) {
    return <>{children}</>;
  }

  return (
    <span className="inline-flex items-center gap-2 group">
      {children}
      <CreditCostBadge actionKey={actionKey} showTooltip={true} compact hoverMode />
    </span>
  );
}

// ============================================================================
// Credit Cost Indicator for Forms
// ============================================================================

export interface CreditCostIndicatorProps {
  actionKey: string;
  className?: string;
}

/**
 * Standalone indicator for showing credit cost in forms/dialogs
 * Shows "This action will use X credits"
 */
export function CreditCostIndicator({
  actionKey,
  className,
}: CreditCostIndicatorProps) {
  const { balance, isFreeTier } = useCredits();
  const cost = getCreditCost(actionKey);
  const costInfo = getCreditCostInfo(actionKey);

  if (!isFreeTier || cost === 0) {
    return null;
  }

  const canAfford = balance >= cost;
  const wouldBeLow = balance - cost < 1000;

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm p-2 rounded-md transition-colors',
        !canAfford
          ? 'bg-red-500/10 text-red-600'
          : wouldBeLow
            ? 'bg-yellow-500/10 text-yellow-600'
            : 'bg-muted/50 text-muted-foreground',
        className
      )}
    >
      <Coins className="h-4 w-4" />
      <span>
        {canAfford ? (
          <>
            This will use <strong>{cost}</strong> credits
            {wouldBeLow && ' (low balance warning)'}
          </>
        ) : (
          <>
            Requires <strong>{cost}</strong> credits (you have {balance})
          </>
        )}
      </span>
    </div>
  );
}




