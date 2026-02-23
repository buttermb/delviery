/**
 * Admin Sessions Page
 * Displays all active sessions for the current tenant admin user
 * Shows device info, browser, location, and last activity
 * Provides session revocation controls with confirmation dialogs
 */

import { useState } from 'react';
import { useAdminSessions, type AdminSessionInfo } from '@/hooks/useAdminSessions';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  Shield,
  Loader2,
  MapPin,
  Clock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { TruncatedText } from '@/components/shared/TruncatedText';

type RevokeTarget = { type: 'single'; sessionId: string; displayName: string } | { type: 'all-others' } | null;

const getDeviceIcon = (deviceType: AdminSessionInfo['deviceType']) => {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="h-5 w-5" />;
    case 'tablet':
      return <Tablet className="h-5 w-5" />;
    default:
      return <Monitor className="h-5 w-5" />;
  }
};

const formatTimeAgo = (dateStr: string): string => {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
};

export function SessionsPage() {
  const { admin, loading: authLoading } = useTenantAdminAuth();
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget>(null);

  const {
    sessions,
    isLoading: isSessionsLoading,
    isError,
    error,
    revokeSession,
    isRevoking,
    revokingSessionId,
    revokeAllOtherSessions,
    isRevokingAll,
    refetch,
  } = useAdminSessions();

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;

    if (revokeTarget.type === 'single') {
      revokeSession(revokeTarget.sessionId);
    } else {
      revokeAllOtherSessions();
    }
    setRevokeTarget(null);
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated
  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Authentication Required</h2>
        <p className="text-muted-foreground">Please log in to view your active sessions.</p>
      </div>
    );
  }

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6 p-6 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Active Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Manage devices where you are currently logged in
          </p>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Failed to load sessions</p>
              <p className="text-sm text-muted-foreground">
                {error?.message || 'An unexpected error occurred'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sessions Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Your Sessions</CardTitle>
              <CardDescription>
                {isSessionsLoading
                  ? 'Loading sessions...'
                  : `${sessions.length} active session${sessions.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isSessionsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSessionsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {otherSessionsCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRevokeTarget({ type: 'all-others' })}
                  disabled={isRevokingAll || isRevoking}
                >
                  {isRevokingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Revoke All Others
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isSessionsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No active sessions</p>
              <p className="text-sm">Your session information is unavailable.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions
                .sort((a, b) => {
                  // Current session first
                  if (a.isCurrent) return -1;
                  if (b.isCurrent) return 1;
                  // Then sort by last activity
                  return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
                })
                .map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      session.isCurrent
                        ? 'border-primary/50 bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                          session.isCurrent
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {getDeviceIcon(session.deviceType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <TruncatedText text={session.browserName} className="font-medium" as="p" />
                          {session.isCurrent && (
                            <Badge variant="default" className="text-xs shrink-0">
                              Current
                            </Badge>
                          )}
                        </div>
                        <TruncatedText text={`${session.osName} • ${session.deviceType}`} className="text-sm text-muted-foreground" as="p" />
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {session.locationDisplay}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Last active: {formatTimeAgo(session.lastActivityAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                        onClick={() =>
                          setRevokeTarget({
                            type: 'single',
                            sessionId: session.id,
                            displayName: session.displayName,
                          })
                        }
                        disabled={isRevoking && revokingSessionId === session.id}
                      >
                        {isRevoking && revokingSessionId === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <LogOut className="h-4 w-4 mr-1" />
                            Revoke
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Information
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • <strong>Current session</strong> is highlighted and cannot be revoked from this page.
          </p>
          <p>
            • <strong>Revoking a session</strong> will immediately sign out that device.
          </p>
          <p>
            • Sessions automatically expire after a period of inactivity.
          </p>
          <p>
            • If you don't recognize a session, revoke it immediately and change your password.
          </p>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revokeTarget?.type === 'all-others'
                ? 'Revoke All Other Sessions?'
                : 'Revoke Session?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.type === 'all-others' ? (
                <>
                  This will sign out all other devices ({otherSessionsCount} session{otherSessionsCount !== 1 ? 's' : ''}).
                  You will remain logged in on this device only.
                  <br /><br />
                  This action cannot be undone.
                </>
              ) : (
                <>
                  This will sign out the session on <strong>{revokeTarget?.displayName}</strong>.
                  The user will need to log in again on that device.
                  <br /><br />
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking || isRevokingAll}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRevoking || isRevokingAll}
            >
              {isRevoking || isRevokingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
