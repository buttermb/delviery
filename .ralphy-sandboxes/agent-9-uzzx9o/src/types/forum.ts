/**
 * Forum Community Types
 * Type definitions for the FloraIQ Community Forum
 */

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  member_count: number;
  post_count: number;
  display_order: number;
  created_at: string;
}

export interface ForumUserProfile {
  id: string;
  customer_user_id: string;
  tenant_id: string | null;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  status: 'active' | 'suspended' | 'banned';
  created_at: string;
  updated_at: string;
}

export interface ForumUserApproval {
  id: string;
  customer_user_id: string;
  tenant_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  auto_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  request_message: string | null;
  requested_at: string;
  created_at: string;
  updated_at: string;
}

export interface ForumPost {
  id: string;
  category_id: string | null;
  author_id: string | null;
  tenant_id: string | null;
  title: string;
  content: string | null;
  content_type: 'text' | 'link' | 'product';
  link_url: string | null;
  linked_listing_id: string | null;
  images: string[];
  upvote_count: number;
  downvote_count: number;
  comment_count: number;
  view_count: number;
  is_pinned: boolean;
  is_removed: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  category?: ForumCategory;
  author?: ForumUserProfile & {
    customer_user?: {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
    };
  };
  linked_listing?: {
    id: string;
    product_name: string;
    base_price: number;
    images: string[];
    description: string | null;
    marketplace_profiles?: {
      business_name: string;
      verified_badge: boolean;
    };
  };
}

export interface ForumComment {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_id: string | null;
  content: string;
  upvote_count: number;
  downvote_count: number;
  depth: number;
  is_removed: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  author?: ForumUserProfile & {
    customer_user?: {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
    };
  };
}

export interface ForumVote {
  id: string;
  user_id: string;
  votable_type: 'post' | 'comment';
  votable_id: string;
  vote: 1 | -1;
  created_at: string;
}

export interface UserReputation {
  user_id: string;
  post_karma: number;
  comment_karma: number;
  total_karma: number;
  posts_created: number;
  comments_created: number;
  updated_at: string;
}

export interface ForumNotification {
  id: string;
  user_id: string;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  actor_id: string | null;
  title: string;
  message: string | null;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

// API Request/Response Types
export interface CreatePostRequest {
  category_id: string;
  title: string;
  content?: string;
  content_type: 'text' | 'link' | 'product';
  link_url?: string;
  linked_listing_id?: string;
  images?: string[];
}

export interface CreateCommentRequest {
  post_id: string;
  parent_comment_id?: string;
  content: string;
  depth?: number;
}

export interface VoteRequest {
  votable_type: 'post' | 'comment';
  votable_id: string;
  vote: 1 | -1;
}

export interface CreateForumProfileRequest {
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

export interface RequestForumApprovalRequest {
  request_message?: string;
}

export interface GetPostsOptions {
  categoryId?: string;
  sortBy?: 'hot' | 'new' | 'top';
  limit?: number;
  offset?: number;
}

