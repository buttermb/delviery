/**
 * Rate Limiter Helper
 * Check and enforce rate limits for API requests
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check if a request is within rate limits
 */
export async function checkRateLimit(
  tenantId: string,
  endpoint: string
): Promise<RateLimitCheck> {
  try {
    // Get rate limit configuration
    // @ts-ignore - Table schema not in types
    const { data: rateLimit } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!rateLimit) {
      // Default limits
      return {
        allowed: true,
        remaining: 1000,
        resetAt: new Date(Date.now() + 3600000), // 1 hour
      };
    }

    // Get recent requests (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    // @ts-ignore - Table schema not in types
    const { data: recentRequests, error } = await supabase
      .from('api_logs')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('endpoint', endpoint)
      .gte('timestamp', oneHourAgo);

    if (error) {
      logger.error('Error checking rate limit', error);
      return {
        allowed: true, // Fail open
        // @ts-ignore - Rate limit fields
        remaining: rateLimit.requests_per_hour,
        resetAt: new Date(Date.now() + 3600000),
      };
    }

    const requestCount = recentRequests?.length || 0;
    // @ts-ignore - Rate limit fields
    const allowed = requestCount < rateLimit.requests_per_hour;
    // @ts-ignore - Rate limit fields
    const remaining = Math.max(0, rateLimit.requests_per_hour - requestCount);

    // Check for custom endpoint limits
    // @ts-ignore - Rate limit fields
    if (rateLimit.custom_limits && rateLimit.custom_limits[endpoint]) {
      // @ts-ignore - Rate limit fields
      const customLimit = rateLimit.custom_limits[endpoint];
      const customAllowed = requestCount < customLimit;
      return {
        allowed: customAllowed,
        remaining: Math.max(0, customLimit - requestCount),
        resetAt: new Date(Date.now() + 3600000),
      };
    }

    return {
      allowed,
      remaining,
      resetAt: new Date(Date.now() + 3600000),
    };
  } catch (error) {
    logger.error('Error in checkRateLimit', error);
    // Fail open
    return {
      allowed: true,
      remaining: 1000,
      resetAt: new Date(Date.now() + 3600000),
    };
  }
}

/**
 * Record a rate limit violation
 */
export async function recordRateLimitViolation(
  tenantId: string,
  endpoint: string,
  violationType: 'hourly' | 'daily' | 'monthly'
): Promise<void> {
  try {
    // @ts-ignore - Table schema not in types
    await supabase.from('rate_limit_violations').insert({
      tenant_id: tenantId,
      endpoint,
      violation_type: violationType,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error recording rate limit violation', error);
  }
}

