/**
 * Offline Indicator Component
 * Shows offline status and pending sync queue
 */

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Wifi,
  WifiOff,
  Cloud,
  RefreshCw,
  Trash2,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface QueuedItem {
  id: string;
  type: string;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error?: string;
}

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  queue: QueuedItem[];
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function OfflineIndicator({
  isOnline,
  isSyncing,
  queue,
  onRetry,
  onRemove,
  onClearAll,
  className,
}: OfflineIndicatorProps) {
  const pendingCount = queue.filter(q => q.status === 'pending' || q.status === 'syncing').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;
  const hasItems = queue.length > 0;

  // Don't show if online and no pending items
  if (isOnline && !hasItems) {
    return null;
  }

  const getStatusIcon = (status: QueuedItem['status']) => {
    switch (status) {
      case 'pending':
        return <Cloud className="h-3 w-3 text-muted-foreground" />;
      case 'syncing':
        return <Loader2 className="h-3 w-3 text-primary animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'completed':
        return <Check className="h-3 w-3 text-green-500" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2 h-8',
            !isOnline && 'text-amber-600',
            className
          )}
        >
          {isOnline ? (
            isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          {hasItems && (
            <Badge
              variant={failedCount > 0 ? 'destructive' : 'secondary'}
              className="h-5 px-1.5"
            >
              {pendingCount + failedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          {/* Status header */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Online</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-sm font-medium text-amber-600">Offline</span>
              </>
            )}
            {isSyncing && (
              <span className="text-xs text-muted-foreground ml-auto">
                Syncing...
              </span>
            )}
          </div>

          {/* Progress bar when syncing */}
          {isSyncing && pendingCount > 0 && (
            <Progress value={((queue.length - pendingCount) / queue.length) * 100} />
          )}

          {/* Queue list */}
          {hasItems ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Pending Changes
                </span>
                {onClearAll && queue.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={onClearAll}
                  >
                    Clear all
                  </Button>
                )}
              </div>

              <div className="space-y-1 max-h-[200px] overflow-auto">
                {queue.slice(0, 10).map(item => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md text-xs',
                      item.status === 'failed' && 'bg-red-50 dark:bg-red-950/20'
                    )}
                  >
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate capitalize">
                        {item.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-muted-foreground">
                        {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                      </p>
                      {item.error && (
                        <p className="text-red-500 truncate">{item.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {item.status === 'failed' && onRetry && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onRetry(item.id)}
                          aria-label="Retry"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      {onRemove && item.status !== 'syncing' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => onRemove(item.id)}
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {queue.length > 10 && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    +{queue.length - 10} more items
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Cloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">All changes synced</p>
            </div>
          )}

          {/* Offline tip */}
          {!isOnline && (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-md p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Changes are saved locally and will sync automatically when you're back online.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Simple inline badge for headers
export function OfflineBadge({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;

  return (
    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
      <WifiOff className="h-3 w-3" />
      Offline
    </Badge>
  );
}
