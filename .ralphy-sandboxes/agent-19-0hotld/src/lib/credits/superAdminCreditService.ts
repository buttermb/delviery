/**
 * Super Admin Credit Service
 * 
 * Provides functions for super admins to manage and monitor
 * the credit system across all tenants.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Cast for tables not in auto-generated types
const sb = supabase as unknown as Record<string, (...args: unknown[]) => unknown> & typeof supabase;

// ============================================================================
// DB Row Shapes (not in generated types — used for RPC/query results)
// ============================================================================

interface TenantCreditRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  balance: number;
  tier_status: string;
  is_free_tier: boolean;
  credits_used_today: number;
  credits_used_this_week: number;
  credits_used_this_month: number;
  lifetime_spent: number;
  last_activity: string | null;
  created_at: string;
  credit_status: string;
}

interface CreditTransactionRow {
  id: string;
  tenant_id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  action_type?: string;
  reference_id?: string;
  reference_type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  tenants?: { business_name: string; slug: string };
}

interface CreditGrantRow {
  id: string;
  tenant_id: string;
  amount: number;
  grant_type: string;
  promo_code?: string;
  expires_at?: string;
  granted_at: string;
  granted_by?: string;
  is_used: boolean;
  notes?: string;
}

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
  tenant_id: string;
  credits_granted: number;
  redeemed_at: string;
  tenants?: { business_name: string };
}

interface CreditPackageRow {
  id: string;
  name: string;
  slug: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  is_active: boolean;
  sort_order: number;
  badge: string | null;
  description: string | null;
}

interface ReferralCodeRow {
  tenant_id: string;
  uses_count: number;
  tenants?: { business_name: string };
}

// ============================================================================
// Types
// ============================================================================

export interface TenantCreditInfo {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  balance: number;
  tierStatus: 'free' | 'paid';
  isFreeTier: boolean;
  creditsUsedToday: number;
  creditsUsedThisWeek: number;
  creditsUsedThisMonth: number;
  lifetimeSpent: number;
  lastActivity: string | null;
  createdAt: string;
  creditStatus: 'healthy' | 'warning' | 'critical' | 'depleted' | 'unlimited';
}

export interface PlatformCreditStats {
  totalFreeTierTenants: number;
  totalPaidTierTenants: number;
  tenantsAtZero: number;
  tenantsCritical: number;
  tenantsWarning: number;
  tenantsHealthy: number;
  totalCreditsConsumedToday: number;
  totalCreditsConsumedWeek: number;
  totalCreditsConsumedMonth: number;
  avgBalanceFreeTier: number;
  totalCreditPurchasesRevenue: number;
}

export interface CreditAdjustmentRequest {
  tenantId: string;
  amount: number;
  reason: AdjustmentReason;
  notes?: string;
  adminUserId?: string;
}

export type AdjustmentReason = 
  | 'support_resolution'
  | 'billing_correction'
  | 'promotional_grant'
  | 'goodwill_gesture'
  | 'testing'
  | 'compensation'
  | 'other';

export interface CreditTransaction {
  id: string;
  tenantId: string;
  amount: number;
  balanceAfter: number;
  transactionType: string;
  actionType?: string;
  referenceId?: string;
  referenceType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreditGrant {
  id: string;
  tenantId: string;
  amount: number;
  grantType: string;
  promoCode?: string;
  expiresAt?: string;
  grantedAt: string;
  grantedBy?: string;
  isUsed: boolean;
  notes?: string;
}

export interface TenantCreditDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    isFreeTier: boolean;
    createdAt: string;
  };
  credits: {
    balance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    creditsUsedToday: number;
    creditsUsedThisWeek: number;
    creditsUsedThisMonth: number;
    tierStatus: string;
    lastFreeGrantAt: string | null;
    nextFreeGrantAt: string | null;
  };
  recentTransactions: CreditTransaction[];
  grants: CreditGrant[];
  referralInfo?: {
    referralCode: string;
    totalReferrals: number;
    creditsEarned: number;
  };
}

export interface TenantsFilter {
  status?: 'healthy' | 'warning' | 'critical' | 'depleted' | 'unlimited' | null;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BulkGrantRequest {
  tenantIds: string[];
  amount: number;
  grantType: string;
  notes?: string;
  adminUserId?: string;
  expiresAt?: string;
}

// ============================================================================
// Platform Stats
// ============================================================================

/**
 * Get platform-wide credit statistics for the super admin dashboard
 */
export async function getPlatformCreditStats(): Promise<PlatformCreditStats | null> {
  try {
    const { data, error } = await sb.rpc('get_platform_credit_stats');

    if (error) {
      logger.error('Failed to get platform credit stats', error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        totalFreeTierTenants: 0,
        totalPaidTierTenants: 0,
        tenantsAtZero: 0,
        tenantsCritical: 0,
        tenantsWarning: 0,
        tenantsHealthy: 0,
        totalCreditsConsumedToday: 0,
        totalCreditsConsumedWeek: 0,
        totalCreditsConsumedMonth: 0,
        avgBalanceFreeTier: 0,
        totalCreditPurchasesRevenue: 0,
      };
    }

    const row = data[0];
    return {
      totalFreeTierTenants: row.total_free_tier_tenants ?? 0,
      totalPaidTierTenants: row.total_paid_tier_tenants ?? 0,
      tenantsAtZero: row.tenants_at_zero ?? 0,
      tenantsCritical: row.tenants_critical ?? 0,
      tenantsWarning: row.tenants_warning ?? 0,
      tenantsHealthy: row.tenants_healthy ?? 0,
      totalCreditsConsumedToday: row.total_credits_consumed_today ?? 0,
      totalCreditsConsumedWeek: row.total_credits_consumed_week ?? 0,
      totalCreditsConsumedMonth: row.total_credits_consumed_month ?? 0,
      avgBalanceFreeTier: parseFloat(row.avg_balance_free_tier) || 0,
      totalCreditPurchasesRevenue: row.total_credit_purchases_revenue ?? 0,
    };
  } catch (err) {
    logger.error('Error getting platform credit stats', err as Error);
    return null;
  }
}

// ============================================================================
// Tenant Credit Management
// ============================================================================

/**
 * Get paginated list of tenants with credit information
 */
export async function getTenantsWithCredits(
  filters: TenantsFilter = {}
): Promise<{ tenants: TenantCreditInfo[]; total: number }> {
  try {
    const { data, error } = await sb.rpc('get_tenants_with_credits', {
      p_status: filters.status || null,
      p_search: filters.search || null,
      p_limit: filters.limit || 50,
      p_offset: filters.offset ?? 0,
    });

    if (error) {
      logger.error('Failed to get tenants with credits', error);
      return { tenants: [], total: 0 };
    }

    const tenants: TenantCreditInfo[] = (data ?? []).map((row: TenantCreditRow) => ({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name || 'Unknown',
      tenantSlug: row.tenant_slug ?? '',
      balance: row.balance ?? 0,
      tierStatus: row.tier_status || 'free',
      isFreeTier: row.is_free_tier ?? false,
      creditsUsedToday: row.credits_used_today ?? 0,
      creditsUsedThisWeek: row.credits_used_this_week ?? 0,
      creditsUsedThisMonth: row.credits_used_this_month ?? 0,
      lifetimeSpent: row.lifetime_spent ?? 0,
      lastActivity: row.last_activity,
      createdAt: row.created_at,
      creditStatus: row.credit_status || 'healthy',
    }));

    // Get total count
    const { count } = await sb
      .from('tenants')
      .select('id', { count: 'exact', head: true });

    return { tenants, total: count || tenants.length };
  } catch (err) {
    logger.error('Error getting tenants with credits', err as Error);
    return { tenants: [], total: 0 };
  }
}

/**
 * Get detailed credit information for a specific tenant
 */
export async function getTenantCreditDetail(
  tenantId: string
): Promise<TenantCreditDetail | null> {
  try {
    // Get tenant info
    const { data: tenant, error: tenantError } = await sb
      .from('tenants')
      .select('id, business_name, slug, is_free_tier, created_at')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      logger.error('Failed to get tenant', tenantError);
      return null;
    }

    // Get credit info
    const { data: credits } = await sb
      .from('tenant_credits')
      .select('balance, lifetime_earned, lifetime_spent, credits_used_today, credits_used_this_week, credits_used_this_month, tier_status, last_free_grant_at, next_free_grant_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Get recent transactions
    const { data: transactions } = await sb
      .from('credit_transactions')
      .select('id, tenant_id, amount, balance_after, transaction_type, action_type, reference_id, reference_type, description, metadata, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get grants
    const { data: grants } = await sb
      .from('credit_grants')
      .select('id, tenant_id, amount, grant_type, promo_code, expires_at, granted_at, granted_by, is_used, notes')
      .eq('tenant_id', tenantId)
      .order('granted_at', { ascending: false });

    // Get referral info
    const { data: referralCode } = await sb
      .from('referral_codes')
      .select('code, uses_count')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { data: referralCredits } = await sb
      .from('referral_redemptions')
      .select('referrer_credits_granted')
      .eq('referrer_tenant_id', tenantId);

    const totalReferralCredits = (referralCredits ?? []).reduce(
      (sum, r) => sum + (r.referrer_credits_granted ?? 0),
      0
    );

    return {
      tenant: {
        id: tenant.id,
        name: tenant.business_name || 'Unknown',
        slug: tenant.slug ?? '',
        isFreeTier: tenant.is_free_tier ?? false,
        createdAt: tenant.created_at,
      },
      credits: {
        balance: credits?.balance || 1000,
        lifetimeEarned: credits?.lifetime_earned || 1000,
        lifetimeSpent: credits?.lifetime_spent ?? 0,
        creditsUsedToday: credits?.credits_used_today ?? 0,
        creditsUsedThisWeek: credits?.credits_used_this_week ?? 0,
        creditsUsedThisMonth: credits?.credits_used_this_month ?? 0,
        tierStatus: credits?.tier_status || 'free',
        lastFreeGrantAt: credits?.last_free_grant_at,
        nextFreeGrantAt: credits?.next_free_grant_at,
      },
      recentTransactions: (transactions ?? []).map((tx: CreditTransactionRow) => ({
        id: tx.id,
        tenantId: tx.tenant_id,
        amount: tx.amount,
        balanceAfter: tx.balance_after,
        transactionType: tx.transaction_type,
        actionType: tx.action_type,
        referenceId: tx.reference_id,
        referenceType: tx.reference_type,
        description: tx.description,
        metadata: tx.metadata,
        createdAt: tx.created_at,
      })),
      grants: (grants ?? []).map((g: CreditGrantRow) => ({
        id: g.id,
        tenantId: g.tenant_id,
        amount: g.amount,
        grantType: g.grant_type,
        promoCode: g.promo_code,
        expiresAt: g.expires_at,
        grantedAt: g.granted_at,
        grantedBy: g.granted_by,
        isUsed: g.is_used,
        notes: g.notes,
      })),
      referralInfo: referralCode
        ? {
            referralCode: referralCode.code,
            totalReferrals: referralCode.uses_count ?? 0,
            creditsEarned: totalReferralCredits,
          }
        : undefined,
    };
  } catch (err) {
    logger.error('Error getting tenant credit detail', err as Error);
    return null;
  }
}

// ============================================================================
// Credit Adjustments
// ============================================================================

/**
 * Manually adjust a tenant's credit balance (for super admins)
 */
export async function adjustTenantCredits(
  request: CreditAdjustmentRequest
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const { data, error } = await sb.rpc('admin_adjust_credits', {
      p_tenant_id: request.tenantId,
      p_amount: request.amount,
      p_reason: request.reason,
      p_notes: request.notes || null,
      p_admin_user_id: request.adminUserId || null,
    });

    if (error) {
      logger.error('Failed to adjust credits', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No response from adjustment' };
    }

    const result = data[0];
    if (!result.success) {
      return { success: false, error: result.error_message };
    }

    logger.info('Credits adjusted', {
      tenantId: request.tenantId,
      amount: request.amount,
      reason: request.reason,
      newBalance: result.new_balance,
    });

    return { success: true, newBalance: result.new_balance };
  } catch (err) {
    logger.error('Error adjusting credits', err as Error);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Grant credits to multiple tenants at once
 */
export async function grantBulkCredits(
  request: BulkGrantRequest
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { data, error } = await sb.rpc('grant_bulk_credits', {
      p_tenant_ids: request.tenantIds,
      p_amount: request.amount,
      p_grant_type: request.grantType,
      p_notes: request.notes || null,
      p_admin_user_id: request.adminUserId || null,
      p_expires_at: request.expiresAt || null,
    });

    if (error) {
      logger.error('Failed to grant bulk credits', error);
      return { success: false, error: error.message };
    }

    logger.info('Bulk credits granted', {
      count: data,
      amount: request.amount,
      grantType: request.grantType,
    });

    return { success: true, count: data ?? 0 };
  } catch (err) {
    logger.error('Error granting bulk credits', err as Error);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Refund a credit transaction
 */
export async function refundTransaction(
  transactionId: string,
  reason: string,
  adminUserId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    // Get original transaction
    const { data: originalTx, error: txError } = await sb
      .from('credit_transactions')
      .select('id, tenant_id, amount, balance_after, transaction_type, action_type, reference_id, reference_type, description, metadata, created_at')
      .eq('id', transactionId)
      .maybeSingle();

    if (txError || !originalTx) {
      return { success: false, error: 'Transaction not found' };
    }

    // Check if already refunded
    if (originalTx.metadata?.refunded) {
      return { success: false, error: 'Transaction already refunded' };
    }

    // Can only refund usage transactions
    if (originalTx.transaction_type !== 'usage') {
      return { success: false, error: 'Can only refund usage transactions' };
    }

    // Refund amount (make it positive)
    const refundAmount = Math.abs(originalTx.amount);

    // Use adjust function
    const result = await adjustTenantCredits({
      tenantId: originalTx.tenant_id,
      amount: refundAmount,
      reason: 'billing_correction',
      notes: `Refund for transaction ${transactionId}: ${reason}`,
      adminUserId,
    });

    if (!result.success) {
      return result;
    }

    // Mark original as refunded
    await sb
      .from('credit_transactions')
      .update({
        metadata: {
          ...originalTx.metadata,
          refunded: true,
          refunded_at: new Date().toISOString(),
          refund_reason: reason,
          refunded_by: adminUserId,
        },
      })
      .eq('id', transactionId);

    return { success: true, newBalance: result.newBalance };
  } catch (err) {
    logger.error('Error refunding transaction', err as Error);
    return { success: false, error: (err as Error).message };
  }
}

// ============================================================================
// Transaction Audit
// ============================================================================

/**
 * Get all credit transactions across platform (for audit log)
 */
export async function getAllTransactions(options: {
  tenantId?: string;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: CreditTransaction[]; total: number }> {
  try {
    let query = sb
      .from('credit_transactions')
      .select('id, tenant_id, amount, balance_after, transaction_type, action_type, reference_id, reference_type, description, metadata, created_at, tenants!inner(business_name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options.tenantId) {
      query = query.eq('tenant_id', options.tenantId);
    }

    if (options.transactionType) {
      query = query.eq('transaction_type', options.transactionType);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.minAmount !== undefined) {
      query = query.gte('amount', options.minAmount);
    }

    if (options.maxAmount !== undefined) {
      query = query.lte('amount', options.maxAmount);
    }

    query = query.range(
      options.offset ?? 0,
      (options.offset ?? 0) + (options.limit ?? 50) - 1
    );

    const { data, count, error } = await query;

    if (error) {
      logger.error('Failed to get transactions', error);
      return { transactions: [], total: 0 };
    }

    return {
      transactions: (data ?? []).map((tx: CreditTransactionRow) => ({
        id: tx.id,
        tenantId: tx.tenant_id,
        amount: tx.amount,
        balanceAfter: tx.balance_after,
        transactionType: tx.transaction_type,
        actionType: tx.action_type,
        referenceId: tx.reference_id,
        referenceType: tx.reference_type,
        description: tx.description,
        metadata: {
          ...tx.metadata,
          tenantName: tx.tenants?.business_name,
          tenantSlug: tx.tenants?.slug,
        },
        createdAt: tx.created_at,
      })),
      total: count ?? 0,
    };
  } catch (err) {
    logger.error('Error getting all transactions', err as Error);
    return { transactions: [], total: 0 };
  }
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get credit analytics data for charts
 */
export async function getCreditAnalytics(options: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}): Promise<{
  consumptionTrend: Array<{ date: string; credits: number }>;
  purchaseRevenue: Array<{ date: string; revenue: number }>;
  categoryBreakdown: Array<{ category: string; credits: number }>;
  topActions: Array<{ action: string; count: number; credits: number }>;
}> {
  try {
    const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = options.endDate || new Date().toISOString();

    // Get consumption by day
    const { data: consumptionData } = await sb
      .from('credit_transactions')
      .select('created_at, amount')
      .eq('transaction_type', 'usage')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    // Group by date
    const consumptionByDate = new Map<string, number>();
    (consumptionData ?? []).forEach((tx: Pick<CreditTransactionRow, 'created_at' | 'amount'>) => {
      const date = new Date(tx.created_at).toISOString().split('T')[0];
      consumptionByDate.set(date, (consumptionByDate.get(date) ?? 0) + Math.abs(tx.amount));
    });

    // Get purchase revenue
    const { data: purchaseData } = await sb
      .from('credit_transactions')
      .select('created_at, metadata')
      .eq('transaction_type', 'purchase')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const revenueByDate = new Map<string, number>();
    (purchaseData ?? []).forEach((tx: { created_at: string; metadata?: Record<string, unknown> }) => {
      const date = new Date(tx.created_at).toISOString().split('T')[0];
      const amount = (tx.metadata?.amount_paid as number) ?? 0;
      revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + amount);
    });

    // Get category breakdown
    const { data: categoryData } = await sb
      .from('credit_transactions')
      .select('action_type, amount')
      .eq('transaction_type', 'usage')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const categoryTotals = new Map<string, number>();
    (categoryData ?? []).forEach((tx: Pick<CreditTransactionRow, 'action_type' | 'amount'>) => {
      const category = getActionCategory(tx.action_type || 'other');
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + Math.abs(tx.amount));
    });

    // Get top actions
    const actionCounts = new Map<string, { count: number; credits: number }>();
    (categoryData ?? []).forEach((tx: Pick<CreditTransactionRow, 'action_type' | 'amount'>) => {
      const action = tx.action_type || 'unknown';
      const current = actionCounts.get(action) || { count: 0, credits: 0 };
      actionCounts.set(action, {
        count: current.count + 1,
        credits: current.credits + Math.abs(tx.amount),
      });
    });

    return {
      consumptionTrend: Array.from(consumptionByDate.entries())
        .map(([date, credits]) => ({ date, credits }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      purchaseRevenue: Array.from(revenueByDate.entries())
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      categoryBreakdown: Array.from(categoryTotals.entries())
        .map(([category, credits]) => ({ category, credits }))
        .sort((a, b) => b.credits - a.credits),
      topActions: Array.from(actionCounts.entries())
        .map(([action, data]) => ({ action, ...data }))
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 10),
    };
  } catch (err) {
    logger.error('Error getting credit analytics', err as Error);
    return {
      consumptionTrend: [],
      purchaseRevenue: [],
      categoryBreakdown: [],
      topActions: [],
    };
  }
}

// Helper to categorize actions
function getActionCategory(actionType: string): string {
  if (actionType.includes('menu') || actionType.includes('order')) return 'Orders & Menus';
  if (actionType.includes('sms') || actionType.includes('email')) return 'Communication';
  if (actionType.includes('pos') || actionType.includes('sale')) return 'POS';
  if (actionType.includes('export') || actionType.includes('report')) return 'Reports';
  if (actionType.includes('inventory') || actionType.includes('stock')) return 'Inventory';
  if (actionType.includes('ai') || actionType.includes('forecast')) return 'AI Features';
  return 'Other';
}

// ============================================================================
// Promo Code Management (Admin)
// ============================================================================

export interface PromoCodeAdmin {
  id: string;
  code: string;
  creditsAmount: number;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean;
  validFrom: string;
  validUntil: string | null;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreatePromoCodeRequest {
  code: string;
  creditsAmount: number;
  maxUses?: number;
  validFrom?: string;
  validUntil?: string;
  description?: string;
  createdBy?: string;
}

/**
 * Get all promo codes for admin management
 */
export async function getAllPromoCodes(): Promise<PromoCodeAdmin[]> {
  try {
    const { data, error } = await sb
      .from('promo_codes')
      .select('id, code, credits_amount, max_uses, uses_count, is_active, valid_from, valid_until, description, created_by, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get promo codes', error);
      return [];
    }

    return (data ?? []).map((code: PromoCodeRow) => ({
      id: code.id,
      code: code.code,
      creditsAmount: code.credits_amount,
      maxUses: code.max_uses,
      usesCount: code.uses_count ?? 0,
      isActive: code.is_active,
      validFrom: code.valid_from,
      validUntil: code.valid_until,
      description: code.description,
      createdBy: code.created_by,
      createdAt: code.created_at,
    }));
  } catch (err) {
    logger.error('Error getting promo codes', err as Error);
    return [];
  }
}

/**
 * Create a new promo code
 */
export async function createPromoCode(
  request: CreatePromoCodeRequest
): Promise<{ success: boolean; promoCode?: PromoCodeAdmin; error?: string }> {
  try {
    const { data, error } = await sb
      .from('promo_codes')
      .insert({
        code: request.code.toUpperCase(),
        credits_amount: request.creditsAmount,
        max_uses: request.maxUses || null,
        valid_from: request.validFrom || new Date().toISOString(),
        valid_until: request.validUntil || null,
        description: request.description || null,
        created_by: request.createdBy || null,
        is_active: true,
      })
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Promo code already exists' };
      }
      logger.error('Failed to create promo code', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      promoCode: {
        id: data.id,
        code: data.code,
        creditsAmount: data.credits_amount,
        maxUses: data.max_uses,
        usesCount: 0,
        isActive: data.is_active,
        validFrom: data.valid_from,
        validUntil: data.valid_until,
        description: data.description,
        createdBy: data.created_by,
        createdAt: data.created_at,
      },
    };
  } catch (err) {
    logger.error('Error creating promo code', err as Error);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Update a promo code
 */
export async function updatePromoCode(
  id: string,
  updates: Partial<CreatePromoCodeRequest> & { isActive?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Record<string, unknown> = {};
    if (updates.creditsAmount !== undefined) updateData.credits_amount = updates.creditsAmount;
    if (updates.maxUses !== undefined) updateData.max_uses = updates.maxUses;
    if (updates.validUntil !== undefined) updateData.valid_until = updates.validUntil;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { error } = await sb
      .from('promo_codes')
      .update(updateData)
      .eq('id', id);

    if (error) {
      logger.error('Failed to update promo code', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    logger.error('Error updating promo code', err as Error);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get promo code redemption history
 */
export async function getPromoCodeRedemptions(codeId: string): Promise<Array<{
  tenantId: string;
  tenantName: string;
  creditsGranted: number;
  redeemedAt: string;
}>> {
  try {
    const { data, error } = await sb
      .from('promo_redemptions')
      .select('tenant_id, credits_granted, redeemed_at, tenants!inner(business_name)')
      .eq('promo_code_id', codeId)
      .order('redeemed_at', { ascending: false });

    if (error) {
      logger.error('Failed to get redemptions', error);
      return [];
    }

    return (data ?? []).map((r: PromoRedemptionRow) => ({
      tenantId: r.tenant_id,
      tenantName: r.tenants?.business_name || 'Unknown',
      creditsGranted: r.credits_granted,
      redeemedAt: r.redeemed_at,
    }));
  } catch (err) {
    logger.error('Error getting redemptions', err as Error);
    return [];
  }
}

// ============================================================================
// Credit Package Management
// ============================================================================

export interface CreditPackageDB {
  id: string;
  name: string;
  slug: string;
  credits: number;
  priceCents: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isActive: boolean;
  sortOrder: number;
  badge: string | null;
  description: string | null;
}

/**
 * Get all credit packages from database
 */
export async function getAllCreditPackages(): Promise<CreditPackageDB[]> {
  try {
    const { data, error } = await sb
      .from('credit_packages')
      .select('id, name, slug, credits, price_cents, stripe_price_id, stripe_product_id, is_active, sort_order, badge, description')
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Failed to get credit packages', error);
      return [];
    }

    return (data ?? []).map((pkg: CreditPackageRow) => ({
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      credits: pkg.credits,
      priceCents: pkg.price_cents,
      stripePriceId: pkg.stripe_price_id,
      stripeProductId: pkg.stripe_product_id,
      isActive: pkg.is_active,
      sortOrder: pkg.sort_order,
      badge: pkg.badge,
      description: pkg.description,
    }));
  } catch (err) {
    logger.error('Error getting credit packages', err as Error);
    return [];
  }
}

/**
 * Create or update a credit package
 */
export async function upsertCreditPackage(
  pkg: Partial<CreditPackageDB> & { name: string; credits: number; priceCents: number }
): Promise<{ success: boolean; package?: CreditPackageDB; error?: string }> {
  try {
    const slug = pkg.slug || pkg.name.toLowerCase().replace(/\s+/g, '-');
    
    const { data, error } = await sb
      .from('credit_packages')
      .upsert({
        id: pkg.id || undefined,
        name: pkg.name,
        slug,
        credits: pkg.credits,
        price_cents: pkg.priceCents,
        stripe_price_id: pkg.stripePriceId || null,
        stripe_product_id: pkg.stripeProductId || null,
        is_active: pkg.isActive ?? true,
        sort_order: pkg.sortOrder ?? 0,
        badge: pkg.badge || null,
        description: pkg.description || null,
      })
      .select()
      .maybeSingle();

    if (error) {
      logger.error('Failed to upsert credit package', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      package: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        credits: data.credits,
        priceCents: data.price_cents,
        stripePriceId: data.stripe_price_id,
        stripeProductId: data.stripe_product_id,
        isActive: data.is_active,
        sortOrder: data.sort_order,
        badge: data.badge,
        description: data.description,
      },
    };
  } catch (err) {
    logger.error('Error upserting credit package', err as Error);
    return { success: false, error: (err as Error).message };
  }
}

// ============================================================================
// Referral Management
// ============================================================================

export interface ReferralStats {
  totalReferrals: number;
  totalCreditsAwarded: number;
  totalConversions: number;
  pendingConversions: number;
  topReferrers: Array<{
    tenantId: string;
    tenantName: string;
    referrals: number;
    creditsEarned: number;
  }>;
}

/**
 * Get platform-wide referral statistics
 */
export async function getReferralStats(): Promise<ReferralStats> {
  try {
    // Get total referrals
    const { count: totalReferrals } = await sb
      .from('referral_redemptions')
      .select('id', { count: 'exact', head: true });

    // Get total credits awarded
    const { data: creditsData } = await sb
      .from('referral_redemptions')
      .select('referrer_credits_granted, referee_credits_granted');

    const totalCreditsAwarded = (creditsData ?? []).reduce(
      (sum, r) => sum + (r.referrer_credits_granted ?? 0) + (r.referee_credits_granted ?? 0),
      0
    );

    // Get conversions
    const { count: totalConversions } = await sb
      .from('referral_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('conversion_bonus_granted', true);

    const { count: pendingConversions } = await sb
      .from('referral_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('conversion_bonus_granted', false);

    // Get top referrers
    const { data: topReferrersData } = await sb
      .from('referral_codes')
      .select('tenant_id, uses_count, tenants!inner(business_name)')
      .gt('uses_count', 0)
      .order('uses_count', { ascending: false })
      .limit(10);

    // Get credits earned per referrer
    const topReferrers = await Promise.all(
      (topReferrersData ?? []).map(async (r: ReferralCodeRow) => {
        const { data: earned } = await sb
          .from('referral_redemptions')
          .select('referrer_credits_granted')
          .eq('referrer_tenant_id', r.tenant_id);

        return {
          tenantId: r.tenant_id,
          tenantName: r.tenants?.business_name || 'Unknown',
          referrals: r.uses_count ?? 0,
          creditsEarned: (earned ?? []).reduce(
            (sum, e) => sum + (e.referrer_credits_granted ?? 0),
            0
          ),
        };
      })
    );

    return {
      totalReferrals: totalReferrals ?? 0,
      totalCreditsAwarded,
      totalConversions: totalConversions ?? 0,
      pendingConversions: pendingConversions ?? 0,
      topReferrers,
    };
  } catch (err) {
    logger.error('Error getting referral stats', err as Error);
    return {
      totalReferrals: 0,
      totalCreditsAwarded: 0,
      totalConversions: 0,
      pendingConversions: 0,
      topReferrers: [],
    };
  }
}







