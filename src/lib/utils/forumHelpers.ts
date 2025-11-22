import { logger } from '@/lib/logger';
/**
 * Forum Helper Utilities
 * Common functions for forum operations
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Check if current user can post (has approval + profile)
 */
export async function canUserPost(): Promise<{
  canPost: boolean;
  reason?: string;
  hasApproval: boolean;
  hasProfile: boolean;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        canPost: false,
        reason: 'Not authenticated',
        hasApproval: false,
        hasProfile: false,
      };
    }

    // Check approval
    const { data: approval } = await supabase
      .from('forum_user_approvals')
      .select('status')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    const hasApproval = approval?.status === 'approved';

    if (!hasApproval) {
      return {
        canPost: false,
        reason: approval?.status === 'pending' 
          ? 'Approval pending' 
          : 'Not approved',
        hasApproval: false,
        hasProfile: false,
      };
    }

    // Check profile
    const { data: profile } = await supabase
      .from('forum_user_profiles')
      .select('id')
      .eq('customer_user_id', user.id)
      .maybeSingle();

    const hasProfile = !!profile;

    if (!hasProfile) {
      return {
        canPost: false,
        reason: 'Profile not created',
        hasApproval: true,
        hasProfile: false,
      };
    }

    return {
      canPost: true,
      hasApproval: true,
      hasProfile: true,
    };
  } catch (error) {
    logger.error('Error checking if user can post', error, { component: 'forumHelpers' });
    return {
      canPost: false,
      reason: 'Error checking permissions',
      hasApproval: false,
      hasProfile: false,
    };
  }
}

/**
 * Format post score for display
 */
export function formatScore(upvotes: number, downvotes: number): {
  score: number;
  formatted: string;
  color: string;
} {
  const score = upvotes - downvotes;
  let formatted = score.toString();
  let color = 'text-muted-foreground';

  if (score > 0) {
    formatted = `+${score}`;
    color = 'text-orange-500';
  } else if (score < 0) {
    color = 'text-blue-500';
  }

  // Format large numbers
  if (Math.abs(score) >= 1000) {
    formatted = `${(score / 1000).toFixed(1)}k`;
  }

  return { score, formatted, color };
}

/**
 * Validate username
 */
export function validateUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 50) {
    return { valid: false, error: 'Username must be less than 50 characters' };
  }

  // Only alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  // Cannot start with underscore or hyphen
  if (username.startsWith('_') || username.startsWith('-')) {
    return { valid: false, error: 'Username cannot start with underscore or hyphen' };
  }

  return { valid: true };
}

/**
 * Get category color
 */
export function getCategoryColor(categorySlug: string): string {
  const colorMap: Record<string, string> = {
    general: '#10b981',
    reviews: '#f59e0b',
    growing: '#84cc16',
    strains: '#8b5cf6',
    news: '#06b6d4',
    questions: '#ef4444',
  };

  return colorMap[categorySlug] || '#10b981';
}

/**
 * Truncate text for preview
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get post age category for sorting
 */
export function getPostAge(postDate: string): 'new' | 'recent' | 'old' {
  const now = new Date();
  const post = new Date(postDate);
  const hoursAgo = (now.getTime() - post.getTime()) / (1000 * 60 * 60);

  if (hoursAgo < 24) return 'new';
  if (hoursAgo < 168) return 'recent'; // 7 days
  return 'old';
}

