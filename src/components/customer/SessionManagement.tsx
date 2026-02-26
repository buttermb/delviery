import { logger } from '@/lib/logger';
/**
 * Session Management Component
 * Allows customers to view and manage active sessions
 */

import { useState, useEffect } from 'react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Monitor, Smartphone, Tablet, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { apiFetch } from '@/lib/utils/apiClient';
// Helper function to format time ago
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

interface Session {
  id: string;
  token: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  is_current?: boolean;
}

export function SessionManagement() {
  const { customer, tenant, token } = useCustomerAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (customer && tenant) {
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadSessions is defined below and depends on customer/tenant which are already in deps
  }, [customer, tenant]);

  const loadSessions = async () => {
    if (!customer || !tenant) return;

    try {
      setLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/get-active-sessions`, {
        method: 'POST',
        body: JSON.stringify({
          customer_user_id: customer.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      const result = await response.json();
      // Mark current session
      const sessionsWithCurrent = result.sessions?.map((s: Session) => ({
        ...s,
        is_current: s.token === token,
      })) ?? [];
      setSessions(sessionsWithCurrent);
    } catch (error: unknown) {
      logger.error('Failed to load sessions', error, { component: 'SessionManagement' });
      toast.error('Failed to load active sessions', { description: humanizeError(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      toast.error('You cannot revoke your current session. Please log out instead.');
      return;
    }

    setRevoking(sessionId);
    try {
      const { error } = await supabase
        .from('customer_sessions')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Session Revoked — The session has been revoked successfully.');

      loadSessions();
    } catch (error: unknown) {
      logger.error('Failed to revoke session', error, { component: 'SessionManagement' });
      toast.error('Failed to revoke session', { description: humanizeError(error) });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!customer || !tenant || !token) return;

    setRevoking('all');
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/revoke-all-sessions`, {
        method: 'POST',
        body: JSON.stringify({
          customer_user_id: customer.id,
          current_token: token,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke sessions');
      }

      toast.success('All Sessions Revoked — All other sessions have been revoked. You will remain logged in on this device.');

      loadSessions();
    } catch (error: unknown) {
      logger.error('Failed to revoke all sessions', error, { component: 'SessionManagement' });
      toast.error('Failed to revoke sessions', { description: humanizeError(error) });
    } finally {
      setRevoking(null);
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceName = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('mobile')) return 'Mobile Browser';
    return 'Unknown Browser';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>
              Manage devices where you're logged in ({sessions.length} active)
            </CardDescription>
          </div>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAll}
              disabled={revoking === 'all'}
            >
              {revoking === 'all' ? (
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
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No active sessions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getDeviceIcon(session.user_agent)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{getDeviceName(session.user_agent)}</p>
                      {session.is_current && (
                        <Badge variant="default" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {session.ip_address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Active {formatTimeAgo(session.created_at)}
                    </p>
                  </div>
                </div>
                {!session.is_current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id, false)}
                    disabled={revoking === session.id}
                  >
                    {revoking === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {sessions.length >= 5 && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium">Session Limit Reached</p>
                <p>You have reached the maximum number of active sessions (5). Logging in from a new device will automatically revoke the oldest session.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

