/**
 * Brute Force Protection Utility
 *
 * Checks if an IP is blocked due to too many failed login attempts (10+ in 1 hour)
 * across any account. Uses the auth_audit_log table and ip_allowlist for bypass.
 *
 * Returns a generic error message that does not reveal whether the IP is blocked
 * to prevent information leakage to attackers.
 */

import { createClient } from './deps.ts';

interface BruteForceCheckResult {
  blocked: boolean;
  allowlisted: boolean;
  failedAttempts: number;
}

interface LogAuthEventParams {
  eventType: string;
  ipAddress: string;
  email?: string;
  success: boolean;
  failureReason?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Extract client IP from request headers
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Check if an IP is blocked due to brute force attempts.
 * Uses the check_ip_brute_force RPC which checks auth_audit_log for
 * 10+ failed attempts in the last hour, with IP allowlist bypass.
 */
export async function checkBruteForce(
  ipAddress: string
): Promise<BruteForceCheckResult> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('check_ip_brute_force', {
    p_ip_address: ipAddress,
  });

  if (error) {
    // On error, fail open but log it (don't block legitimate users due to DB issues)
    console.error('[BRUTE_FORCE] Error checking IP block status:', error);
    return { blocked: false, allowlisted: false, failedAttempts: 0 };
  }

  return {
    blocked: data?.blocked ?? false,
    allowlisted: data?.allowlisted ?? false,
    failedAttempts: data?.failed_attempts ?? 0,
  };
}

/**
 * Log an authentication event to the auth_audit_log table.
 * Used for both successful and failed login attempts.
 */
export async function logAuthEvent(params: LogAuthEventParams): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error } = await supabase.rpc('log_auth_audit_event', {
    p_event_type: params.eventType,
    p_ip_address: params.ipAddress,
    p_email: params.email ?? null,
    p_success: params.success,
    p_failure_reason: params.failureReason ?? null,
    p_user_agent: params.userAgent ?? null,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    console.error('[BRUTE_FORCE] Error logging auth event:', error);
  }
}

/**
 * Generic error response for blocked IPs.
 * IMPORTANT: This intentionally does NOT reveal that the IP is blocked.
 * It returns the same error message as a normal credential failure to
 * prevent attackers from learning about the blocking mechanism.
 */
export const GENERIC_AUTH_ERROR = 'Invalid credentials';
export const GENERIC_AUTH_DETAIL = 'Email or password is incorrect. Please try again.';
