/**
 * Locked Feature Item Component
 *
 * Displays a locked sidebar item with:
 * - Lock icon indicator
 * - Upgrade tooltip on hover
 * - Required tier badge
 * - Click handler to open upgrade modal
 */

import { Lock, Star, Diamond, Zap, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SubscriptionTier, TIER_NAMES, TIER_PRICES } from '@/lib/featureConfig';

interface LockedFeatureItemProps {
  /** Feature name to display */
  name: string;
  /** Icon component to render */
  icon: React.ComponentType<{ className?: string }>;
  /** Required tier to access this feature */
  requiredTier: SubscriptionTier;
  /** Current user tier for comparison */
  currentTier: SubscriptionTier;
  /** Click handler to open upgrade modal */
  onClick: () => void;
  /** Feature description for tooltip (optional) */
  description?: string;
  /** Additional className */
  className?: string;
  /** Whether to show compact view (icon only in collapsed sidebar) */
  compact?: boolean;
}

/**
 * Get tier badge styling based on tier
 */
function getTierInfo(tier: SubscriptionTier) {
  switch (tier) {
    case 'enterprise':
      return {
        icon: Diamond,
        label: 'Enterprise',
        shortLabel: 'Pro+',
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        borderColor: 'border-purple-500/50',
      };
    case 'professional':
      return {
        icon: Star,
        label: 'Professional',
        shortLabel: 'Pro',
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-500/50',
      };
    default:
      return {
        icon: Zap,
        label: 'Starter',
        shortLabel: 'Start',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-500/50',
      };
  }
}

export function LockedFeatureItem({
  name,
  icon: Icon,
  requiredTier,
  currentTier,
  onClick,
  description,
  className,
  compact = false,
}: LockedFeatureItemProps) {
  const tierInfo = getTierInfo(requiredTier);
  const TierIcon = tierInfo.icon;
  const priceDiff = TIER_PRICES[requiredTier] - TIER_PRICES[currentTier];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all',
              'opacity-60 hover:opacity-90',
              'hover:bg-accent/50 cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'group',
              className
            )}
            aria-label={`${name} - Locked. Requires ${TIER_NAMES[requiredTier]} plan. Click to upgrade.`}
          >
            <div className="relative flex-shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <Lock className="absolute -bottom-1 -right-1 h-2.5 w-2.5 text-muted-foreground" />
            </div>

            {!compact && (
              <>
                <span className="flex-1 truncate text-muted-foreground text-left">
                  {name}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'ml-auto flex items-center gap-1 text-[10px] px-1.5 py-0 h-5',
                    tierInfo.borderColor,
                    tierInfo.color
                  )}
                >
                  <TierIcon className="h-2.5 w-2.5" />
                  {tierInfo.shortLabel}
                </Badge>
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          className={cn(
            'max-w-[280px] p-0 overflow-hidden',
            tierInfo.bgColor
          )}
        >
          <div className="p-3 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{name}</span>
            </div>

            {/* Description */}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}

            {/* Upgrade prompt */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <TierIcon className={cn('h-3.5 w-3.5', tierInfo.color)} />
                <span className={cn('text-xs font-medium', tierInfo.color)}>
                  {TIER_NAMES[requiredTier]} Required
                </span>
              </div>
              {priceDiff > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  +${priceDiff}/mo
                </span>
              )}
            </div>

            {/* CTA */}
            <Button
              size="sm"
              className="w-full h-7 text-xs gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              Upgrade to Unlock
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Simple locked indicator for inline use
 */
export function LockedBadge({ tier }: { tier: SubscriptionTier }) {
  const tierInfo = getTierInfo(tier);
  const TierIcon = tierInfo.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'flex items-center gap-1 text-[10px] px-1.5 py-0 h-5 cursor-help',
              tierInfo.borderColor,
              tierInfo.color
            )}
          >
            <Lock className="h-2.5 w-2.5" />
            <TierIcon className="h-2.5 w-2.5" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">
            Requires {TIER_NAMES[tier]} plan
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Locked section header indicator
 */
export function LockedSectionBadge({
  count,
  onClick,
}: {
  count: number;
  lowestTier?: SubscriptionTier;
  onClick: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex items-center gap-1 text-[10px] px-1.5 py-0 h-4 opacity-60 cursor-pointer hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Lock className="h-2.5 w-2.5" />
            +{count}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">
            Upgrade to unlock {count} more feature{count !== 1 ? 's' : ''}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
