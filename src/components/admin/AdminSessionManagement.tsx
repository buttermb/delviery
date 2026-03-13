/**
 * AdminSessionManagement
 * Shows active sessions for the current user with device info and revoke controls.
 * Uses useAdminSessions hook for data and actions.
 */

import { Monitor, Smartphone, Tablet, Shield, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminSessions } from '@/hooks/useAdminSessions';

interface AdminSessionManagementProps {
  userId: string;
}

const DEVICE_ICONS = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
} as const;

export function AdminSessionManagement({ userId: _userId }: AdminSessionManagementProps) {
  const {
    sessions,
    isLoading,
    currentSession,
    otherSessions,
    revokeSession,
    revokeAllOtherSessions,
    isRevoking,
    isRevokingAll,
    revokingSessionId,
  } = useAdminSessions();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Sessions</CardTitle>
          <CardDescription>No active sessions found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg">Active Sessions</CardTitle>
          <CardDescription>
            Manage devices signed in to your account.
          </CardDescription>
        </div>
        {otherSessions.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={revokeAllOtherSessions}
            disabled={isRevokingAll}
          >
            {isRevokingAll && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Revoke All Other Sessions
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current session first */}
        {currentSession && (
          <SessionRow session={currentSession} isCurrent />
        )}

        {/* Other sessions */}
        {otherSessions.map((session) => {
          const isThisRevoking = isRevoking && revokingSessionId === session.id;
          return (
            <SessionRow
              key={session.id}
              session={session}
              onRevoke={() => revokeSession(session.id)}
              isRevoking={isThisRevoking}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Session Row
// ---------------------------------------------------------------------------

interface SessionRowProps {
  session: {
    id: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    browserName: string;
    osName: string;
    displayName: string;
    locationDisplay: string;
    lastActive: string;
    isCurrent: boolean;
    ipAddress: string | null;
  };
  isCurrent?: boolean;
  onRevoke?: () => void;
  isRevoking?: boolean;
}

function SessionRow({ session, isCurrent, onRevoke, isRevoking }: SessionRowProps) {
  const DeviceIcon = DEVICE_ICONS[session.deviceType];

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <DeviceIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{session.displayName}</span>
            {isCurrent && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Shield className="h-3 w-3" />
                Current
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{session.locationDisplay}</span>
            <span>-</span>
            <span>{session.lastActive}</span>
          </div>
        </div>
      </div>

      {!isCurrent && onRevoke && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          disabled={isRevoking}
          className="text-destructive hover:text-destructive"
        >
          {isRevoking && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Revoke
        </Button>
      )}
    </div>
  );
}
