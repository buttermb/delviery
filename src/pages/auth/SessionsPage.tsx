/**
 * Sessions Page - Protected page showing all active sessions
 * Displays device type, browser, location, last active time
 * Highlights current session, provides revoke controls with confirmation
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSessions } from '@/hooks/useSessions';
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
} from 'lucide-react';
import { toast } from 'sonner';

type RevokeTarget = { type: 'single'; sessionId: string } | { type: 'all-others' } | null;

const formatTimeAgo = (date: string): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
};

const getDeviceIcon = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return <Smartphone className="h-5 w-5" />;
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return <Tablet className="h-5 w-5" />;
  }
  return <Monitor className="h-5 w-5" />;
};

const _getBrowserName = (userAgent: string): string => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg')) return 'Microsoft Edge';
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Google Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
  if (ua.includes('mobile')) return 'Mobile Browser';
  return 'Unknown Browser';
};

const _getDeviceType = (userAgent: string): string => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('android') && ua.includes('mobile')) return 'Android Phone';
  if (ua.includes('android')) return 'Android Tablet';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
  if (ua.includes('windows')) return 'Windows PC';
  if (ua.includes('linux')) return 'Linux';
  return 'Unknown Device';
};

export function SessionsPage() {
  const navigate = useNavigate();
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget>(null);

  // Auth guard: verify user is authenticated
  const { data: user, isLoading: isAuthLoading } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const {
    sessions,
    isLoading: isSessionsLoading,
    revokeSession,
    isRevoking,
    revokingSessionId,
    revokeAllOthers,
    isRevokingAll,
  } = useSessions();

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;

    if (revokeTarget.type === 'single') {
      revokeSession(revokeTarget.sessionId);
      toast.success('Session Revoked', {
        description: 'The session has been revoked successfully.',
      });
    } else {
      revokeAllOthers();
      toast.success('All Sessions Revoked', {
        description: 'All other sessions have been revoked. You remain logged in on this device.',
      });
    }
    setRevokeTarget(null);
  };

  // Auth loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="min-h-dvh bg-background">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
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
              {otherSessionsCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRevokeTarget({ type: 'all-others' })}
                  disabled={isRevokingAll}
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
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
                          {getDeviceIcon(session.displayName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {session.browserName}
                            </p>
                            {session.isCurrent && (
                              <Badge variant="default" className="text-xs shrink-0">
                                Current
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {session.deviceType}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {session.ipAddress && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {session.ipAddress}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(session.createdAt)}
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
                            setRevokeTarget({ type: 'single', sessionId: session.id })
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
      </div>

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
              {revokeTarget?.type === 'all-others'
                ? 'This will sign out all other devices. You will remain logged in on this device only. This action cannot be undone.'
                : 'This will sign out the selected device. The user will need to log in again on that device. This action cannot be undone.'}
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
