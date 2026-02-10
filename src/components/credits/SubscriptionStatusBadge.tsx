/**
 * SubscriptionStatusBadge Component
 * 
 * Clearly shows whether the user is on a free tier (with credits) or a paid plan.
 * Helps users understand their current status at a glance.
 */

import { useMemo } from 'react';
import {
  Crown,
  Coins,
  Sparkles,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { CreditBalanceAnimation } from './CreditBalanceAnimation';

export interface SubscriptionStatusBadgeProps {
  className?: string;
  showBalance?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

export function SubscriptionStatusBadge({
  className,
  showBalance = true,
  variant = 'default',
}: SubscriptionStatusBadgeProps) {
  const { balance, isFreeTier, isLowCredits, isCriticalCredits, isOutOfCredits } = useCredits();
  const { currentTier, isActive, isTrial, hasActiveSubscription } = useSubscriptionStatus();

  // Determine the status display
  const status = useMemo(() => {
    if (isFreeTier) {
      // Free tier with credits
      if (isOutOfCredits) {
        return {
          label: 'Out of Credits',
          icon: AlertTriangle,
          color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          tooltip: 'You need to purchase credits or upgrade to continue',
          priority: 'critical',
        };
      }
      if (isCriticalCredits) {
        return {
          label: 'Free Tier',
          icon: Coins,
          color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
          tooltip: `${balance.toLocaleString()} credits remaining - running low!`,
          priority: 'warning',
        };
      }
      if (isLowCredits) {
        return {
          label: 'Free Tier',
          icon: Coins,
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
          tooltip: `${balance.toLocaleString()} credits remaining`,
          priority: 'low',
        };
      }
      return {
        label: 'Free Tier',
        icon: Coins,
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        tooltip: `${balance.toLocaleString()} credits available - Upgrade for unlimited`,
        priority: 'healthy',
      };
    }

    // Paid tier
    if (isTrial) {
      return {
        label: `${currentTier} Trial`,
        icon: Clock,
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        tooltip: 'Trial period - unlimited access',
        priority: 'trial',
      };
    }

    if (isActive || hasActiveSubscription) {
      return {
        label: currentTier || 'Pro',
        icon: Crown,
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        tooltip: 'Unlimited access - no credit limits',
        priority: 'premium',
      };
    }

    // Fallback - unknown status
    return {
      label: 'Free Tier',
      icon: Coins,
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
      tooltip: 'Check your subscription status',
      priority: 'unknown',
    };
  }, [isFreeTier, isOutOfCredits, isCriticalCredits, isLowCredits, balance, isTrial, isActive, hasActiveSubscription, currentTier]);

  const Icon = status.icon;

  // Compact variant
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'gap-1 cursor-help',
                status.color,
                className
              )}
            >
              <Icon className="h-3 w-3" />
              {isFreeTier && showBalance && (
                <span className="tabular-nums flex items-center">
                  <CreditBalanceAnimation value={balance} />
                </span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{status.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed variant
  if (variant === 'detailed') {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg', status.color, className)}>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{status.label}</span>
            {!isFreeTier && (
              <Badge variant="secondary" className="text-xs bg-white/30">
                <Sparkles className="h-3 w-3 mr-1" />
                Unlimited
              </Badge>
            )}
          </div>
          <p className="text-sm opacity-80 flex items-center">
            {isFreeTier ? (
              <>
                <span className="font-medium mr-1"><CreditBalanceAnimation value={balance} /></span> credits • {' '}
                <span className="underline cursor-pointer ml-1">Upgrade for unlimited</span>
              </>
            ) : (
              status.tooltip
            )}
          </p>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 cursor-help',
              status.color,
              className
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{status.label}</span>
            {isFreeTier && showBalance && (
              <>
                <span className="opacity-50">•</span>
                <span className="tabular-nums font-medium"><CreditBalanceAnimation value={balance} /></span>
              </>
            )}
            {!isFreeTier && (
              <>
                <span className="opacity-50">•</span>
                <span className="flex items-center gap-0.5">
                  <Sparkles className="h-3 w-3" />
                  <span className="text-xs">Unlimited</span>
                </span>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{status.tooltip}</p>
          {isFreeTier && (
            <p className="text-xs text-muted-foreground mt-1">
              Click to view subscription options
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Simple inline indicator for showing paid vs free status
 */
export function TierIndicator({ className }: { className?: string }) {
  const { isFreeTier, balance } = useCredits();
  const { currentTier, hasActiveSubscription } = useSubscriptionStatus();

  if (!isFreeTier && hasActiveSubscription) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-purple-600 font-medium', className)}>
        <Crown className="h-4 w-4" />
        {currentTier || 'Pro'}
        <span className="text-xs text-purple-400">(Unlimited)</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-emerald-600 font-medium', className)}>
      <Coins className="h-4 w-4" />
      Free Tier
      <span className="text-xs text-emerald-400 flex items-center gap-1">
        (<CreditBalanceAnimation value={balance} /> credits)
      </span>
    </span>
  );
}








