import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

import { logger } from '@/lib/logger';

export function OfflineDetectionBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      logger.info('[OfflineBanner] Connection restored');
      setIsOnline(true);
      setShowReconnected(true);

      // Hide reconnected message after 3 seconds
      setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
    };

    const handleOffline = () => {
      logger.warn('[OfflineBanner] Connection lost');
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        isOnline
          ? 'bg-emerald-600 text-white'
          : 'bg-red-600 text-white'
      }`}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-5 w-5" />
              <p className="text-sm font-medium">
                Connection restored. You are back online.
              </p>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5" />
              <p className="text-sm font-medium">
                No internet connection. Some features may be unavailable.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
