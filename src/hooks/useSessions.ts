/**
 * Hook for managing user sessions
 * Fetches active sessions and provides revoke capabilities
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { apiFetch } from '@/lib/utils/apiClient';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface Session {
  id: string;
  token: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

interface SessionsResponse {
  sessions: Session[];
}

export function useSessions() {
  const queryClient = useQueryClient();

  const {
    data: sessions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: async (): Promise<Session[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: { session } } = await supabase.auth.getSession();
      const currentToken = session?.access_token;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/get-active-sessions`, {
        method: 'POST',
        body: JSON.stringify({
          customer_user_id: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      const result: SessionsResponse = await response.json();
      return (result.sessions || []).map((s) => ({
        ...s,
        is_current: s.token === currentToken,
      }));
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('customer_sessions' as never)
        .update({ expires_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
    onError: (error: unknown) => {
      logger.error('Failed to revoke session', error, { hook: 'useSessions' });
    },
  });

  const revokeAllOthersMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: { session } } = await supabase.auth.getSession();
      const currentToken = session?.access_token;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/revoke-all-sessions`, {
        method: 'POST',
        body: JSON.stringify({
          customer_user_id: user.id,
          current_token: currentToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke sessions');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
    onError: (error: unknown) => {
      logger.error('Failed to revoke all sessions', error, { hook: 'useSessions' });
    },
  });

  return {
    sessions,
    isLoading,
    error,
    refetch,
    revokeSession: revokeSessionMutation.mutate,
    isRevoking: revokeSessionMutation.isPending,
    revokingSessionId: revokeSessionMutation.variables,
    revokeAllOthers: revokeAllOthersMutation.mutate,
    isRevokingAll: revokeAllOthersMutation.isPending,
  };
}
