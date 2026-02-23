import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

/**
 * Offline Indicator Component
 * Shows a banner when the device is offline
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
    } else {
      // Delay hiding to show "Back online" briefly
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!show) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-toast py-2 px-4 text-center text-sm font-medium transition-all duration-300 safe-area-top',
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-yellow-500 text-black'
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2">
        {!isOnline && <WifiOff className="h-4 w-4" aria-hidden="true" />}
        <span>
          {isOnline ? '✓ Back online' : 'No internet connection'}
        </span>
      </div>
    </div>
  );
}
