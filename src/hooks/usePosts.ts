import { logger } from '@/lib/logger';
// @ts-nocheck
/**
 * Forum Posts Hooks
 * TanStack Query hooks for forum posts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as forumApi from '@/lib/api/forum';
import { queryKeys } from '@/lib/queryKeys';
import type { GetPostsOptions, CreatePostRequest } from '@/types/forum';

export function usePosts(options: GetPostsOptions = {}) {
  return useQuery({
    queryKey: queryKeys.forum.posts.list(options as Record<string, unknown>),
    queryFn: () => forumApi.getPosts(options),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.forum.posts.detail(postId || ''),
    queryFn: () => {
      if (!postId) throw new Error('Post ID is required');
      return forumApi.getPostById(postId);
    },
    enabled: !!postId,
    staleTime: 60 * 1000,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (post: CreatePostRequest) => forumApi.createPost(post),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.lists() });
      toast.success('Post created successfully');
    },
    onError: (error: unknown) => {
      logger.error('Failed to create post', error, { component: 'useCreatePost' });
      toast.error(error instanceof Error ? error.message : 'Failed to create post');
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, updates }: { postId: string; updates: { title?: string; content?: string } }) =>
      forumApi.updatePost(postId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.detail(variables.postId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.lists() });
      toast.success('Post updated successfully');
    },
    onError: (error: unknown) => {
      logger.error('Failed to update post', error, { component: 'useUpdatePost' });
      toast.error(error instanceof Error ? error.message : 'Failed to update post');
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => forumApi.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.lists() });
      toast.success('Post deleted successfully');
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete post', error, { component: 'useDeletePost' });
      toast.error(error instanceof Error ? error.message : 'Failed to delete post');
    },
  });
}

