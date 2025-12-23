/**
 * Rate Limiting Configuration and Utilities
 * Critical Fix #18: Rate Limiting Enforcement
 */

import { supabase } from '@/integrations/supabase/client';

// Rate limits by subscription tier (per 24 hours)
export const RATE_LIMITS = {
  free: {
    menu_create: 1,
    order_create: 10,
    sms_send: 0,
    export: 3,
  },
  starter: {
    menu_create: 50,
    order_create: 500,
    sms_send: 100,
    export: 10,
  },
  professional: {
    menu_create: 500,
    order_create: 5000,
    sms_send: 1000,
    export: 100,
  },
  enterprise: {
    menu_create: Infinity,
    order_create: Infinity,
    sms_send: Infinity,
    export: Infinity,
  },
} as const;

export type ActionType = keyof typeof RATE_LIMITS.free;
export type SubscriptionTier = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt?: string;
}

/**
 * Check rate limit for an action
 */
export async function checkRateLimit(
  tenantId: string,
  actionType: ActionType,
  tier: SubscriptionTier = 'free'
): Promise<RateLimitResult> {
  const limit = RATE_LIMITS[tier][actionType];
  
  // Unlimited for enterprise
  if (limit === Infinity) {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
  }

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_tenant_id: tenantId,
    p_action_type: actionType,
    p_limit: limit,
    p_window_hours: 24,
  });

  if (error) {
    console.error('[RATE_LIMIT] Check failed:', error);
    // Fail open - allow action if check fails
    return { allowed: true, used: 0, limit, remaining: limit };
  }

  return data as RateLimitResult;
}

/**
 * Log action and enforce rate limit atomically
 */
export async function logActionWithLimit(
  tenantId: string,
  userId: string | null,
  actionType: ActionType,
  tier: SubscriptionTier = 'free',
  metadata: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string; limit?: RateLimitResult }> {
  const limit = RATE_LIMITS[tier][actionType];
  
  // Unlimited for enterprise - just log, don't check
  if (limit === Infinity) {
    await supabase.from('action_log').insert({
      tenant_id: tenantId,
      user_id: userId,
      action_type: actionType,
      metadata,
    });
    return { success: true };
  }

  const { data, error } = await supabase.rpc('log_action_with_limit', {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_action_type: actionType,
    p_limit: limit,
    p_window_hours: 24,
    p_metadata: metadata,
  });

  if (error) {
    console.error('[RATE_LIMIT] Log failed:', error);
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; error?: string; limit?: RateLimitResult };
  return result;
}

/**
 * Get tier from tenant data
 */
export function getTierFromTenant(tenant: {
  subscription_plan?: string | null;
  is_free_tier?: boolean;
}): SubscriptionTier {
  if (tenant.is_free_tier) return 'free';
  
  const plan = tenant.subscription_plan?.toLowerCase() || '';
  if (plan.includes('enterprise')) return 'enterprise';
  if (plan.includes('professional') || plan.includes('pro')) return 'professional';
  if (plan.includes('starter')) return 'starter';
  
  return 'free';
}
