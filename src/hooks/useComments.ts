import { logger } from '@/lib/logger';
/**
 * Forum Comments Hooks
 * TanStack Query hooks for forum comments
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as forumApi from '@/lib/api/forum';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateCommentRequest } from '@/types/forum';

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.forum.comments.list(postId || ''),
    queryFn: () => {
      if (!postId) throw new Error('Post ID is required');
      return forumApi.getComments(postId);
    },
    enabled: !!postId,
    staleTime: 60 * 1000,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comment: CreateCommentRequest) => forumApi.createComment(comment),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.comments.list(variables.post_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.detail(variables.post_id) });
      toast.success('Comment posted');
    },
    onError: (error: unknown) => {
      logger.error('Failed to create comment', error, { component: 'useCreateComment' });
      toast.error(error instanceof Error ? error.message : 'Failed to post comment');
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      forumApi.updateComment(commentId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.comments.all() });
      toast.success('Comment updated');
    },
    onError: (error: unknown) => {
      logger.error('Failed to update comment', error, { component: 'useUpdateComment' });
      toast.error(error instanceof Error ? error.message : 'Failed to update comment');
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, postId }: { commentId: string; postId: string }) =>
      forumApi.deleteComment(commentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.comments.list(variables.postId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.detail(variables.postId) });
      toast.success('Comment deleted');
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete comment', error, { component: 'useDeleteComment' });
      toast.error(error instanceof Error ? error.message : 'Failed to delete comment');
    },
  });
}

