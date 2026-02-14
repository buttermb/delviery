/**
 * Animated Background Component
 * Animated gradient background for dashboards
 * Inspired by modern UI design systems
 */

import { cn } from '@/lib/utils';

interface AnimatedBackgroundProps {
  className?: string;
  variant?: 'gradient' | 'dots' | 'grid';
}

export function AnimatedBackground({
  className,
  variant = 'gradient',
}: AnimatedBackgroundProps) {
  if (variant === 'gradient') {
    return (
      <div
        className={cn(
          'absolute inset-0 -z-10 overflow-hidden',
          'bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10',
          'animate-pulse',
          className
        )}
      />
    );
  }

  if (variant === 'dots') {
    return (
      <div
        className={cn(
          'absolute inset-0 -z-10 overflow-hidden',
          'bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)]',
          'bg-[length:20px_20px]',
          'animate-pulse',
          className
        )}
      />
    );
  }

  if (variant === 'grid') {
    return (
      <div
        className={cn(
          'absolute inset-0 -z-10 overflow-hidden',
          'bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]',
          'bg-[length:20px_20px]',
          className
        )}
      />
    );
  }

  return null;
}

