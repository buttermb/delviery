import { logger } from '@/lib/logger';
/**
 * Forum Votes Hooks
 * TanStack Query hooks for voting on posts and comments
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as forumApi from '@/lib/api/forum';
import { queryKeys } from '@/lib/queryKeys';

export function useVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ votableType, votableId, vote }: { votableType: 'post' | 'comment'; votableId: string; vote: 1 | -1 }) =>
      forumApi.vote(votableType, votableId, vote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.comments.all() });
    },
    onError: (error: unknown) => {
      logger.error('Failed to vote', error, { component: 'useVote' });
    },
  });
}

export function useUserVote(votableType: 'post' | 'comment', votableId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.forum.votes.userVote(votableType, votableId || ''),
    queryFn: () => {
      if (!votableId) return null;
      return forumApi.getUserVote(votableType, votableId);
    },
    enabled: !!votableId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

