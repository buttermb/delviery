/**
 * Signup Protection Service
 * 
 * Handles anti-abuse measures for signup including:
 * - Device fingerprinting
 * - IP tracking
 * - Email domain validation
 * - Signup eligibility checks
 */

import { supabase } from '@/integrations/supabase/client';
import { generateFingerprint, getQuickFingerprint } from '@/lib/fingerprint';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface SignupEligibilityResult {
  allowed: boolean;
  riskScore: number;
  requiresPhoneVerification: boolean;
  blockReason?: string;
  warnings: string[];
}

export interface RecordFingerprintResult {
  success: boolean;
  fingerprintId?: string;
  error?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Hash a string using SHA-256
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get client's IP address via a lightweight API
 */
async function getClientIp(): Promise<string | null> {
  try {
    // Try to get IP from Cloudflare headers or similar
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      cache: 'no-store',
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.ip || null;
    }
  } catch (error: unknown) {
    logger.warn('Failed to get client IP', error as Error);
  }
  return null;
}

/**
 * Check if email domain is disposable/temporary
 */
function isDisposableEmailDomain(email: string): boolean {
  const disposableDomains = [
    'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'getnada.com',
    'maildrop.cc', 'tmpmail.net', 'yopmail.com', 'dispostable.com',
    'tempr.email', 'fakemailgenerator.com', 'mohmal.com', 'emailondeck.com',
    'trashmail.com', 'guerrillamail.net', 'sharklasers.com', 'spam4.me',
    'grr.la', 'spambog.com', 'temp.email', 'throwawaymail.com',
  ];

  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? disposableDomains.includes(domain) : false;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Check if a signup attempt should be allowed
 * Performs anti-abuse checks including fingerprint, IP, and email validation
 */
export async function checkSignupEligibility(
  email: string,
  _phoneHash?: string
): Promise<SignupEligibilityResult> {
  const warnings: string[] = [];
  let riskScore = 0;
  let requiresPhoneVerification = false;
  const blockReason: string | undefined = undefined;

  try {
    // 1. Check email domain
    if (isDisposableEmailDomain(email)) {
      riskScore += 50;
      warnings.push('Disposable email domain detected');
      requiresPhoneVerification = true;
    }

    // 2. Generate fingerprint
    const fingerprint = await generateFingerprint();

    // 3. Additional client-side checks
    
    // Check fingerprint confidence
    if (fingerprint.confidence < 30) {
      riskScore += 20;
      warnings.push('Low fingerprint confidence');
    }

    // Check for common VPN indicators
    if (fingerprint.components.timezone === 'UTC' && 
        fingerprint.components.language !== 'en-GB') {
      riskScore += 10;
      warnings.push('Possible VPN detected');
    }

    // Determine final result
    const allowed = !blockReason && riskScore < 100;

    if (riskScore >= 50 && riskScore < 100) {
      requiresPhoneVerification = true;
    }

    return {
      allowed,
      riskScore,
      requiresPhoneVerification,
      blockReason,
      warnings,
    };

  } catch (error: unknown) {
    logger.error('Signup eligibility check failed', error as Error);
    // Allow signup on error
    return {
      allowed: true,
      riskScore: 0,
      requiresPhoneVerification: false,
      warnings: ['Eligibility check error, proceeding with signup'],
    };
  }
}

/**
 * Record device fingerprint after successful signup
 */
export async function recordSignupFingerprint(
  tenantId: string,
  _phoneHash?: string
): Promise<RecordFingerprintResult> {
  try {
    // Generate fingerprint
    const fingerprint = await generateFingerprint();
    const fingerprintHash = fingerprint.hash;

    // Get client IP
    const clientIp = await getClientIp();
    const ipHash = clientIp ? await hashString(clientIp) : null;

    // Store fingerprint data in tenant metadata or audit log
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        entity_type: 'signup',
        entity_id: tenantId,
        action: 'fingerprint_recorded',
        tenant_id: tenantId,
        details: {
          fingerprint_hash: fingerprintHash,
          ip_hash: ipHash,
          user_agent: navigator.userAgent,
          screen_resolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

    if (error) {
      logger.error('Failed to record signup fingerprint', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      fingerprintId: fingerprintHash,
    };

  } catch (error: unknown) {
    logger.error('Failed to record fingerprint', error as Error);
    return { success: false, error: 'Failed to record fingerprint' };
  }
}

/**
 * Quick fingerprint check (for rate limiting)
 */
export async function getQuickSignupFingerprint(): Promise<string> {
  try {
    return await getQuickFingerprint();
  } catch {
    // Return a timestamp-based fallback
    return `fallback-${Date.now()}`;
  }
}

/**
 * Update tenant with signup protection data
 */
export async function updateTenantSignupProtection(
  tenantId: string,
  riskScore: number,
  phoneVerified: boolean,
  fingerprintId?: string
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = {
      signup_risk_score: riskScore,
      phone_verified: phoneVerified,
    };

    if (fingerprintId) {
      updateData.signup_fingerprint_id = fingerprintId;
    }

    if (riskScore >= 50) {
      updateData.is_suspicious = true;
    }

    const { error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId);

    if (error) {
      logger.error('Failed to update tenant protection data', error);
    }
  } catch (error: unknown) {
    logger.error('Failed to update tenant protection', error as Error);
  }
}

// ============================================================================
// Export
// ============================================================================

export const signupProtection = {
  checkEligibility: checkSignupEligibility,
  recordFingerprint: recordSignupFingerprint,
  getQuickFingerprint: getQuickSignupFingerprint,
  updateTenantProtection: updateTenantSignupProtection,
  isDisposableEmail: isDisposableEmailDomain,
};

export default signupProtection;
