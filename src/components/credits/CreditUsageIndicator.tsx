/**
 * CreditUsageIndicator Component
 *
 * Small inline component showing the credit cost of an action.
 * Displays a coin icon with amount and a tooltip explaining the charge.
 * Designed to be placed next to features that consume credits.
 * Warns visually when the action would exceed the user's balance.
 */

import Coins from "lucide-react/dist/esm/icons/coins";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCredits } from '@/hooks/useCredits';
import { getCreditCost, getCreditCostInfo } from '@/lib/credits';

export interface CreditUsageIndicatorProps {
  /** The action key from CREDIT_COSTS */
  actionKey?: string;
  /** Direct credit cost (if not using actionKey) */
  cost?: number;
  /** Custom description for the tooltip */
  description?: string;
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Whether to show the warning icon when balance is insufficient */
  showWarning?: boolean;
}

export function CreditUsageIndicator({
  actionKey,
  cost: directCost,
  description,
  className,
  size = 'sm',
  showWarning = true,
}: CreditUsageIndicatorProps) {
  const { balance, isFreeTier, isLoading } = useCredits();

  const cost = directCost ?? (actionKey ? getCreditCost(actionKey) : 0);
  const costInfo = actionKey ? getCreditCostInfo(actionKey) : null;

  // Don't render if not on free tier, cost is 0, or still loading
  if (!isFreeTier || cost === 0 || isLoading) {
    return null;
  }

  const canAfford = balance >= cost;
  const remainingAfter = balance - cost;
  const wouldBeLow = remainingAfter < 500 && remainingAfter >= 0;

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const getIndicatorClasses = () => {
    if (!canAfford) {
      return 'text-red-600';
    }
    if (wouldBeLow) {
      return 'text-amber-600';
    }
    return 'text-muted-foreground';
  };

  const tooltipDescription =
    description || costInfo?.description || 'This action consumes credits';

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 cursor-help',
              textSize,
              getIndicatorClasses(),
              className
            )}
          >
            {showWarning && !canAfford ? (
              <AlertTriangle className={iconSize} />
            ) : (
              <Coins className={iconSize} />
            )}
            <span className="font-medium">{cost}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] p-2.5">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold">
              {costInfo?.actionName || 'Credit Cost'}
            </p>
            <p className="text-xs text-muted-foreground">
              {tooltipDescription}
            </p>
            <div className="text-xs pt-1.5 border-t space-y-0.5">
              <div className="flex justify-between">
                <span>Cost:</span>
                <span className="font-medium">{cost} credits</span>
              </div>
              <div className="flex justify-between">
                <span>Balance:</span>
                <span className="font-medium">
                  {balance.toLocaleString()}
                </span>
              </div>
              {canAfford && (
                <div className="flex justify-between">
                  <span>After:</span>
                  <span
                    className={cn(
                      'font-medium',
                      wouldBeLow && 'text-amber-600'
                    )}
                  >
                    {remainingAfter.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            {!canAfford && (
              <p className="text-xs text-red-600 font-medium pt-1">
                Insufficient credits
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
