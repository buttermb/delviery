/**
 * Product Price Display with Strikethrough
 * Shows current price with previous price struck through if recently changed
 * Task 094: Create product pricing history
 */

import { useMemo } from 'react';
import { useRecentPriceChange, getPriceChangeDirection } from '@/hooks/usePriceHistory';
import { formatCurrency } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import { cn } from '@/lib/utils';

type PriceType = 'wholesale' | 'retail';

interface ProductPriceDisplayProps {
  productId: string | undefined;
  currentPrice: number | null | undefined;
  priceType: PriceType;
  withinDays?: number;
  showBadge?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface PriceDisplayInternalProps {
  currentPrice: number | null | undefined;
  oldPrice: number | null;
  changedAt: string | null;
  changeReason: string | null;
  showBadge: boolean;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}

function PriceDisplayInternal({
  currentPrice,
  oldPrice,
  changedAt,
  changeReason,
  showBadge,
  size,
  className,
}: PriceDisplayInternalProps) {
  const direction = getPriceChangeDirection(oldPrice, currentPrice ?? null);
  const hasRecentChange = oldPrice !== null && direction !== 'unchanged';

  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'sm':
        return { current: 'text-sm font-medium', old: 'text-xs' };
      case 'md':
        return { current: 'text-lg font-bold', old: 'text-sm' };
      case 'lg':
        return { current: 'text-2xl font-bold', old: 'text-base' };
    }
  }, [size]);

  if (currentPrice === null || currentPrice === undefined) {
    return <span className={cn('text-muted-foreground', className)}>-</span>;
  }

  const formattedChange = changedAt ? format(new Date(changedAt), 'MMM d, yyyy') : null;

  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Show old price with strikethrough if recently changed */}
      {hasRecentChange && oldPrice !== null && (
        <span
          className={cn(
            'line-through text-muted-foreground',
            sizeClasses.old,
            direction === 'increase' ? 'text-red-400' : 'text-green-400'
          )}
        >
          {formatCurrency(oldPrice)}
        </span>
      )}

      {/* Current price */}
      <span
        className={cn(
          sizeClasses.current,
          hasRecentChange && direction === 'decrease' && 'text-green-600',
          hasRecentChange && direction === 'increase' && 'text-red-600'
        )}
      >
        {formatCurrency(currentPrice)}
      </span>

      {/* Direction badge */}
      {hasRecentChange && showBadge && (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1 py-0',
            direction === 'increase' ? 'text-red-600 border-red-300' : 'text-green-600 border-green-300'
          )}
        >
          {direction === 'increase' ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
        </Badge>
      )}
    </div>
  );

  // Wrap in tooltip if there's a recent change
  if (hasRecentChange && formattedChange) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">
                Price {direction === 'increase' ? 'increased' : 'decreased'} on {formattedChange}
              </p>
              {changeReason && (
                <p className="text-muted-foreground text-xs mt-1">
                  Reason: {changeReason}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Previous: {formatCurrency(oldPrice!)} → Current: {formatCurrency(currentPrice)}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

/**
 * ProductPriceDisplay - Fetches recent price change and displays with strikethrough
 */
export function ProductPriceDisplay({
  productId,
  currentPrice,
  priceType,
  withinDays = 7,
  showBadge = true,
  className,
  size = 'md',
}: ProductPriceDisplayProps) {
  const { data: recentChange } = useRecentPriceChange(productId, withinDays);

  // Extract the relevant old price based on price type
  const oldPrice = useMemo(() => {
    if (!recentChange) return null;
    return priceType === 'wholesale'
      ? recentChange.wholesale_price_old
      : recentChange.retail_price_old;
  }, [recentChange, priceType]);

  return (
    <PriceDisplayInternal
      currentPrice={currentPrice}
      oldPrice={oldPrice}
      changedAt={recentChange?.changed_at ?? null}
      changeReason={recentChange?.change_reason ?? null}
      showBadge={showBadge}
      size={size}
      className={className}
    />
  );
}

/**
 * Standalone price display for menus/storefronts
 * Shows price with optional strikethrough without fetching data
 */
interface StaticPriceDisplayProps {
  currentPrice: number | null | undefined;
  previousPrice?: number | null;
  showBadge?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StaticPriceDisplay({
  currentPrice,
  previousPrice = null,
  showBadge = true,
  className,
  size = 'md',
}: StaticPriceDisplayProps) {
  return (
    <PriceDisplayInternal
      currentPrice={currentPrice}
      oldPrice={previousPrice}
      changedAt={null}
      changeReason={null}
      showBadge={showBadge}
      size={size}
      className={className}
    />
  );
}
