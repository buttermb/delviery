
import { logger } from '@/lib/logger';
/**
 * Forum API Functions
 * All forum-related database operations
 */

import { supabase } from '@/integrations/supabase/client';
import { sanitizeForTextSearch } from '@/lib/utils/searchSanitize';
import type {
  ForumPost,
  ForumComment,
  ForumCategory,
  ForumVote,
  ForumUserProfile,
  ForumUserApproval,
  UserReputation,
  ForumNotification,
  CreatePostRequest,
  CreateCommentRequest,
  CreateForumProfileRequest,
  RequestForumApprovalRequest,
  GetPostsOptions,
} from '@/types/forum';

// ============================================================================
// POSTS
// ============================================================================

export async function getPosts(options: GetPostsOptions = {}): Promise<ForumPost[]> {
  try {
    let query = supabase
      .from('forum_posts')
      .select(`
        *,
        category:forum_categories(*),
        author:forum_user_profiles(
          *,
          customer_user:customer_users(id, email, first_name, last_name)
        ),
        linked_listing:marketplace_listings(
          id,
          product_name,
          base_price,
          images,
          description,
          marketplace_profiles(
            business_name,
            verified_badge
          )
        )
      `)
      .eq('is_removed', false);

    if (options.categoryId) {
      query = query.eq('category_id', options.categoryId);
    }

    // Sorting
    switch (options.sortBy) {
      case 'hot':
        query = query.order('upvote_count', { ascending: false });
        break;
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top':
        query = query.order('upvote_count', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    if (options.limit) {
      query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch posts', error, { component: 'forumApi', action: 'getPosts' });
      throw error;
    }

    return (data ?? []) as unknown as ForumPost[];
  } catch (error) {
    logger.error('Error in getPosts', error, { component: 'forumApi' });
    throw error;
  }
}

export async function getPostById(postId: string): Promise<ForumPost | null> {
  try {
    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        *,
        category:forum_categories(*),
        author:forum_user_profiles(
          *,
          customer_user:customer_users(id, email, first_name, last_name)
        ),
        linked_listing:marketplace_listings(
          id,
          product_name,
          base_price,
          images,
          description,
          marketplace_profiles(
            business_name,
            verified_badge
          )
        )
      `)
      .eq('id', postId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch post', error, { component: 'forumApi', action: 'getPostById', postId });
      throw error;
    }

    if (!data) return null;

    // Increment view count
    await supabase
      .from('forum_posts')
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq('id', postId);

    return data as unknown as ForumPost;
  } catch (error) {
    logger.error('Error in getPostById', error, { component: 'forumApi', postId });
    throw error;
  }
}

export async function createPost(post: CreatePostRequest): Promise<ForumPost> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user's forum profile
    const { data: profile } = await supabase
      .from('forum_user_profiles')
      .select('id, tenant_id')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('Forum profile not found. Please create a username first.');
    }

    const { data, error } = await supabase
      .from('forum_posts')
      .insert({
        ...post,
        author_id: profile.id,
        tenant_id: profile.tenant_id,
      })
      .select(`
        *,
        category:forum_categories(*),
        author:forum_user_profiles(
          *,
          customer_user:customer_users(id, email, first_name, last_name)
        )
      `)
      .maybeSingle();

    if (error) {
      logger.error('Failed to create post', error, { component: 'forumApi', action: 'createPost' });
      throw error;
    }

    return data as unknown as ForumPost;
  } catch (error) {
    logger.error('Error in createPost', error, { component: 'forumApi' });
    throw error;
  }
}

export async function updatePost(postId: string, updates: { title?: string; content?: string }): Promise<ForumPost> {
  try {
    const { data, error } = await supabase
      .from('forum_posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select()
      .maybeSingle();

    if (error) {
      logger.error('Failed to update post', error, { component: 'forumApi', action: 'updatePost', postId });
      throw error;
    }

    return data as ForumPost;
  } catch (error) {
    logger.error('Error in updatePost', error, { component: 'forumApi', postId });
    throw error;
  }
}

export async function deletePost(postId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('forum_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      logger.error('Failed to delete post', error, { component: 'forumApi', action: 'deletePost', postId });
      throw error;
    }
  } catch (error) {
    logger.error('Error in deletePost', error, { component: 'forumApi', postId });
    throw error;
  }
}

// ============================================================================
// COMMENTS
// ============================================================================

export async function getComments(postId: string): Promise<ForumComment[]> {
  try {
    const { data, error } = await supabase
      .from('forum_comments')
      .select(`
        *,
        author:forum_user_profiles(
          *,
          customer_user:customer_users(id, email, first_name, last_name)
        )
      `)
      .eq('post_id', postId)
      .eq('is_removed', false)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch comments', error, { component: 'forumApi', action: 'getComments', postId });
      throw error;
    }

    return (data ?? []) as unknown as ForumComment[];
  } catch (error) {
    logger.error('Error in getComments', error, { component: 'forumApi', postId });
    throw error;
  }
}

export async function createComment(comment: CreateCommentRequest): Promise<ForumComment> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user's forum profile
    const { data: profile } = await supabase
      .from('forum_user_profiles')
      .select('id')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('Forum profile not found. Please create a username first.');
    }

    // Calculate depth if parent exists
    let depth = 0;
    if (comment.parent_comment_id) {
      const { data: parent } = await supabase
        .from('forum_comments')
        .select('depth')
        .eq('id', comment.parent_comment_id)
        .maybeSingle();

      depth = parent ? (parent.depth ?? 0) + 1 : 0;

      // Limit depth to 3
      if (depth > 3) {
        depth = 3;
      }
    }

    const { data, error } = await supabase
      .from('forum_comments')
      .insert({
        ...comment,
        author_id: profile.id,
        depth,
      })
      .select(`
        *,
        author:forum_user_profiles(
          *,
          customer_user:customer_users(id, email, first_name, last_name)
        )
      `)
      .maybeSingle();

    if (error) {
      logger.error('Failed to create comment', error, { component: 'forumApi', action: 'createComment' });
      throw error;
    }

    return data as unknown as ForumComment;
  } catch (error) {
    logger.error('Error in createComment', error, { component: 'forumApi' });
    throw error;
  }
}

export async function updateComment(commentId: string, content: string): Promise<ForumComment> {
  try {
    const { data, error } = await supabase
      .from('forum_comments')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .select()
      .maybeSingle();

    if (error) {
      logger.error('Failed to update comment', error, { component: 'forumApi', action: 'updateComment', commentId });
      throw error;
    }

    return data as ForumComment;
  } catch (error) {
    logger.error('Error in updateComment', error, { component: 'forumApi', commentId });
    throw error;
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('forum_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      logger.error('Failed to delete comment', error, { component: 'forumApi', action: 'deleteComment', commentId });
      throw error;
    }
  } catch (error) {
    logger.error('Error in deleteComment', error, { component: 'forumApi', commentId });
    throw error;
  }
}

// ============================================================================
// VOTES
// ============================================================================

export async function vote(votableType: 'post' | 'comment', votableId: string, vote: 1 | -1): Promise<ForumVote | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user's forum profile
    const { data: profile } = await supabase
      .from('forum_user_profiles')
      .select('id')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('Forum profile not found');
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('forum_votes')
      .select()
      .eq('user_id', profile.id)
      .eq('votable_type', votableType)
      .eq('votable_id', votableId)
      .maybeSingle();

    if (existingVote) {
      // Same vote = remove vote
      if (existingVote.vote === vote) {
        const { error } = await supabase
          .from('forum_votes')
          .delete()
          .eq('id', existingVote.id);

        if (error) throw error;
        return null;
      } else {
        // Different vote = update vote
        const { data, error } = await supabase
          .from('forum_votes')
          .update({ vote })
          .eq('id', existingVote.id)
          .select()
          .maybeSingle();

        if (error) throw error;
        return data as ForumVote;
      }
    } else {
      // New vote
      const { data, error } = await supabase
        .from('forum_votes')
        .insert({
          user_id: profile.id,
          votable_type: votableType,
          votable_id: votableId,
          vote,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data as ForumVote;
    }
  } catch (error) {
    logger.error('Error in vote', error, { component: 'forumApi', votableType, votableId });
    throw error;
  }
}

export async function getUserVote(votableType: 'post' | 'comment', votableId: string): Promise<1 | -1 | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get user's forum profile
    const { data: profile } = await supabase
      .from('forum_user_profiles')
      .select('id')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (!profile) return null;

    const { data } = await supabase
      .from('forum_votes')
      .select('vote')
      .eq('user_id', profile.id)
      .eq('votable_type', votableType)
      .eq('votable_id', votableId)
      .maybeSingle();

    return (data?.vote as 1 | -1) || null;
  } catch (error) {
    logger.error('Error in getUserVote', error, { component: 'forumApi', votableType, votableId });
    return null;
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================

export async function getCategories(): Promise<ForumCategory[]> {
  try {
    const { data, error } = await supabase
      .from('forum_categories')
      .select('*')
      .order('display_order');

    if (error) {
      logger.error('Failed to fetch categories', error, { component: 'forumApi', action: 'getCategories' });
      throw error;
    }

    return (data ?? []) as ForumCategory[];
  } catch (error) {
    logger.error('Error in getCategories', error, { component: 'forumApi' });
    throw error;
  }
}

// ============================================================================
// SEARCH
// ============================================================================

export async function searchPosts(query: string): Promise<ForumPost[]> {
  try {
    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        *,
        category:forum_categories(*),
        author:forum_user_profiles(
          *,
          customer_user:customer_users(id, email, first_name, last_name)
        )
      `)
      .textSearch('search_vector', sanitizeForTextSearch(query))
      .eq('is_removed', false)
      .limit(20);

    if (error) {
      logger.error('Failed to search posts', error, { component: 'forumApi', action: 'searchPosts', query });
      throw error;
    }

    return (data ?? []) as unknown as ForumPost[];
  } catch (error) {
    logger.error('Error in searchPosts', error, { component: 'forumApi', query });
    throw error;
  }
}

// ============================================================================
// USER REPUTATION
// ============================================================================

export async function getUserReputation(userId: string): Promise<UserReputation | null> {
  try {
    const { data, error } = await supabase
      .from('user_reputation')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch reputation', error, { component: 'forumApi', action: 'getUserReputation', userId });
      throw error;
    }

    return data as UserReputation | null;
  } catch (error) {
    logger.error('Error in getUserReputation', error, { component: 'forumApi', userId });
    throw error;
  }
}

// ============================================================================
// USER PROFILES
// ============================================================================

export async function getForumProfile(customerUserId?: string): Promise<ForumUserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const userId = customerUserId || user.id;

    const { data, error } = await supabase
      .from('forum_user_profiles')
      .select('*')
      .eq('customer_user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch forum profile', error, { component: 'forumApi', action: 'getForumProfile' });
      throw error;
    }

    return data as ForumUserProfile | null;
  } catch (error) {
    logger.error('Error in getForumProfile', error, { component: 'forumApi' });
    throw error;
  }
}

export async function createForumProfile(profile: CreateForumProfileRequest): Promise<ForumUserProfile> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get customer user tenant_id
    const { data: customerUser } = await supabase
      .from('customer_users')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('forum_user_profiles')
      .insert({
        ...profile,
        customer_user_id: user.id,
        tenant_id: customerUser?.tenant_id || null,
      })
      .select()
      .maybeSingle();

    if (error) {
      logger.error('Failed to create forum profile', error, { component: 'forumApi', action: 'createForumProfile' });
      throw error;
    }

    return data as ForumUserProfile;
  } catch (error) {
    logger.error('Error in createForumProfile', error, { component: 'forumApi' });
    throw error;
  }
}

export async function updateForumProfile(updates: Partial<CreateForumProfileRequest>): Promise<ForumUserProfile> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('forum_user_profiles')
      .select('id')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('Forum profile not found');
    }

    const { data, error } = await supabase
      .from('forum_user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .select()
      .maybeSingle();

    if (error) {
      logger.error('Failed to update forum profile', error, { component: 'forumApi', action: 'updateForumProfile' });
      throw error;
    }

    return data as ForumUserProfile;
  } catch (error) {
    logger.error('Error in updateForumProfile', error, { component: 'forumApi' });
    throw error;
  }
}

export async function getForumProfileByUsername(username: string): Promise<ForumUserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('forum_user_profiles')
      .select(`
        *,
        customer_user:customer_users(id, email, first_name, last_name)
      `)
      .eq('username', username)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch profile by username', error, { component: 'forumApi', action: 'getForumProfileByUsername', username });
      throw error;
    }

    return data as ForumUserProfile | null;
  } catch (error) {
    logger.error('Error in getForumProfileByUsername', error, { component: 'forumApi', username });
    throw error;
  }
}

// ============================================================================
// APPROVALS
// ============================================================================

export async function getForumApproval(): Promise<ForumUserApproval | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('forum_user_approvals')
      .select('*')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch approval', error, { component: 'forumApi', action: 'getForumApproval' });
      throw error;
    }

    return data as ForumUserApproval | null;
  } catch (error) {
    logger.error('Error in getForumApproval', error, { component: 'forumApi' });
    throw error;
  }
}

export async function requestForumApproval(request: RequestForumApprovalRequest): Promise<ForumUserApproval> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get customer user tenant_id
    const { data: customerUser } = await supabase
      .from('customer_users')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('forum_user_approvals')
      .insert({
        customer_user_id: user.id,
        tenant_id: customerUser?.tenant_id || null,
        request_message: request.request_message || null,
      })
      .select()
      .maybeSingle();

    if (error) {
      logger.error('Failed to request approval', error, { component: 'forumApi', action: 'requestForumApproval' });
      throw error;
    }

    return data as ForumUserApproval;
  } catch (error) {
    logger.error('Error in requestForumApproval', error, { component: 'forumApi' });
    throw error;
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export async function getNotifications(limit = 20): Promise<ForumNotification[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('forum_user_profiles')
      .select('id')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (!profile) return [];

    const { data, error } = await supabase
      .from('forum_notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch notifications', error, { component: 'forumApi', action: 'getNotifications' });
      throw error;
    }

    return (data ?? []) as ForumNotification[];
  } catch (error) {
    logger.error('Error in getNotifications', error, { component: 'forumApi' });
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('forum_notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      logger.error('Failed to mark notification as read', error, { component: 'forumApi', action: 'markNotificationAsRead', notificationId });
      throw error;
    }
  } catch (error) {
    logger.error('Error in markNotificationAsRead', error, { component: 'forumApi', notificationId });
    throw error;
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('forum_user_profiles')
      .select('id')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (!profile) return;

    const { error } = await supabase
      .from('forum_notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false);

    if (error) {
      logger.error('Failed to mark all notifications as read', error, { component: 'forumApi', action: 'markAllNotificationsAsRead' });
      throw error;
    }
  } catch (error) {
    logger.error('Error in markAllNotificationsAsRead', error, { component: 'forumApi' });
    throw error;
  }
}

