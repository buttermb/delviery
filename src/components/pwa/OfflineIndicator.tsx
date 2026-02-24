/**
 * Offline Indicator Component
 * Shows network status and sync state to users
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

/** Background Sync API — not yet in standard TS lib typings */
interface SyncManager {
  register(tag: string): Promise<void>;
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync: SyncManager;
}

interface OfflineIndicatorProps {
  /** Position of the indicator */
  position?: 'top' | 'bottom';
  /** Show detailed sync status */
  showSyncStatus?: boolean;
  /** Custom className */
  className?: string;
}

export function OfflineIndicator({
  position = 'bottom',
  showSyncStatus = false,
  className,
}: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowBanner(true);
        // Trigger sync when back online
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            if ('sync' in registration) {
              (registration as unknown as ServiceWorkerRegistrationWithSync).sync.register('sync-queue').catch(() => {
                // Background sync not available
              });
            }
          });
        }
        // Auto-hide after showing "back online"
        setTimeout(() => {
          setShowBanner(false);
          setWasOffline(false);
        }, 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowBanner(true);
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const handleRetry = async () => {
    setIsSyncing(true);
    try {
      // Trigger manual sync
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await (registration as unknown as ServiceWorkerRegistrationWithSync).sync.register('sync-queue');
        }
      }
      
      // Force refetch all queries
      window.dispatchEvent(new Event('online'));
      toast.success('Synced successfully');
    } catch (error) {
      toast.error('Sync failed', { description: humanizeError(error) });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!showBanner) return null;

  const positionClasses = {
    top: 'top-0',
    bottom: 'bottom-0',
  };

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-50 px-4 py-2 flex items-center justify-between gap-2',
        positionClasses[position],
        isOnline ? 'bg-green-600' : 'bg-amber-600',
        'text-white text-sm',
        'animate-in slide-in-from-bottom-2',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Back online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>You&apos;re offline. Changes will sync when you reconnect.</span>
          </>
        )}
      </div>

      {showSyncStatus && !isOnline && (
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/20"
          onClick={handleRetry}
          disabled={isSyncing}
        >
          <RefreshCw className={cn('h-4 w-4 mr-1', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing...' : 'Retry'}
        </Button>
      )}

      {isOnline && (
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/20"
          onClick={() => setShowBanner(false)}
        >
          Dismiss
        </Button>
      )}
    </div>
  );
}

/**
 * Compact connection status icon
 */
export function ConnectionStatus({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs',
        isOnline ? 'text-green-500' : 'text-amber-500',
        className
      )}
      title={isOnline ? 'Connected' : 'Offline'}
    >
      {isOnline ? (
        <Cloud className="h-3 w-3" />
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
    </div>
  );
}

/**
 * Hook to track online status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

