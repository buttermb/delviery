/**
 * useTeamActivity Hook
 * Provides access to team member activity from the unified activity feed.
 * Fetches recent actions by team members with optional filtering.
 */

import { useQuery } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

export interface TeamActivityEntry {
  id: string;
  user_id: string | null;
  tenant_id: string;
  action: string;
  category: string;
  severity: string;
  resource: string | null;
  resource_id: string | null;
  description: string | null;
  user_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Joined team member info
  team_member?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
}

export interface TeamMemberActivity {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  recentActions: TeamActivityEntry[];
  lastActivityAt: string | null;
}

export interface UseTeamActivityOptions {
  limit?: number;
  userId?: string;
  category?: string;
  enableRealtime?: boolean;
}

export function useTeamActivity(options: UseTeamActivityOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { limit = 20, userId, category, enableRealtime = true } = options;

  const queryKey = ['team', 'activity', tenantId, { limit, userId, category }] as const;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<TeamActivityEntry[]> => {
      if (!tenantId) return [];

      try {
        // Query activity logs with team member info
        // First get activity logs
        let activityQuery = supabase
          .from('activity_logs')
          .select('id, user_id, tenant_id, action, category, severity, resource, resource_id, description, user_email, metadata, created_at')
          .eq('tenant_id', tenantId)
          .not('user_id', 'is', null) // Only get activities with user_id (team member actions)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (userId) {
          activityQuery = activityQuery.eq('user_id', userId);
        }

        if (category && category !== 'all') {
          activityQuery = activityQuery.eq('category', category);
        }

        const { data: activities, error: activityError } = await activityQuery;

        if (activityError) {
          // Table might not exist yet
          if (activityError.code === '42P01') {
            return [];
          }
          throw activityError;
        }

        if (!activities || activities.length === 0) {
          return [];
        }

        // Get unique user IDs
        const userIds = [...new Set(activities.map((a: TeamActivityEntry) => a.user_id).filter(Boolean))];

        // Fetch team member info for those users
        const { data: teamMembers } = await supabase
          .from('tenant_users')
          .select('user_id, full_name, avatar_url, role')
          .eq('tenant_id', tenantId)
          .in('user_id', userIds as string[]);

        // Create a lookup map for team members
        const memberMap = new Map(
          (teamMembers ?? []).map((m) => [m.user_id, m])
        );

        // Enrich activities with team member info
        const enrichedActivities: TeamActivityEntry[] = activities.map((activity: TeamActivityEntry) => ({
          ...activity,
          team_member: activity.user_id ? memberMap.get(activity.user_id) || null : null,
        }));

        return enrichedActivities;
      } catch (err) {
        if ((err as { code?: string })?.code === '42P01') {
          return [];
        }
        logger.error('Failed to fetch team activity', err as Error, {
          component: 'useTeamActivity',
          tenantId,
        });
        throw err;
      }
    },
    enabled: !!tenantId,
  });

  // Set up realtime subscription for live updates
  useEffect(() => {
    if (!tenantId || !enableRealtime) return;

    const channel = supabase
      .channel(`team-activity-feed-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, enableRealtime, refetch]);

  return {
    activities: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
