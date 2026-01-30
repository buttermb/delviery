/**
 * LiveOrdersCounter Component
 * Displays the count of active orders with a pulse animation when new orders arrive.
 * Can be used in headers, sidebars, or dashboard cards.
 */

import { useMemo } from 'react';
import { ShoppingBag, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLiveOrdersCount } from '@/hooks/useLiveOrdersCount';

export interface LiveOrdersCounterProps {
  /** Custom class name for the container */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Show connection status indicator */
  showConnectionStatus?: boolean;
  /** Show icon alongside count */
  showIcon?: boolean;
  /** Custom label (defaults to "Live Orders") */
  label?: string;
  /** Click handler */
  onClick?: () => void;
  /** Duration for pulse animation (ms) */
  pulseDuration?: number;
}

export function LiveOrdersCounter({
  className,
  size = 'default',
  showConnectionStatus = true,
  showIcon = true,
  label,
  onClick,
  pulseDuration = 3000,
}: LiveOrdersCounterProps) {
  const { count, isLoading, hasNewOrder, isSubscribed } = useLiveOrdersCount({
    pulseDuration,
  });

  // Size-specific classes
  const sizeClasses = useMemo(
    () => ({
      sm: {
        container: 'h-7 px-2 text-xs gap-1',
        icon: 'h-3 w-3',
        badge: 'h-4 min-w-4 text-[10px]',
        dot: 'h-1.5 w-1.5',
      },
      default: {
        container: 'h-9 px-3 text-sm gap-1.5',
        icon: 'h-4 w-4',
        badge: 'h-5 min-w-5 text-xs',
        dot: 'h-2 w-2',
      },
      lg: {
        container: 'h-11 px-4 text-base gap-2',
        icon: 'h-5 w-5',
        badge: 'h-6 min-w-6 text-sm',
        dot: 'h-2.5 w-2.5',
      },
    }),
    []
  );

  const currentSize = sizeClasses[size];

  const content = (
    <div
      className={cn(
        'relative inline-flex items-center rounded-md border transition-all duration-200',
        currentSize.container,
        hasNewOrder && 'animate-pulse-ring',
        onClick
          ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
          : 'cursor-default',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Icon */}
      {showIcon && (
        <ShoppingBag
          className={cn(
            currentSize.icon,
            'text-muted-foreground',
            hasNewOrder && 'text-primary'
          )}
        />
      )}

      {/* Label */}
      {label && <span className="font-medium">{label}</span>}

      {/* Count Badge */}
      <Badge
        variant={hasNewOrder ? 'default' : 'secondary'}
        className={cn(
          'rounded-full px-1.5 font-semibold transition-all duration-300',
          currentSize.badge,
          hasNewOrder && 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
        )}
      >
        {isLoading ? (
          <Loader2 className={cn(currentSize.icon, 'animate-spin')} />
        ) : (
          count
        )}
      </Badge>

      {/* Connection Status Indicator */}
      {showConnectionStatus && (
        <div className="relative ml-1">
          {isSubscribed ? (
            <span
              className={cn(
                'inline-block rounded-full bg-green-500',
                currentSize.dot,
                'animate-pulse-dot'
              )}
              title="Live updates active"
            />
          ) : (
            <span
              className={cn(
                'inline-block rounded-full bg-yellow-500',
                currentSize.dot
              )}
              title="Connecting..."
            />
          )}
        </div>
      )}

      {/* Pulse Ring Effect (visual indicator for new orders) */}
      {hasNewOrder && (
        <span
          className={cn(
            'absolute inset-0 rounded-md border-2 border-primary animate-ping opacity-75'
          )}
          style={{ animationDuration: '1s', animationIterationCount: '2' }}
        />
      )}
    </div>
  );

  // Wrap with tooltip if connection status is shown
  if (showConnectionStatus) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              {isSubscribed ? (
                <>
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span>Live updates active</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-yellow-500" />
                  <span>Connecting to live updates...</span>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

/**
 * Compact version for use in navigation/sidebars
 */
export function LiveOrdersCounterCompact({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { count, isLoading, hasNewOrder, isSubscribed } = useLiveOrdersCount();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('relative', className)}
            onClick={onClick}
          >
            <ShoppingBag className={cn('h-5 w-5', hasNewOrder && 'text-primary')} />

            {/* Badge */}
            {count > 0 && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 flex items-center justify-center',
                  'h-5 min-w-5 rounded-full text-[10px] font-bold',
                  'transition-all duration-300',
                  hasNewOrder
                    ? 'bg-primary text-primary-foreground animate-pulse-ring shadow-lg shadow-primary/50'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {isLoading ? '...' : count > 99 ? '99+' : count}
              </span>
            )}

            {/* Live indicator dot */}
            {isSubscribed && (
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5',
                  'h-2 w-2 rounded-full bg-green-500',
                  'animate-pulse-dot'
                )}
              />
            )}

            {/* Pulse effect on new order */}
            {hasNewOrder && (
              <span
                className="absolute inset-0 rounded-md border-2 border-primary animate-ping"
                style={{ animationDuration: '1s', animationIterationCount: '2' }}
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>
            {count} active order{count !== 1 ? 's' : ''}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Card variant for dashboard display
 */
export function LiveOrdersCounterCard({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { count, isLoading, hasNewOrder, isSubscribed } = useLiveOrdersCount();

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 p-4 rounded-lg border bg-card',
        'transition-all duration-300',
        hasNewOrder && 'border-primary shadow-lg shadow-primary/20 animate-pulse-ring',
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Icon Container */}
      <div
        className={cn(
          'flex items-center justify-center h-12 w-12 rounded-lg',
          'transition-colors duration-300',
          hasNewOrder
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <ShoppingBag className="h-6 w-6" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground">Live Orders</p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums',
            'transition-colors duration-300',
            hasNewOrder && 'text-primary'
          )}
        >
          {isLoading ? '—' : count}
        </p>
      </div>

      {/* Status Indicator */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isSubscribed ? (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse-dot" />
              <span>Live</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              <span>Connecting</span>
            </>
          )}
        </div>
        {hasNewOrder && (
          <Badge variant="default" className="text-[10px] animate-bounce">
            New!
          </Badge>
        )}
      </div>

      {/* Pulse Ring */}
      {hasNewOrder && (
        <span
          className="absolute inset-0 rounded-lg border-2 border-primary animate-ping opacity-50"
          style={{ animationDuration: '1.5s', animationIterationCount: '2' }}
        />
      )}
    </div>
  );
}
