/**
 * Referral Credits Service
 * 
 * Manages referral codes, redemption, and tracking.
 * Users earn credits for referring others.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Cast for tables not in auto-generated types
const sb = supabase;

// ============================================================================
// Types
// ============================================================================

export interface ReferralCode {
  id: string;
  tenantId: string;
  code: string;
  referrerBonus: number;
  refereeBonus: number;
  paidConversionBonus: number;
  maxUses?: number;
  usesCount: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ReferralRedemption {
  id: string;
  referralCodeId: string;
  referrerTenantId: string;
  refereeTenantId: string;
  referrerCreditsGranted: number;
  refereeCreditsGranted: number;
  conversionBonusGranted: boolean;
  redeemedAt: Date;
}

export interface ReferralStats {
  totalReferrals: number;
  totalCreditsEarned: number;
  pendingConversions: number;
  conversionRate: number;
  recentReferrals: Array<{
    id: string;
    refereeName?: string;
    creditsEarned: number;
    converted: boolean;
    date: Date;
  }>;
}

export interface RedeemResult {
  success: boolean;
  creditsGranted?: number;
  referrerCredits?: number;
  error?: string;
}

// ============================================================================
// Default Rewards Configuration
// ============================================================================

export const REFERRAL_REWARDS = {
  referrerBonus: 2500,     // Referrer gets 2,500 credits
  refereeBonus: 2500,      // New user gets 2,500 bonus credits
  paidConversionBonus: 5000, // Extra if referee upgrades to paid
} as const;

// ============================================================================
// Referral Code Functions
// ============================================================================

/**
 * Get or create a referral code for a tenant
 */
export async function getOrCreateReferralCode(tenantId: string): Promise<ReferralCode | null> {
  try {
    // Check for existing code
    const { data: existing } = await sb
      .from('referral_codes')
      .select('id, tenant_id, code, referrer_bonus, referee_bonus, paid_conversion_bonus, max_uses, uses_count, is_active, expires_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();
    if (existing) {
      return mapDbToReferralCode(existing);
    }

    // Create new code using DB function
    const { data: newCode, error: createError } = await sb
      .rpc('generate_referral_code', { p_tenant_id: tenantId });

    if (createError) {
      logger.error('Failed to generate referral code', { createError, tenantId });
      return null;
    }

    // Fetch the created code
    const { data: created, error: refetchError } = await sb
      .from('referral_codes')
      .select('id, tenant_id, code, referrer_bonus, referee_bonus, paid_conversion_bonus, max_uses, uses_count, is_active, expires_at, created_at')
      .eq('code', newCode)
      .maybeSingle();

    if (refetchError || !created) {
      logger.error('Failed to fetch created referral code', { refetchError });
      return null;
    }

    return mapDbToReferralCode(created);
  } catch (error) {
    logger.error('Error in getOrCreateReferralCode', { error, tenantId });
    return null;
  }
}

/**
 * Get a tenant's referral code
 */
export async function getReferralCode(tenantId: string): Promise<ReferralCode | null> {
  try {
    const { data, error } = await sb
      .from('referral_codes')
      .select('id, tenant_id, code, referrer_bonus, referee_bonus, paid_conversion_bonus, max_uses, uses_count, is_active, expires_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapDbToReferralCode(data);
  } catch (error) {
    logger.error('Error getting referral code', { error, tenantId });
    return null;
  }
}

/**
 * Validate a referral code
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  code?: ReferralCode;
  error?: string;
}> {
  try {
    const { data, error } = await sb
      .from('referral_codes')
      .select('id, tenant_id, code, referrer_bonus, referee_bonus, paid_conversion_bonus, max_uses, uses_count, is_active, expires_at, created_at')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, error: 'Invalid referral code' };
    }

    const referralCode = mapDbToReferralCode(data);

    // Check expiration
    if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
      return { valid: false, error: 'Referral code has expired' };
    }

    // Check max uses
    if (referralCode.maxUses && referralCode.usesCount >= referralCode.maxUses) {
      return { valid: false, error: 'Referral code has reached max uses' };
    }

    return { valid: true, code: referralCode };
  } catch (error) {
    logger.error('Error validating referral code', { error, code });
    return { valid: false, error: 'Unable to validate code' };
  }
}

/**
 * Redeem a referral code
 */
export async function redeemReferralCode(
  refereeTenantId: string,
  code: string
): Promise<RedeemResult> {
  try {
    const { data, error } = await sb
      .rpc('redeem_referral_code', {
        p_referee_tenant_id: refereeTenantId,
        p_code: code.toUpperCase(),
      });

    if (error) {
      logger.error('Error redeeming referral code', { error, refereeTenantId, code });
      return { success: false, error: 'Failed to redeem code' };
    }

    const result = data as {
      success: boolean;
      error?: string;
      credits_granted?: number;
      referrer_credits?: number;
    };

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      creditsGranted: result.credits_granted,
      referrerCredits: result.referrer_credits,
    };
  } catch (error) {
    logger.error('Error in redeemReferralCode', { error, refereeTenantId, code });
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// Referral Stats Functions
// ============================================================================

/**
 * Get referral statistics for a tenant
 */
export async function getReferralStats(tenantId: string): Promise<ReferralStats> {
  try {
    // Get referral code
    const code = await getReferralCode(tenantId);

    if (!code) {
      return {
        totalReferrals: 0,
        totalCreditsEarned: 0,
        pendingConversions: 0,
        conversionRate: 0,
        recentReferrals: [],
      };
    }

    // Get redemptions
    const { data: redemptions, error } = await sb
      .from('referral_redemptions')
      .select(`
        id,
        referrer_credits_granted,
        conversion_bonus_granted,
        redeemed_at,
        referee_tenant_id
      `)
      .eq('referrer_tenant_id', tenantId)
      .order('redeemed_at', { ascending: false })
      .limit(20);

    if (error) {
      logger.error('Error fetching referral redemptions', { error, tenantId });
      return {
        totalReferrals: code.usesCount,
        totalCreditsEarned: 0,
        pendingConversions: 0,
        conversionRate: 0,
        recentReferrals: [],
      };
    }

    const totalCreditsEarned = (redemptions ?? []).reduce(
      (sum, r) => sum + (r.referrer_credits_granted ?? 0) +
        (r.conversion_bonus_granted ? REFERRAL_REWARDS.paidConversionBonus : 0),
      0
    );

    const converted = (redemptions ?? []).filter(r => r.conversion_bonus_granted).length;
    const pending = (redemptions ?? []).filter(r => !r.conversion_bonus_granted).length;

    return {
      totalReferrals: code.usesCount,
      totalCreditsEarned,
      pendingConversions: pending,
      conversionRate: code.usesCount > 0 ? (converted / code.usesCount) * 100 : 0,
      recentReferrals: (redemptions ?? []).map(r => ({
        id: r.id,
        creditsEarned: r.referrer_credits_granted + 
          (r.conversion_bonus_granted ? REFERRAL_REWARDS.paidConversionBonus : 0),
        converted: r.conversion_bonus_granted,
        date: new Date(r.redeemed_at),
      })),
    };
  } catch (error) {
    logger.error('Error getting referral stats', { error, tenantId });
    return {
      totalReferrals: 0,
      totalCreditsEarned: 0,
      pendingConversions: 0,
      conversionRate: 0,
      recentReferrals: [],
    };
  }
}

/**
 * Get referral leaderboard (for gamification)
 */
export async function getReferralLeaderboard(
  limit: number = 10
): Promise<Array<{ tenantId: string; referralCount: number }>> {
  try {
    const { data, error } = await sb
      .from('referral_codes')
      .select('tenant_id, uses_count')
      .order('uses_count', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(d => ({
      tenantId: d.tenant_id,
      referralCount: d.uses_count,
    }));
  } catch (error) {
    logger.error('Error getting referral leaderboard', { error });
    return [];
  }
}

// ============================================================================
// Conversion Tracking
// ============================================================================

/**
 * Grant conversion bonus when a referred user upgrades to paid
 * Called when a tenant subscribes
 */
export async function grantConversionBonus(
  convertedTenantId: string
): Promise<{ success: boolean; bonusGranted?: number }> {
  try {
    // Find the referral redemption for this tenant
    const { data: redemption, error: findError } = await sb
      .from('referral_redemptions')
      .select('id, referrer_tenant_id, conversion_bonus_granted')
      .eq('referee_tenant_id', convertedTenantId)
      .eq('conversion_bonus_granted', false)
      .maybeSingle();

    if (findError || !redemption) {
      // No pending conversion bonus
      return { success: true };
    }

    // Grant bonus to referrer
    const { error: updateCreditsError } = await sb.rpc('purchase_credits', {
      p_tenant_id: redemption.referrer_tenant_id,
      p_amount: REFERRAL_REWARDS.paidConversionBonus,
      p_transaction_type: 'bonus',
      p_description: 'Referral conversion bonus - referred user upgraded',
    });

    if (updateCreditsError) {
      logger.error('Failed to grant conversion bonus', { updateCreditsError });
      return { success: false };
    }

    // Mark conversion as granted
    await sb
      .from('referral_redemptions')
      .update({ conversion_bonus_granted: true })
      .eq('id', redemption.id);

    // Create notification for referrer
    await sb
      .from('notifications')
      .insert({
        tenant_id: redemption.referrer_tenant_id,
        type: 'system',
        title: '🎉 Referral Bonus!',
        message: `Your referral upgraded to a paid plan! You earned ${REFERRAL_REWARDS.paidConversionBonus.toLocaleString()} bonus credits.`,
        metadata: {
          referral_conversion: true,
          credits_earned: REFERRAL_REWARDS.paidConversionBonus,
        },
      });

    logger.info('Conversion bonus granted', {
      referrerTenantId: redemption.referrer_tenant_id,
      convertedTenantId,
      bonus: REFERRAL_REWARDS.paidConversionBonus,
    });

    return { success: true, bonusGranted: REFERRAL_REWARDS.paidConversionBonus };
  } catch (error) {
    logger.error('Error granting conversion bonus', { error, convertedTenantId });
    return { success: false };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapDbToReferralCode(data: Record<string, unknown>): ReferralCode {
  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    code: data.code as string,
    referrerBonus: data.referrer_bonus as number,
    refereeBonus: data.referee_bonus as number,
    paidConversionBonus: data.paid_conversion_bonus as number,
    maxUses: data.max_uses as number | undefined,
    usesCount: data.uses_count as number,
    isActive: data.is_active as boolean,
    expiresAt: data.expires_at ? new Date(data.expires_at as string) : undefined,
    createdAt: new Date(data.created_at as string),
  };
}

/**
 * Generate a shareable referral link
 */
export function getReferralLink(code: string, baseUrl?: string): string {
  const url = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${url}/signup?ref=${code}`;
}

/**
 * Copy referral link to clipboard
 */
export async function copyReferralLink(code: string): Promise<boolean> {
  try {
    const link = getReferralLink(code);
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}







