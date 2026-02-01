/**
 * Alert Badge Component
 * Color-coded badges for status indicators
 * - critical (red): Urgent issues requiring immediate attention
 * - warning (yellow/amber): Important but not urgent
 * - success (green): All good
 * - info (blue): Informational
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

type AlertLevel = 'critical' | 'warning' | 'success' | 'info';

interface AlertBadgeProps {
  level: AlertLevel;
  count?: number;
  label?: string;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const levelStyles: Record<AlertLevel, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  warning: 'bg-amber-500 text-white',
  success: 'bg-emerald-500 text-white',
  info: 'bg-blue-500 text-white',
};

const sizeStyles: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-5 min-w-5 text-xs px-1.5',
  md: 'h-6 min-w-6 text-sm px-2',
  lg: 'h-7 min-w-7 text-sm px-2.5',
};

export const AlertBadge = memo(function AlertBadge({
  level,
  count,
  label,
  pulse = false,
  size = 'md',
  className,
}: AlertBadgeProps) {
  const displayText = label || (count !== undefined ? (count > 99 ? '99+' : String(count)) : null);

  if (displayText === null && count === undefined) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium',
        levelStyles[level],
        sizeStyles[size],
        pulse && level === 'critical' && 'animate-pulse',
        className
      )}
    >
      {displayText}
    </span>
  );
});

export const AlertDot = memo(function AlertDot({ level, pulse = false, className }: { level: AlertLevel; pulse?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        levelStyles[level],
        pulse && 'animate-pulse',
        className
      )}
    />
  );
});
