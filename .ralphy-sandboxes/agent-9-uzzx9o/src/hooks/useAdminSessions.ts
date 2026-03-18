/**
 * Admin Sessions Hook
 * Provides session management for tenant admin users
 * Fetches sessions from user_sessions table with device info
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

interface RawAdminSession {
  id: string;
  session_token: string;
  ip_address: string | null;
  device_info: {
    user_agent?: string;
    browser?: string;
    os?: string;
    device_type?: string;
  } | null;
  location: {
    city?: string;
    country?: string;
  } | null;
  is_active: boolean;
  expires_at: string;
  last_activity_at: string;
  created_at: string;
}

export interface AdminSessionInfo {
  id: string;
  token: string;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  isCurrent: boolean;
  isActive: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browserName: string;
  osName: string;
  displayName: string;
  locationDisplay: string;
  lastActive: string;
}

interface UseAdminSessionsReturn {
  sessions: AdminSessionInfo[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  currentSession: AdminSessionInfo | undefined;
  otherSessions: AdminSessionInfo[];
  revokeSession: (sessionId: string) => void;
  revokeAllOtherSessions: () => void;
  isRevoking: boolean;
  isRevokingAll: boolean;
  revokingSessionId: string | null;
  refetch: () => void;
}

function parseDeviceType(deviceInfo: RawAdminSession['device_info']): 'mobile' | 'tablet' | 'desktop' {
  if (!deviceInfo) return 'desktop';

  // Check device_type field first
  if (deviceInfo.device_type) {
    const dt = deviceInfo.device_type.toLowerCase();
    if (dt === 'mobile') return 'mobile';
    if (dt === 'tablet') return 'tablet';
    if (dt === 'desktop') return 'desktop';
  }

  // Fall back to user agent parsing
  const userAgent = deviceInfo.user_agent;
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

function parseBrowserName(deviceInfo: RawAdminSession['device_info']): string {
  if (!deviceInfo) return 'Unknown Browser';

  // Check browser field first
  if (deviceInfo.browser) {
    return deviceInfo.browser;
  }

  // Fall back to user agent parsing
  const userAgent = deviceInfo.user_agent;
  if (!userAgent) return 'Unknown Browser';

  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/') || ua.includes('edge')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  return 'Unknown Browser';
}

function parseOsName(deviceInfo: RawAdminSession['device_info']): string {
  if (!deviceInfo) return 'Unknown OS';

  // Check os field first
  if (deviceInfo.os) {
    return deviceInfo.os;
  }

  // Fall back to user agent parsing
  const userAgent = deviceInfo.user_agent;
  if (!userAgent) return 'Unknown OS';

  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macos') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux') && !ua.includes('android')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
  return 'Unknown OS';
}

function formatLocationFromData(ipAddress: string | null, location: RawAdminSession['location']): string {
  if (location?.city && location?.country) {
    return `${location.city}, ${location.country}`;
  }
  if (location?.country) {
    return location.country;
  }
  if (ipAddress) {
    return `IP: ${ipAddress}`;
  }
  return 'Unknown location';
}

function formatLastActive(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
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

function formatSessionInfo(raw: RawAdminSession, currentToken: string | null): AdminSessionInfo {
  const deviceType = parseDeviceType(raw.device_info);
  const browserName = parseBrowserName(raw.device_info);
  const osName = parseOsName(raw.device_info);

  return {
    id: raw.id,
    token: raw.session_token,
    ipAddress: raw.ip_address,
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
    lastActivityAt: raw.last_activity_at,
    isCurrent: raw.session_token === currentToken,
    isActive: raw.is_active,
    deviceType,
    browserName,
    osName,
    displayName: `${browserName} on ${osName}`,
    locationDisplay: formatLocationFromData(raw.ip_address, raw.location),
    lastActive: formatLastActive(raw.last_activity_at || raw.created_at),
  };
}

const SESSION_REFRESH_INTERVAL = 60 * 1000; // 60 seconds

export function useAdminSessions(): UseAdminSessionsReturn {
  const { admin, token, tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const adminQueryKey = ['admin-sessions', admin?.userId, tenant?.id];

  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AdminSessionInfo[], Error>({
    queryKey: adminQueryKey,
    queryFn: async (): Promise<AdminSessionInfo[]> => {
      if (!admin?.userId) return [];

      // Query user_sessions table for the current user
      const { data, error: queryError } = await supabase
        .from('user_sessions')
        .select('id, session_token, ip_address, device_info, location, is_active, expires_at, last_activity_at, created_at')
        .eq('user_id', admin.userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity_at', { ascending: false });

      if (queryError) {
        logger.error('Failed to fetch admin sessions', queryError, { component: 'useAdminSessions' });
        throw new Error(queryError.message || 'Failed to fetch sessions');
      }

      const rawSessions: RawAdminSession[] = (data ?? []).map((session: Record<string, unknown>) => ({
        id: session.id,
        session_token: session.session_token,
        ip_address: session.ip_address,
        device_info: session.device_info as RawAdminSession['device_info'],
        location: session.location as RawAdminSession['location'],
        is_active: session.is_active ?? true,
        expires_at: session.expires_at,
        last_activity_at: session.last_activity_at,
        created_at: session.created_at,
      }));

      return rawSessions.map((s) => formatSessionInfo(s, token));
    },
    enabled: !!admin?.userId,
    refetchInterval: SESSION_REFRESH_INTERVAL,
    staleTime: 30 * 1000,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // Deactivate the session by setting is_active to false and expiring it
      const { error: revokeError } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          expires_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', admin?.userId);

      if (revokeError) throw revokeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKey });
      toast.success('Session revoked successfully');
    },
    onError: (err: Error) => {
      logger.error('Failed to revoke session', err, { component: 'useAdminSessions' });
      toast.error('Failed to revoke session', { description: humanizeError(err) });
    },
  });

  const revokeAllOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      if (!admin?.userId || !token) {
        throw new Error('No active session to preserve');
      }

      // Deactivate all sessions except the current one
      const { error: revokeError } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          expires_at: new Date().toISOString()
        })
        .eq('user_id', admin.userId)
        .neq('session_token', token);

      if (revokeError) throw revokeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKey });
      toast.success('All other sessions have been revoked');
    },
    onError: (err: Error) => {
      logger.error('Failed to revoke all other sessions', err, { component: 'useAdminSessions' });
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
    isRevoking: revokeSessionMutation.isPending,
    isRevokingAll: revokeAllOtherSessionsMutation.isPending,
    revokingSessionId: revokeSessionMutation.isPending ? (revokeSessionMutation.variables as string | null) ?? null : null,
    refetch,
  };
}
