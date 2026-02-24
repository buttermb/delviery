import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

interface RawSession {
  id: string;
  token: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
}

export interface SessionInfo {
  id: string;
  token: string;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browserName: string;
  osName: string;
  displayName: string;
  locationDisplay: string;
  lastActive: string;
}

interface UseSessionsReturn {
  sessions: SessionInfo[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  currentSession: SessionInfo | undefined;
  otherSessions: SessionInfo[];
  revokeSession: (sessionId: string) => void;
  revokeAllOtherSessions: () => void;
  revokeAllOthers: () => void; // Alias for backwards compatibility
  isRevoking: boolean;
  isRevokingAll: boolean;
  revokingSessionId: string | null; // Track which session is being revoked
  refetch: () => void;
}

function parseDeviceType(userAgent: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

function parseBrowserName(userAgent: string | null): string {
  if (!userAgent) return 'Unknown Browser';
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/') || ua.includes('edge')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  return 'Unknown Browser';
}

function parseOsName(userAgent: string | null): string {
  if (!userAgent) return 'Unknown OS';
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macos') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux') && !ua.includes('android')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
  return 'Unknown OS';
}

function formatLocationFromIp(ipAddress: string | null): string {
  if (!ipAddress) return 'Unknown location';
  // IP geolocation would require an external service; display the IP as location info
  return `IP: ${ipAddress}`;
}

function formatLastActive(createdAt: string): string {
  const now = new Date();
  const then = new Date(createdAt);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

function formatSessionInfo(raw: RawSession, currentToken: string | null): SessionInfo {
  const deviceType = parseDeviceType(raw.user_agent);
  const browserName = parseBrowserName(raw.user_agent);
  const osName = parseOsName(raw.user_agent);

  return {
    id: raw.id,
    token: raw.token,
    ipAddress: raw.ip_address,
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
    isCurrent: raw.token === currentToken,
    deviceType,
    browserName,
    osName,
    displayName: `${browserName} on ${osName}`,
    locationDisplay: formatLocationFromIp(raw.ip_address),
    lastActive: formatLastActive(raw.created_at),
  };
}

const SESSION_REFRESH_INTERVAL = 60 * 1000; // 60 seconds

export function useSessions(): UseSessionsReturn {
  const { customer, token } = useCustomerAuth();
  const queryClient = useQueryClient();

  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SessionInfo[], Error>({
    queryKey: queryKeys.sessions.list(customer?.id),
    queryFn: async (): Promise<SessionInfo[]> => {
      if (!customer?.id) return [];

      const { data, error: fnError } = await supabase.functions.invoke('get-active-sessions', {
        body: { customer_user_id: customer.id },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch sessions');
      }

      const rawSessions: RawSession[] = data?.sessions ?? [];
      return rawSessions.map((s) => formatSessionInfo(s, token));
    },
    enabled: !!customer?.id,
    refetchInterval: SESSION_REFRESH_INTERVAL,
    staleTime: 30 * 1000,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error: revokeError } = await supabase
        .from('customer_sessions')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (revokeError) throw revokeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      toast.success('Session revoked successfully');
    },
    onError: (err: Error) => {
      logger.error('Failed to revoke session', err, { component: 'useSessions' });
      toast.error('Failed to revoke session', { description: humanizeError(err) });
    },
  });

  const revokeAllOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      if (!customer?.id || !token) {
        throw new Error('No active session to preserve');
      }

      const { data, error: fnError } = await supabase.functions.invoke('revoke-all-sessions', {
        body: {
          customer_user_id: customer.id,
          current_token: token,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to revoke sessions');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      toast.success('All other sessions have been revoked');
    },
    onError: (err: Error) => {
      logger.error('Failed to revoke all other sessions', err, { component: 'useSessions' });
      toast.error('Failed to revoke other sessions', { description: humanizeError(err) });
    },
  });

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return {
    sessions,
    isLoading,
    isError,
    error,
    currentSession,
    otherSessions,
    revokeSession: (sessionId: string) => revokeSessionMutation.mutate(sessionId),
    revokeAllOtherSessions: () => revokeAllOtherSessionsMutation.mutate(),
    revokeAllOthers: () => revokeAllOtherSessionsMutation.mutate(), // Alias
    isRevoking: revokeSessionMutation.isPending,
    isRevokingAll: revokeAllOtherSessionsMutation.isPending,
    revokingSessionId: revokeSessionMutation.isPending ? (revokeSessionMutation.variables as string | null) ?? null : null,
    refetch,
  };
}
