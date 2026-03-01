/**
 * Rate Limiting Utility
 * Supports both in-memory (development) and Redis (production)
 */

interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// In-memory store for development (fallback if Redis not available)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit
 * @param config Rate limit configuration
 * @param identifier Unique identifier (user ID, IP, etc.)
 * @returns Rate limit result
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  const key = `${config.key}:${identifier}`;
  const now = Date.now();
  const resetAt = now + config.windowMs;

  // Try Redis first (if available)
  const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

  if (redisUrl && redisToken) {
    try {
      // Use Upstash Redis REST API
      const response = await fetch(`${redisUrl}/get/${encodeURIComponent(key)}`, {
        headers: {
          'Authorization': `Bearer ${redisToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const current = data.result ? parseInt(data.result) : 0;

        if (current >= config.limit) {
          // Get TTL for reset time
          const ttlResponse = await fetch(`${redisUrl}/ttl/${encodeURIComponent(key)}`, {
            headers: {
              'Authorization': `Bearer ${redisToken}`,
            },
          });
          const ttlData = await ttlResponse.json();
          const ttl = ttlData.result || config.windowMs / 1000;

          return {
            allowed: false,
            remaining: 0,
            resetAt: now + (ttl * 1000),
          };
        }

        // Increment counter
        await fetch(`${redisUrl}/incr/${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${redisToken}`,
          },
        });

        // Set expiry if first request
        if (current === 0) {
          await fetch(`${redisUrl}/expire/${encodeURIComponent(key)}/${Math.floor(config.windowMs / 1000)}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${redisToken}`,
            },
          });
        }

        return {
          allowed: true,
          remaining: config.limit - current - 1,
          resetAt: now + config.windowMs,
        };
      }
    } catch (error) {
      console.error('Redis rate limit error, falling back to memory:', error);
    }
  }

  // Fallback to in-memory store
  const stored = memoryStore.get(key);
  
  if (stored && stored.resetAt > now) {
    // Within window
    if (stored.count >= config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: stored.resetAt,
      };
    }
    
    stored.count += 1;
    return {
      allowed: true,
      remaining: config.limit - stored.count,
      resetAt: stored.resetAt,
    };
  } else {
    // New window or expired
    memoryStore.set(key, { count: 1, resetAt });
    
    // Cleanup old entries (simple cleanup)
    if (memoryStore.size > 10000) {
      for (const [k, v] of memoryStore.entries()) {
        if (v.resetAt <= now) {
          memoryStore.delete(k);
        }
      }
    }
    
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt,
    };
  }
}

/**
 * Standard rate limit configurations
 */
export const RATE_LIMITS = {
  LOGIN: { key: 'login', limit: 5, windowMs: 60 * 1000 }, // 5 per minute
  API: { key: 'api', limit: 100, windowMs: 60 * 1000 }, // 100 per minute
  ORDER_CREATE: { key: 'order_create', limit: 10, windowMs: 60 * 1000 }, // 10 per minute
  CHECKOUT_IP: { key: 'checkout_ip', limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per IP per hour
  CHECKOUT_PHONE: { key: 'checkout_phone', limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per phone per hour
  PASSWORD_RESET: { key: 'password_reset', limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  EMAIL_VERIFICATION: { key: 'email_verify', limit: 5, windowMs: 60 * 1000 }, // 5 per minute
  CREDIT_CONSUME: { key: 'credit_consume', limit: 30, windowMs: 60 * 1000 }, // 30 per minute
  CREDIT_PURCHASE: { key: 'credit_purchase', limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  FREE_CREDITS_GRANT: { key: 'free_credits', limit: 1, windowMs: 24 * 60 * 60 * 1000 }, // 1 per day
} as const;

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.remaining.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
  };
}

