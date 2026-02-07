/**
 * Optimistic Form Wrapper
 * Wraps forms with optimistic update behavior and visual feedback
 */

import { ReactNode, FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface OptimisticFormWrapperProps {
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  isOptimistic?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  className?: string;
  showNetworkStatus?: boolean;
}

export function OptimisticFormWrapper({
  onSubmit,
  children,
  isOptimistic = false,
  isLoading = false,
  hasError = false,
  className,
  showNetworkStatus = true,
}: OptimisticFormWrapperProps) {
  const { isOnline, isSlowConnection } = useNetworkStatus();

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'relative transition-all duration-300',
        isOptimistic && 'ring-2 ring-blue-500 ring-opacity-50',
        hasError && 'ring-2 ring-red-500 ring-opacity-50',
        className
      )}
    >
      {/* Status Indicator Overlay */}
      {(isLoading || isOptimistic || hasError) && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
          {isLoading && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-full text-xs font-medium shadow-lg animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {isOptimistic && !isLoading && !hasError && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-full text-xs font-medium shadow-lg animate-scale-in">
              <CheckCircle2 className="h-3 w-3" />
              <span>Saved!</span>
            </div>
          )}
          {hasError && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-full text-xs font-medium shadow-lg animate-shake">
              <AlertCircle className="h-3 w-3" />
              <span>Error</span>
            </div>
          )}
        </div>
      )}

      {/* Network Status Badge */}
      {showNetworkStatus && (!isOnline || isSlowConnection) && (
        <div className="absolute top-2 left-2 z-10">
          {!isOnline ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-full text-xs font-medium shadow-lg">
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </div>
          ) : isSlowConnection ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-full text-xs font-medium shadow-lg">
              <Wifi className="h-3 w-3" />
              <span>Slow Connection</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Optimistic State Overlay */}
      {isOptimistic && !isLoading && (
        <div className="absolute inset-0 bg-green-500/5 pointer-events-none rounded-lg animate-pulse" />
      )}

      {/* Error State Overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none rounded-lg animate-pulse" />
      )}

      {children}
    </form>
  );
}
