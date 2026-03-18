/**
 * StatsCard Component
 *
 * A reusable stat card for dashboards showing title, value, change percentage,
 * trend indicator, and optional sparkline visualization.
 */

import { type ReactNode, useCallback, useMemo } from 'react';
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Trend direction types
 */
export type TrendDirection = 'up' | 'down' | 'flat';

/**
 * Props for StatsCard component
 */
export interface StatsCardProps {
  /** Title displayed above the value */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Percentage change value */
  change?: number;
  /** Trend direction: up, down, or flat */
  trend?: TrendDirection;
  /** Icon component to display */
  icon?: LucideIcon;
  /** Click handler for the card */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Data array for sparkline visualization */
  data?: number[];
  /** Optional subtitle or description */
  subtitle?: string;
  /** Additional className for custom styling */
  className?: string;
}

/**
 * Simple sparkline component for mini chart visualization
 */
interface SparklineProps {
  data: number[];
  className?: string;
}

function Sparkline({ data, className }: SparklineProps) {
  const { pathD, width, height } = useMemo(() => {
    if (!data || data.length < 2) {
      return { pathD: '', width: 80, height: 32 };
    }

    const w = 80;
    const h = 32;
    const padding = 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (w - padding * 2);
      const y = h - padding - ((value - min) / range) * (h - padding * 2);
      return `${x},${y}`;
    });

    return {
      pathD: `M ${points.join(' L ')}`,
      width: w,
      height: h,
    };
  }, [data]);

  if (!data || data.length < 2) {
    return null;
  }

  const isPositive = data[data.length - 1] >= data[0];

  return (
    <svg
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
    >
      <path
        d={pathD}
        fill="none"
        stroke={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Get trend icon component based on direction
 */
function getTrendIcon(trend: TrendDirection): LucideIcon {
  switch (trend) {
    case 'up':
      return TrendingUp;
    case 'down':
      return TrendingDown;
    case 'flat':
    default:
      return Minus;
  }
}

/**
 * Get trend color classes based on direction
 */
function getTrendColorClasses(trend: TrendDirection): string {
  switch (trend) {
    case 'up':
      return 'text-green-600 dark:text-green-400';
    case 'down':
      return 'text-red-600 dark:text-red-400';
    case 'flat':
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get change color classes based on value
 */
function getChangeColorClasses(change: number): string {
  if (change > 0) {
    return 'text-green-600 dark:text-green-400';
  }
  if (change < 0) {
    return 'text-red-600 dark:text-red-400';
  }
  return 'text-muted-foreground';
}

/**
 * Format change value with sign and percentage
 */
function formatChange(change: number): string {
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Loading skeleton for StatsCard
 */
function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </Card>
  );
}

/**
 * StatsCard - Reusable stat card for dashboards
 *
 * Displays a statistic with title, value, optional change percentage,
 * trend indicator, icon, and mini sparkline chart.
 *
 * Usage:
 * ```tsx
 * <StatsCard
 *   title="Total Revenue"
 *   value="$12,345"
 *   change={12.5}
 *   trend="up"
 *   icon={DollarSign}
 *   onClick={() => navigate('/analytics')}
 * />
 *
 * // With sparkline data
 * <StatsCard
 *   title="Orders"
 *   value={1234}
 *   data={[10, 15, 12, 18, 22, 19, 25]}
 *   trend="up"
 * />
 * ```
 */
export function StatsCard({
  title,
  value,
  change,
  trend = 'flat',
  icon: Icon,
  onClick,
  loading = false,
  data,
  subtitle,
  className,
}: StatsCardProps) {
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (onClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  if (loading) {
    return <StatsCardSkeleton className={className} />;
  }

  const TrendIcon = getTrendIcon(trend);
  const trendColorClasses = getTrendColorClasses(trend);
  const changeColorClasses = change !== undefined ? getChangeColorClasses(change) : '';

  const isClickable = Boolean(onClick);

  return (
    <Card
      className={cn(
        'p-6 transition-all duration-200',
        isClickable && 'cursor-pointer hover:shadow-md hover:border-primary/20',
        className
      )}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `${title}: ${value}. Click for details.` : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm font-medium text-muted-foreground mb-1 truncate">
            {title}
          </p>

          {/* Value */}
          <p className="text-2xl font-bold tracking-tight truncate">{value}</p>

          {/* Change and Trend */}
          <div className="flex items-center gap-2 mt-2">
            {change !== undefined && (
              <span className={cn('text-sm font-semibold', changeColorClasses)}>
                {formatChange(change)}
              </span>
            )}
            {trend !== 'flat' && (
              <TrendIcon
                className={cn('h-4 w-4', trendColorClasses)}
                aria-label={`Trend: ${trend}`}
              />
            )}
            {subtitle && (
              <span className="text-xs text-muted-foreground truncate">
                {subtitle}
              </span>
            )}
          </div>

          {/* Sparkline */}
          {data && data.length >= 2 && (
            <div className="mt-3">
              <Sparkline data={data} />
            </div>
          )}
        </div>

        {/* Icon */}
        {Icon && (
          <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * StatsCardGrid - Helper component for laying out multiple StatsCards
 */
export interface StatsCardGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsCardGrid({
  children,
  columns = 4,
  className,
}: StatsCardGridProps) {
  const gridColsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridColsClass[columns], className)}>
      {children}
    </div>
  );
}

export { StatsCardSkeleton };
