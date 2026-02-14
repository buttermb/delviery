/**
 * Live Count Badge Component
 *
 * Displays a count badge with pulse animation for real-time sidebar notifications.
 * Supports different severity levels (critical, warning, info) with appropriate colors.
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

type BadgeLevel = 'critical' | 'warning' | 'info' | 'success';

interface LiveCountBadgeProps {
  count: number;
  level?: BadgeLevel;
  pulse?: boolean;
  className?: string;
}

const levelStyles: Record<BadgeLevel, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  warning: 'bg-orange-500 text-white',
  info: 'bg-primary text-primary-foreground',
  success: 'bg-green-500 text-white',
};

const pulseStyles: Record<BadgeLevel, string> = {
  critical: 'bg-destructive/60',
  warning: 'bg-orange-500/60',
  info: 'bg-primary/60',
  success: 'bg-green-500/60',
};

export const LiveCountBadge = memo(function LiveCountBadge({
  count,
  level = 'info',
  pulse = false,
  className,
}: LiveCountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? '99+' : String(count);

  return (
    <span className={cn('relative inline-flex ml-auto flex-shrink-0', className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-75',
            pulseStyles[level]
          )}
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          'relative inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full',
          levelStyles[level]
        )}
      >
        {displayCount}
      </span>
    </span>
  );
});
