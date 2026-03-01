/**
 * Promo Code Service
 * 
 * Manages promotional credit codes for marketing campaigns.
 */

import { logger } from '@/lib/logger';
import { db as sb } from '@/lib/supabaseUntyped';

// ============================================================================
// Types
// ============================================================================

export interface PromoCode {
  id: string;
  code: string;
  creditsAmount: number;
  maxUses?: number;
  usesCount: number;
  isActive: boolean;
  validFrom: Date;
  validUntil?: Date;
  description?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface PromoRedemption {
  id: string;
  promoCodeId: string;
  tenantId: string;
  creditsGranted: number;
  redeemedAt: Date;
}

export interface RedeemPromoResult {
  success: boolean;
  creditsGranted?: number;
  promoCode?: string;
  error?: string;
}

// DB row shapes for tables not in auto-generated types
interface PromoCodeRow {
  id: string;
  code: string;
  credits_amount: number;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

interface PromoRedemptionRow {
  id: string;
  promo_code_id: string;
  tenant_id: string;
  credits_granted: number;
  redeemed_at: string;
  promo_codes?: { code: string };
}


// ============================================================================
// Public Functions
// ============================================================================

/**
 * Validate a promo code
 */
export async function validatePromoCode(code: string): Promise<{
  valid: boolean;
  promoCode?: PromoCode;
  error?: string;
}> {
  try {
    const { data, error } = await sb
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, error: 'Invalid promo code' };
    }

    const promoCode = mapDbToPromoCode(data);

    // Check validity period
    if (promoCode.validFrom > new Date()) {
      return { valid: false, error: 'Promo code is not yet active' };
    }

    if (promoCode.validUntil && promoCode.validUntil < new Date()) {
      return { valid: false, error: 'Promo code has expired' };
    }

    // Check max uses
    if (promoCode.maxUses && promoCode.usesCount >= promoCode.maxUses) {
      return { valid: false, error: 'Promo code has reached max uses' };
    }

    return { valid: true, promoCode };
  } catch (error) {
    logger.error('Error validating promo code', { error, code });
    return { valid: false, error: 'Unable to validate code' };
  }
}

/**
 * Check if a tenant has already redeemed a promo code
 */
export async function hasRedeemedPromoCode(
  tenantId: string,
  promoCodeId: string
): Promise<boolean> {
  const { data } = await sb
    .from('promo_redemptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('promo_code_id', promoCodeId)
    .maybeSingle();

  return !!data;
}

/**
 * Redeem a promo code
 */
export async function redeemPromoCode(
  tenantId: string,
  code: string
): Promise<RedeemPromoResult> {
  try {
    const { data, error } = await sb
      .rpc('redeem_promo_code', {
        p_tenant_id: tenantId,
        p_code: code.toUpperCase(),
      });

    if (error) {
      logger.error('Error redeeming promo code', { error, tenantId, code });
      return { success: false, error: 'Failed to redeem code' };
    }

    const result = data as {
      success: boolean;
      error?: string;
      credits_granted?: number;
      promo_code?: string;
    };

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      creditsGranted: result.credits_granted,
      promoCode: result.promo_code,
    };
  } catch (error) {
    logger.error('Error in redeemPromoCode', { error, tenantId, code });
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get promo codes redeemed by a tenant
 */
export async function getTenantPromoRedemptions(
  tenantId: string
): Promise<PromoRedemption[]> {
  try {
    const { data, error } = await sb
      .from('promo_redemptions')
      .select(`
        id,
        promo_code_id,
        tenant_id,
        credits_granted,
        redeemed_at,
        promo_codes (
          code
        )
      `)
      .eq('tenant_id', tenantId)
      .order('redeemed_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return (data as PromoRedemptionRow[]).map((d) => ({
      id: d.id,
      promoCodeId: d.promo_code_id,
      tenantId: d.tenant_id,
      creditsGranted: d.credits_granted,
      redeemedAt: new Date(d.redeemed_at),
    }));
  } catch (error) {
    logger.error('Error getting tenant promo redemptions', { error, tenantId });
    return [];
  }
}

// ============================================================================
// Admin Functions (for creating promo codes)
// ============================================================================

/**
 * Create a new promo code (admin only)
 */
export async function createPromoCode(params: {
  code: string;
  creditsAmount: number;
  maxUses?: number;
  validFrom?: Date;
  validUntil?: Date;
  description?: string;
  createdBy?: string;
}): Promise<{ success: boolean; promoCode?: PromoCode; error?: string }> {
  try {
    const { data, error } = await sb
      .from('promo_codes')
      .insert({
        code: params.code.toUpperCase(),
        credits_amount: params.creditsAmount,
        max_uses: params.maxUses,
        valid_from: params.validFrom?.toISOString() || new Date().toISOString(),
        valid_until: params.validUntil?.toISOString(),
        description: params.description,
        created_by: params.createdBy,
        is_active: true,
        uses_count: 0,
      })
      .select()
      .maybeSingle();

    if (error) {
      logger.error('Error creating promo code', { error });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      promoCode: mapDbToPromoCode(data),
    };
  } catch (error) {
    logger.error('Error in createPromoCode', { error });
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Deactivate a promo code (admin only)
 */
export async function deactivatePromoCode(promoCodeId: string): Promise<boolean> {
  try {
    const { error } = await sb
      .from('promo_codes')
      .update({ is_active: false })
      .eq('id', promoCodeId);

    return !error;
  } catch (error) {
    logger.error('Error deactivating promo code', { error, promoCodeId });
    return false;
  }
}

/**
 * Get all promo codes (admin only)
 */
export async function getAllPromoCodes(): Promise<PromoCode[]> {
  try {
    const { data, error } = await sb
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return (data as PromoCodeRow[]).map(mapDbToPromoCode);
  } catch (error) {
    logger.error('Error getting all promo codes', { error });
    return [];
  }
}

/**
 * Get promo code stats (admin only)
 */
export async function getPromoCodeStats(promoCodeId: string): Promise<{
  totalRedemptions: number;
  totalCreditsGranted: number;
  recentRedemptions: PromoRedemption[];
}> {
  try {
    const { data, error } = await sb
      .from('promo_redemptions')
      .select('*')
      .eq('promo_code_id', promoCodeId)
      .order('redeemed_at', { ascending: false })
      .limit(10);

    if (error || !data) {
      return {
        totalRedemptions: 0,
        totalCreditsGranted: 0,
        recentRedemptions: [],
      };
    }

    const rows = data as PromoRedemptionRow[];
    const totalCreditsGranted = rows.reduce((sum, r) => sum + r.credits_granted, 0);

    return {
      totalRedemptions: rows.length,
      totalCreditsGranted,
      recentRedemptions: rows.map((d) => ({
        id: d.id,
        promoCodeId: d.promo_code_id,
        tenantId: d.tenant_id,
        creditsGranted: d.credits_granted,
        redeemedAt: new Date(d.redeemed_at),
      })),
    };
  } catch (error) {
    logger.error('Error getting promo code stats', { error, promoCodeId });
    return {
      totalRedemptions: 0,
      totalCreditsGranted: 0,
      recentRedemptions: [],
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapDbToPromoCode(data: PromoCodeRow): PromoCode {
  return {
    id: data.id,
    code: data.code,
    creditsAmount: data.credits_amount,
    maxUses: data.max_uses ?? undefined,
    usesCount: data.uses_count,
    isActive: data.is_active,
    validFrom: new Date(data.valid_from),
    validUntil: data.valid_until ? new Date(data.valid_until) : undefined,
    description: data.description ?? undefined,
    createdBy: data.created_by ?? undefined,
    createdAt: new Date(data.created_at),
  };
}
