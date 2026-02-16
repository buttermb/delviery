/**
 * Impersonation Banner Component
 * Warning banner displayed when super admin is impersonating a tenant
 */

import { AlertTriangle, ExternalLink, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface ImpersonationBannerProps {
  tenantName: string;
  sessionStartTime: Date;
  onStop: () => void;
  onOpenInNewTab?: () => void;
  className?: string;
}

export function ImpersonationBanner({
  tenantName,
  sessionStartTime,
  onStop,
  onOpenInNewTab,
  className,
}: ImpersonationBannerProps) {
  const sessionDuration = formatDistanceToNow(sessionStartTime, { addSuffix: false });

  return (
    <div
      className={`fixed top-16 left-0 right-0 z-40 bg-warning text-warning-foreground px-6 py-3 ${className}`}
    >
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <div className="font-semibold">Impersonating: {tenantName}</div>
            <div className="text-sm opacity-90">
              All actions are logged. Session started {sessionDuration} ago.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenInNewTab && (
            <Button variant="secondary" size="sm" onClick={onOpenInNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in New Tab
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={onStop}>
            <LogOut className="mr-2 h-4 w-4" />
            Stop Impersonation
          </Button>
        </div>
      </div>
    </div>
  );
}

