/**
 * Last Updated Indicator
 * Shows data freshness with auto-refresh option
 */

import { useState, useEffect } from 'react';
import Clock from "lucide-react/dist/esm/icons/clock";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface LastUpdatedProps {
  lastFetched: Date | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  autoRefreshInterval?: number; // in milliseconds
}

export function LastUpdated({
  lastFetched,
  onRefresh,
  isRefreshing = false,
  className,
  autoRefreshInterval,
}: LastUpdatedProps) {
  const [, setTick] = useState(0);

  // Update display every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefreshInterval || !onRefresh) return;
    const interval = setInterval(onRefresh, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, onRefresh]);

  if (!lastFetched) return null;

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <Clock className="h-3 w-3" />
      <span>Updated {formatDistanceToNow(lastFetched, { addSuffix: true })}</span>
      {onRefresh && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
        </Button>
      )}
    </div>
  );
}

interface DataFreshnessIndicatorProps {
  lastFetched: Date | null;
  staleAfterMinutes?: number;
  className?: string;
}

export function DataFreshnessIndicator({
  lastFetched,
  staleAfterMinutes = 5,
  className,
}: DataFreshnessIndicatorProps) {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!lastFetched) return;

    const checkStale = () => {
      const minutesAgo = (Date.now() - lastFetched.getTime()) / 1000 / 60;
      setIsStale(minutesAgo > staleAfterMinutes);
    };

    checkStale();
    const interval = setInterval(checkStale, 30000);
    return () => clearInterval(interval);
  }, [lastFetched, staleAfterMinutes]);

  if (!lastFetched) return null;

  return (
    <div
      className={cn(
        'w-2 h-2 rounded-full',
        isStale ? 'bg-amber-500' : 'bg-emerald-500',
        className
      )}
      title={isStale ? 'Data may be stale - consider refreshing' : 'Data is fresh'}
    />
  );
}
