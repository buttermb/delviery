/**
 * Rate Limiting System
 * Client-side rate limiting with server verification
 * Integrates with subscription tiers and credit system
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES & CONFIGURATION
// ============================================================================

export type ActionType =
  | 'menu_create'
  | 'order_create'
  | 'sms_send'
  | 'export'
  | 'api_call'
  | 'file_upload'
  | 'barcode_generate'
  | 'report_generate'
  | 'bulk_import'
  | 'email_send';

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise';

// Rate limits per action per 24 hours by subscription tier
export const RATE_LIMITS: Record<SubscriptionTier, Record<ActionType, number>> = {
  free: {
    menu_create: 3,
    order_create: 25,
    sms_send: 0,
    export: 3,
    api_call: 100,
    file_upload: 10,
    barcode_generate: 20,
    report_generate: 3,
    bulk_import: 1,
    email_send: 10,
  },
  starter: {
    menu_create: 50,
    order_create: 500,
    sms_send: 100,
    export: 25,
    api_call: 1000,
    file_upload: 100,
    barcode_generate: 200,
    report_generate: 25,
    bulk_import: 5,
    email_send: 100,
  },
  professional: {
    menu_create: 500,
    order_create: 5000,
    sms_send: 1000,
    export: 100,
    api_call: 10000,
    file_upload: 500,
    barcode_generate: 2000,
    report_generate: 100,
    bulk_import: 25,
    email_send: 500,
  },
  enterprise: {
    menu_create: Infinity,
    order_create: Infinity,
    sms_send: Infinity,
    export: Infinity,
    api_call: Infinity,
    file_upload: Infinity,
    barcode_generate: Infinity,
    report_generate: Infinity,
    bulk_import: Infinity,
    email_send: Infinity,
  },
};

// Burst limits (per minute) to prevent abuse spikes
export const BURST_LIMITS: Partial<Record<ActionType, number>> = {
  api_call: 60,
  order_create: 10,
  sms_send: 5,
  email_send: 10,
  barcode_generate: 30,
};

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until retry
  reason?: string;
}

export interface RateLimitState {
  count: number;
  windowStart: number;
  burstCount: number;
  burstWindowStart: number;
}

// ============================================================================
// LOCAL CACHE (Client-side rate tracking)
// ============================================================================

const localCache = new Map<string, RateLimitState>();
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const BURST_WINDOW_MS = 60 * 1000; // 1 minute

function getCacheKey(tenantId: string, actionType: ActionType): string {
  return `${tenantId}:${actionType}`;
}

function getLocalState(tenantId: string, actionType: ActionType): RateLimitState {
  const key = getCacheKey(tenantId, actionType);
  const now = Date.now();

  let state = localCache.get(key);

  if (!state) {
    state = {
      count: 0,
      windowStart: now,
      burstCount: 0,
      burstWindowStart: now,
    };
    localCache.set(key, state);
  }

  // Reset windows if expired
  if (now - state.windowStart > WINDOW_MS) {
    state.count = 0;
    state.windowStart = now;
  }

  if (now - state.burstWindowStart > BURST_WINDOW_MS) {
    state.burstCount = 0;
    state.burstWindowStart = now;
  }

  return state;
}

function incrementLocalState(tenantId: string, actionType: ActionType): void {
  const state = getLocalState(tenantId, actionType);
  state.count++;
  state.burstCount++;
}

// ============================================================================
// RATE LIMIT CHECKING
// ============================================================================

/**
 * Check if an action is allowed under rate limits
 * Uses local cache for speed, with optional server verification
 */
export async function checkRateLimit(
  tenantId: string,
  actionType: ActionType,
  tier: SubscriptionTier = 'free',
  options: { verifyServer?: boolean } = {}
): Promise<RateLimitResult> {
  const limit = RATE_LIMITS[tier][actionType];
  const burstLimit = BURST_LIMITS[actionType];
  const now = Date.now();

  // Enterprise has no limits
  if (limit === Infinity) {
    return {
      allowed: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      resetAt: new Date(now + WINDOW_MS),
    };
  }

  // Check local state first (fast)
  const localState = getLocalState(tenantId, actionType);

  // Check burst limit
  if (burstLimit && localState.burstCount >= burstLimit) {
    const retryAfter = Math.ceil((BURST_WINDOW_MS - (now - localState.burstWindowStart)) / 1000);
    return {
      allowed: false,
      used: localState.count,
      limit,
      remaining: Math.max(0, limit - localState.count),
      resetAt: new Date(localState.windowStart + WINDOW_MS),
      retryAfter,
      reason: `Burst limit exceeded. Try again in ${retryAfter} seconds.`,
    };
  }

  // Check daily limit
  if (localState.count >= limit) {
    const resetAt = new Date(localState.windowStart + WINDOW_MS);
    return {
      allowed: false,
      used: localState.count,
      limit,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil((resetAt.getTime() - now) / 1000),
      reason: `Daily limit of ${limit} ${actionType.replace('_', ' ')}s reached.`,
    };
  }

  // Optionally verify with server for critical actions
  if (options.verifyServer) {
    try {
      const serverResult = await verifyWithServer(tenantId, actionType, limit);
      if (!serverResult.allowed) {
        // Update local cache to match server
        localState.count = serverResult.used;
        return serverResult;
      }
    } catch (error) {
      // Fail open on server error, but log it
      logger.warn('Rate limit server check failed, using local cache', { error, tenantId, actionType });
    }
  }

  return {
    allowed: true,
    used: localState.count,
    limit,
    remaining: limit - localState.count,
    resetAt: new Date(localState.windowStart + WINDOW_MS),
  };
}

/**
 * Record that an action was taken (increment counter)
 */
export async function recordAction(
  tenantId: string,
  actionType: ActionType,
  options: { syncServer?: boolean } = {}
): Promise<void> {
  incrementLocalState(tenantId, actionType);

  if (options.syncServer) {
    try {
      await supabase.rpc('increment_rate_limit', {
        p_tenant_id: tenantId,
        p_action_type: actionType,
      });
    } catch (error) {
      logger.warn('Failed to sync rate limit to server', { error, tenantId, actionType });
    }
  }
}

/**
 * Check and record in one operation
 */
export async function checkAndRecord(
  tenantId: string,
  actionType: ActionType,
  tier: SubscriptionTier = 'free',
  options: { verifyServer?: boolean; syncServer?: boolean } = {}
): Promise<RateLimitResult> {
  const result = await checkRateLimit(tenantId, actionType, tier, options);

  if (result.allowed) {
    await recordAction(tenantId, actionType, options);
    result.used++;
    result.remaining--;
  }

  return result;
}

// ============================================================================
// SERVER VERIFICATION
// ============================================================================

async function verifyWithServer(
  tenantId: string,
  actionType: ActionType,
  limit: number
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_tenant_id: tenantId,
    p_action_type: actionType,
    p_limit: limit,
    p_window_hours: 24,
  });

  if (error) {
    throw error;
  }

  return data as RateLimitResult;
}

// ============================================================================
// RATE LIMIT HEADERS (for API responses)
// ============================================================================

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

export function getRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': result.limit === Infinity ? 'unlimited' : String(result.limit),
    'X-RateLimit-Remaining': result.remaining === Infinity ? 'unlimited' : String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current usage for display in UI
 */
export function getUsageStats(
  tenantId: string,
  tier: SubscriptionTier = 'free'
): Record<ActionType, { used: number; limit: number; percentage: number }> {
  const stats: Record<string, { used: number; limit: number; percentage: number }> = {};

  for (const actionType of Object.keys(RATE_LIMITS.free) as ActionType[]) {
    const limit = RATE_LIMITS[tier][actionType];
    const state = getLocalState(tenantId, actionType);

    stats[actionType] = {
      used: state.count,
      limit: limit === Infinity ? -1 : limit,
      percentage: limit === Infinity ? 0 : Math.round((state.count / limit) * 100),
    };
  }

  return stats as Record<ActionType, { used: number; limit: number; percentage: number }>;
}

/**
 * Clear local rate limit cache (for testing or logout)
 */
export function clearRateLimitCache(tenantId?: string): void {
  if (tenantId) {
    // Clear specific tenant
    for (const key of localCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        localCache.delete(key);
      }
    }
  } else {
    // Clear all
    localCache.clear();
  }
}

/**
 * Pre-check if action would be allowed without recording
 */
export function wouldBeAllowed(
  tenantId: string,
  actionType: ActionType,
  tier: SubscriptionTier = 'free'
): boolean {
  const limit = RATE_LIMITS[tier][actionType];
  if (limit === Infinity) return true;

  const state = getLocalState(tenantId, actionType);
  return state.count < limit;
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useCallback, useEffect } from 'react';

interface UseRateLimitOptions {
  tenantId: string;
  actionType: ActionType;
  tier?: SubscriptionTier;
  autoRefresh?: boolean;
}

interface UseRateLimitReturn {
  canPerform: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date | null;
  check: () => Promise<RateLimitResult>;
  record: () => Promise<void>;
  checkAndRecord: () => Promise<RateLimitResult>;
}

export function useRateLimit({
  tenantId,
  actionType,
  tier = 'free',
  autoRefresh = true,
}: UseRateLimitOptions): UseRateLimitReturn {
  const [state, setState] = useState<{
    canPerform: boolean;
    used: number;
    limit: number;
    remaining: number;
    resetAt: Date | null;
  }>({
    canPerform: true,
    used: 0,
    limit: RATE_LIMITS[tier][actionType],
    remaining: RATE_LIMITS[tier][actionType],
    resetAt: null,
  });

  const updateState = useCallback(async () => {
    const result = await checkRateLimit(tenantId, actionType, tier);
    setState({
      canPerform: result.allowed,
      used: result.used,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
    });
  }, [tenantId, actionType, tier]);

  useEffect(() => {
    updateState();

    if (autoRefresh) {
      const interval = setInterval(updateState, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [updateState, autoRefresh]);

  const check = useCallback(async () => {
    const result = await checkRateLimit(tenantId, actionType, tier);
    setState({
      canPerform: result.allowed,
      used: result.used,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
    });
    return result;
  }, [tenantId, actionType, tier]);

  const record = useCallback(async () => {
    await recordAction(tenantId, actionType);
    await updateState();
  }, [tenantId, actionType, updateState]);

  const checkAndRecordFn = useCallback(async () => {
    const result = await checkAndRecord(tenantId, actionType, tier);
    setState({
      canPerform: result.allowed,
      used: result.used,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
    });
    return result;
  }, [tenantId, actionType, tier]);

  return {
    ...state,
    check,
    record,
    checkAndRecord: checkAndRecordFn,
  };
}
