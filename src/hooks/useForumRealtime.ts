/**
 * Forum Real-time Hooks
 * Real-time subscriptions for forum posts and comments
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * Subscribe to real-time post updates
 */
export function useForumRealtimePosts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('forum-posts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'forum_posts',
        },
        (payload) => {
          logger.debug('Forum post changed', { event: payload.eventType, component: 'useForumRealtimePosts' });
          
          // Invalidate posts queries to refetch
          queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.lists() });
          
          // If specific post, invalidate that too
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            const postId = (payload.new as { id: string }).id;
            queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.detail(postId) });
          } else if (payload.old && typeof payload.old === 'object' && 'id' in payload.old) {
            const postId = (payload.old as { id: string }).id;
            queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.detail(postId) });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to forum posts realtime', undefined, { component: 'useForumRealtimePosts' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Forum posts realtime subscription error', undefined, { component: 'useForumRealtimePosts', status });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Subscribe to real-time comment updates for a specific post
 */
export function useForumRealtimeComments(postId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`forum-comments-realtime-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'forum_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          logger.debug('Forum comment changed', { event: payload.eventType, component: 'useForumRealtimeComments' });
          
          // Invalidate comments for this post
          queryClient.invalidateQueries({ queryKey: queryKeys.forum.comments.list(postId) });
          
          // Also invalidate post to update comment count
          queryClient.invalidateQueries({ queryKey: queryKeys.forum.posts.detail(postId) });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to forum comments realtime', undefined, { component: 'useForumRealtimeComments', postId });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Forum comments realtime subscription error', undefined, { component: 'useForumRealtimeComments', postId, status });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);
}

