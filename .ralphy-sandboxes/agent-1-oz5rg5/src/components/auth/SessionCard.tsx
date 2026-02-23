import { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface SessionInfo {
  id: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  location: {
    city?: string;
    country?: string;
  } | null;
  last_activity_at: string;
  is_current: boolean;
  ip_address?: string;
}

interface SessionCardProps {
  session: SessionInfo;
  onRevoke: (sessionId: string) => Promise<void>;
}

function getDeviceIcon(deviceType: SessionInfo['device_type']) {
  switch (deviceType) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return Tablet;
    case 'desktop':
    default:
      return Monitor;
  }
}

function formatLocation(location: SessionInfo['location']): string | null {
  if (!location) return null;
  const parts = [location.city, location.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function SessionCard({ session, onRevoke }: SessionCardProps) {
  const [isRevoking, setIsRevoking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const DeviceIcon = getDeviceIcon(session.device_type);
  const locationText = formatLocation(session.location);

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      await onRevoke(session.id);
    } finally {
      setIsRevoking(false);
      setDialogOpen(false);
    }
  };

  return (
    <Card className={session.is_current ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <DeviceIcon className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {session.browser} on {session.os}
            </span>
            {session.is_current && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Current
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {locationText && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationText}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {!session.is_current && (
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isRevoking}
              >
                {isRevoking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Revoke'
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke Session</AlertDialogTitle>
                <AlertDialogDescription>
                  This will sign out the session on {session.browser} ({session.os}).
                  The device will need to sign in again to access the account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isRevoking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    'Revoke Session'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
