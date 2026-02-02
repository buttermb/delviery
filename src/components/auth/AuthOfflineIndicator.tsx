/**
 * Auth Offline Indicator
 * Inline indicator shown within auth forms when the user is offline.
 * Shows offline status and queued attempt state.
 */

import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import Clock from "lucide-react/dist/esm/icons/clock";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { cn } from '@/lib/utils';

interface AuthOfflineIndicatorProps {
  isOnline: boolean;
  hasQueuedAttempt?: boolean;
  className?: string;
}

/**
 * Inline offline indicator for auth forms.
 * Displays a warning banner when the user is offline,
 * and shows a pending state when a login attempt is queued.
 */
export function AuthOfflineIndicator({
  isOnline,
  hasQueuedAttempt = false,
  className,
}: AuthOfflineIndicatorProps) {
  if (isOnline && !hasQueuedAttempt) return null;

  if (hasQueuedAttempt && isOnline) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>Retrying your login attempt...</span>
      </div>
    );
  }

  if (hasQueuedAttempt && !isOnline) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Clock className="h-4 w-4 shrink-0" />
        <span>Login queued. Will retry when you&apos;re back online.</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">You are offline</p>
        <p className="text-xs text-red-600 mt-0.5">
          Check your internet connection to sign in.
        </p>
      </div>
    </div>
  );
}
