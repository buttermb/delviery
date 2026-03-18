import { logger } from '@/lib/logger';
/**
 * Forum Profile Hooks
 * TanStack Query hooks for forum user profiles
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as forumApi from '@/lib/api/forum';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import type { CreateForumProfileRequest } from '@/types/forum';

export function useForumProfile() {
  return useQuery({
    queryKey: queryKeys.forum.profile.current(),
    queryFn: () => forumApi.getForumProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useForumProfileByUsername(username: string | undefined) {
  return useQuery({
    queryKey: queryKeys.forum.profile.byUsername(username ?? ''),
    queryFn: () => {
      if (!username) throw new Error('Username is required');
      return forumApi.getForumProfileByUsername(username);
    },
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateForumProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profile: CreateForumProfileRequest) => forumApi.createForumProfile(profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.profile.current() });
      toast.success('Forum profile created successfully');
    },
    onError: (error: unknown) => {
      logger.error('Failed to create forum profile', error, { component: 'useCreateForumProfile' });
      toast.error(humanizeError(error, 'Failed to create profile'));
    },
  });
}

export function useUpdateForumProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<CreateForumProfileRequest>) => forumApi.updateForumProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.profile.current() });
      toast.success('Profile updated successfully');
    },
    onError: (error: unknown) => {
      logger.error('Failed to update forum profile', error, { component: 'useUpdateForumProfile' });
      toast.error(humanizeError(error, 'Failed to update profile'));
    },
  });
}

