/**
 * Credit Service
 *
 * Core service for managing credits in the freemium system.
 * Handles credit checking, consumption, granting, and purchasing.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  getCreditCost,
  getCreditCostInfo,
  FREE_TIER_MONTHLY_CREDITS,
} from './creditCosts';

// ============================================================================
// Types
// ============================================================================

export interface CreditBalance {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  isFreeTier: boolean;
  nextFreeGrantAt: string | null;
}

export interface CreditTransaction {
  id: string;
  tenantId: string;
  amount: number;
  balanceAfter: number;
  transactionType: 'free_grant' | 'purchase' | 'usage' | 'refund' | 'bonus' | 'adjustment';
  actionType?: string;
  referenceId?: string;
  referenceType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ConsumeCreditsResult {
  success: boolean;
  newBalance: number;
  creditsCost: number;
  errorMessage?: string;
}

export interface CheckCreditsResult {
  hasCredits: boolean;
  balance: number;
  cost: number;
  wouldRemain: number;
  isFreeTier: boolean;
}

// ============================================================================
// Credit Balance Functions
// ============================================================================

/**
 * Get the current credit balance for a tenant
 */
export async function getCreditBalance(tenantId: string): Promise<CreditBalance | null> {
  try {
    // PRIORITY: Check tenants table for subscription_status and plan first
    // This is the source of truth for whether user is on free tier
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('subscription_status, subscription_plan, credits_enabled')
      .eq('id', tenantId)
      .maybeSingle();

    // Paid plans (professional, enterprise) are NEVER free tier
    const isPaidPlan = tenantData?.subscription_plan === 'professional' ||
                       tenantData?.subscription_plan === 'enterprise';

    // Active subscription statuses (including 'trialing')
    const hasActiveSubscription = tenantData?.subscription_status === 'active' ||
                                   tenantData?.subscription_status === 'trial' ||
                                   tenantData?.subscription_status === 'trialing';

    // User is NOT free tier if they have a paid plan OR active subscription
    const tenantIsFreeTier = !(isPaidPlan || hasActiveSubscription);

    // Query credit balance data
    const { data, error } = await supabase
      .from('tenant_credits')
      .select('balance, lifetime_earned, lifetime_spent, is_free_tier, next_free_grant_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching credit balance', error, { tenantId });
      return {
        balance: FREE_TIER_MONTHLY_CREDITS,
        lifetimeEarned: FREE_TIER_MONTHLY_CREDITS,
        lifetimeSpent: 0,
        isFreeTier: tenantIsFreeTier,
        nextFreeGrantAt: null,
      };
    }

    if (data) {
      return {
        balance: data.balance ?? FREE_TIER_MONTHLY_CREDITS,
        lifetimeEarned: data.lifetime_earned ?? FREE_TIER_MONTHLY_CREDITS,
        lifetimeSpent: data.lifetime_spent ?? 0,
        // Use tenant table as source of truth for isFreeTier
        isFreeTier: tenantIsFreeTier,
        nextFreeGrantAt: data.next_free_grant_at ?? null,
      };
    }

    // No record exists - return defaults
    return {
      balance: FREE_TIER_MONTHLY_CREDITS,
      lifetimeEarned: FREE_TIER_MONTHLY_CREDITS,
      lifetimeSpent: 0,
      isFreeTier: tenantIsFreeTier,
      nextFreeGrantAt: null,
    };
  } catch (err) {
    logger.error('Error in getCreditBalance', err as Error, { tenantId });
    return {
      balance: FREE_TIER_MONTHLY_CREDITS,
      lifetimeEarned: FREE_TIER_MONTHLY_CREDITS,
      lifetimeSpent: 0,
      isFreeTier: true,
      nextFreeGrantAt: null,
    };
  }
}

/**
 * Check if a tenant has enough credits for an action
 */
export async function checkCredits(
  tenantId: string, 
  actionKey: string
): Promise<CheckCreditsResult> {
  const cost = getCreditCost(actionKey);
  
  // If action is free, always allow
  if (cost === 0) {
    return {
      hasCredits: true,
      balance: -1,
      cost: 0,
      wouldRemain: -1,
      isFreeTier: false,
    };
  }

  const balance = await getCreditBalance(tenantId);
  
  // If not on free tier, skip credit check
  if (!balance?.isFreeTier) {
    return {
      hasCredits: true,
      balance: -1,
      cost,
      wouldRemain: -1,
      isFreeTier: false,
    };
  }

  const hasCredits = balance.balance >= cost;
  
  return {
    hasCredits,
    balance: balance.balance,
    cost,
    wouldRemain: balance.balance - cost,
    isFreeTier: true,
  };
}

// ============================================================================
// Credit Consumption Functions
// ============================================================================

/**
 * Consume credits for an action
 * Returns success if credits were deducted or if not on free tier
 */
export async function consumeCredits(
  tenantId: string,
  actionKey: string,
  referenceId?: string,
  description?: string,
  metadata?: Record<string, unknown>
): Promise<ConsumeCreditsResult> {
  try {
    // Get the cost from creditCosts
    const cost = getCreditCost(actionKey);
    
    const { data, error } = await supabase
      .rpc('consume_credits', {
        p_tenant_id: tenantId,
        p_amount: cost,
        p_action_key: actionKey,
        p_description: description || null,
        p_reference_id: referenceId || null,
        p_metadata: metadata || {},
      });

    if (error) {
      logger.error('Failed to consume credits', error, { tenantId, actionKey });
      return {
        success: false,
        newBalance: 0,
        creditsCost: 0,
        errorMessage: error.message,
      };
    }

    // data is JSONB (single object), not an array
    if (!data) {
      return {
        success: false,
        newBalance: 0,
        creditsCost: 0,
        errorMessage: 'No response from credit consumption',
      };
    }

    // Access data directly as single object
    const result = data as { success: boolean; consumed?: number; balance?: number; error?: string };
    
    if (!result.success) {
      logger.warn('Credit consumption failed', { 
        tenantId, 
        actionKey, 
        error: result.error 
      });
    }

    return {
      success: result.success,
      newBalance: result.balance ?? 0,
      creditsCost: result.consumed ?? cost,
      errorMessage: result.error || undefined,
    };
  } catch (err) {
    logger.error('Error consuming credits', err as Error, { tenantId, actionKey });
    return {
      success: false,
      newBalance: 0,
      creditsCost: 0,
      errorMessage: (err as Error).message,
    };
  }
}

// ============================================================================
// Credit Grant Functions
// ============================================================================

/**
 * Grant free monthly credits to a tenant
 */
export async function grantFreeCredits(
  tenantId: string,
  amount: number = FREE_TIER_MONTHLY_CREDITS
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .rpc('grant_free_credits', {
        p_tenant_id: tenantId,
        p_amount: amount,
      });

    if (error) {
      logger.error('Failed to grant free credits', error, { tenantId, amount });
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No response from credit grant' };
    }

    const result = data[0];
    
    logger.info('Free credits granted', { 
      tenantId, 
      amount, 
      newBalance: result.new_balance 
    });

    return {
      success: result.success,
      newBalance: result.new_balance,
      error: result.error_message || undefined,
    };
  } catch (err) {
    logger.error('Error granting free credits', err as Error, { tenantId, amount });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Purchase credits for a tenant
 */
export async function purchaseCredits(
  tenantId: string,
  amount: number,
  stripePaymentId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .rpc('purchase_credits', {
        p_tenant_id: tenantId,
        p_amount: amount,
        p_stripe_payment_id: stripePaymentId || null,
      });

    if (error) {
      logger.error('Failed to purchase credits', error, { tenantId, amount });
      return { success: false, error: error.message };
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return { success: false, error: 'No response from credit purchase' };
    }

    const result = data[0];
    
    logger.info('Credits purchased', { 
      tenantId, 
      amount, 
      newBalance: result.new_balance,
      stripePaymentId,
    });

    return {
      success: result.success,
      newBalance: result.new_balance,
      error: result.error_message || undefined,
    };
  } catch (err) {
    logger.error('Error purchasing credits', err as Error, { tenantId, amount });
    return { success: false, error: (err as Error).message };
  }
}

// ============================================================================
// Credit Transaction Functions
// ============================================================================

/**
 * Get credit transaction history for a tenant
 */
export async function getCreditTransactions(
  tenantId: string,
  options?: {
    limit?: number;
    offset?: number;
    transactionType?: string;
  }
): Promise<CreditTransaction[]> {
  try {
    let query = supabase
      .from('credit_transactions')
      .select('id, tenant_id, amount, balance_after, transaction_type, action_type, reference_id, reference_type, description, metadata, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.transactionType) {
      query = query.eq('transaction_type', options.transactionType);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get credit transactions', error, { tenantId });
      return [];
    }

    return (data ?? []).map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      amount: row.amount,
      balanceAfter: row.balance_after,
      transactionType: row.transaction_type as CreditTransaction['transactionType'],
      actionType: row.action_type ?? undefined,
      referenceId: row.reference_id ?? undefined,
      referenceType: row.reference_type ?? undefined,
      description: row.description ?? undefined,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: row.created_at ?? '',
    }));
  } catch (err) {
    logger.error('Error getting credit transactions', err as Error, { tenantId });
    return [];
  }
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Track a credit-related analytics event
 */
export async function trackCreditEvent(
  tenantId: string,
  eventType: string,
  creditsAtEvent: number,
  actionAttempted?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase
      .from('credit_analytics')
      .insert({
        tenant_id: tenantId,
        event_type: eventType,
        credits_at_event: creditsAtEvent,
        action_attempted: actionAttempted,
        metadata: (metadata || {}) as Record<string, unknown>,
      });
  } catch (err) {
    logger.error('Failed to track credit event', err as Error, { 
      tenantId, 
      eventType 
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate equivalent cost if paying with credits vs subscription
 */
export function calculateCreditVsSubscription(
  creditsUsed: number,
  subscriptionPrice: number = 79
): {
  creditPackCost: number;
  savings: number;
  savingsPercent: number;
} {
  // Estimate pack cost based on growth pack pricing ($40 for 7,500 credits)
  const costPerCredit = 40 / 7500;
  const creditPackCost = Math.ceil(creditsUsed * costPerCredit);
  const savings = creditPackCost - subscriptionPrice;
  const savingsPercent = Math.round((savings / creditPackCost) * 100);

  return {
    creditPackCost,
    savings: Math.max(0, savings),
    savingsPercent: Math.max(0, savingsPercent),
  };
}

/**
 * Estimate how long credits will last based on usage pattern
 */
export function estimateCreditDuration(
  currentBalance: number,
  dailyUsage: number
): {
  daysRemaining: number;
  willExhaustBy: Date;
} {
  const daysRemaining = dailyUsage > 0 ? Math.floor(currentBalance / dailyUsage) : 999;
  const willExhaustBy = new Date();
  willExhaustBy.setDate(willExhaustBy.getDate() + daysRemaining);

  return {
    daysRemaining,
    willExhaustBy,
  };
}

/**
 * Get credit cost info with formatted display
 */
export function getActionCreditInfo(actionKey: string): {
  cost: number;
  name: string;
  category: string;
  description: string;
} | null {
  const info = getCreditCostInfo(actionKey);
  if (!info) return null;

  return {
    cost: info.credits,
    name: info.actionName,
    category: info.category,
    description: info.description,
  };
}







