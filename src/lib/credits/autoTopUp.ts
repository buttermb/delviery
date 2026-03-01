/**
 * Auto Top-Up Service
 * 
 * Manages automatic credit top-up configuration and triggers.
 * When credits fall below a threshold, automatically charges the user
 * and adds credits to their balance.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { CREDIT_PACKAGES } from './creditCosts';

// ============================================================================
// Types
// ============================================================================

export interface AutoTopUpConfig {
  id?: string;
  tenantId: string;
  enabled: boolean;
  triggerThreshold: number;
  topUpAmount: number;
  maxPerMonth: number;
  topUpsThisMonth: number;
  monthResetAt?: Date;
  paymentMethodId?: string;
  stripeCustomerId?: string;
  lastTopUpAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SetupAutoTopUpRequest {
  tenantId: string;
  enabled: boolean;
  triggerThreshold?: number;
  topUpAmount?: number;
  maxPerMonth?: number;
  paymentMethodId?: string;
  stripeCustomerId?: string;
}

export interface AutoTopUpResult {
  success: boolean;
  config?: AutoTopUpConfig;
  error?: string;
}

export interface TopUpCheckResult {
  shouldTopUp: boolean;
  reason?: string;
  topUpAmount?: number;
  paymentMethodId?: string;
  stripeCustomerId?: string;
}

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Get auto top-up configuration for a tenant
 */
export async function getAutoTopUpConfig(tenantId: string): Promise<AutoTopUpConfig | null> {
  try {
    const { data, error } = await supabase
      .from('credit_auto_topup')
      .select('id, tenant_id, enabled, trigger_threshold, topup_amount, max_per_month, topups_this_month, month_reset_at, payment_method_id, stripe_customer_id, last_topup_at, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapDbToConfig(data);
  } catch (error) {
    logger.error('Error fetching auto top-up config', { error, tenantId });
    return null;
  }
}

/**
 * Set up or update auto top-up configuration
 */
export async function setupAutoTopUp(request: SetupAutoTopUpRequest): Promise<AutoTopUpResult> {
  const {
    tenantId,
    enabled,
    triggerThreshold = 500,
    topUpAmount = 5000,
    maxPerMonth = 3,
    paymentMethodId,
    stripeCustomerId,
  } = request;

  try {
    // Check if config exists
    const existing = await getAutoTopUpConfig(tenantId);

    const configData = {
      tenant_id: tenantId,
      enabled,
      trigger_threshold: triggerThreshold,
      topup_amount: topUpAmount,
      max_per_month: maxPerMonth,
      payment_method_id: paymentMethodId,
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('credit_auto_topup')
        .update(configData)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) throw error;

      return {
        success: true,
        config: mapDbToConfig(data),
      };
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('credit_auto_topup')
        .insert({
          ...configData,
          topups_this_month: 0,
          month_reset_at: getNextMonthReset(),
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      return {
        success: true,
        config: mapDbToConfig(data),
      };
    }
  } catch (error) {
    logger.error('Error setting up auto top-up', { error, tenantId });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Disable auto top-up for a tenant
 */
export async function disableAutoTopUp(tenantId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('credit_auto_topup')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);

    return !error;
  } catch (error) {
    logger.error('Error disabling auto top-up', { error, tenantId });
    return false;
  }
}

/**
 * Update payment method for auto top-up
 */
export async function updateAutoTopUpPaymentMethod(
  tenantId: string,
  paymentMethodId: string,
  stripeCustomerId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('credit_auto_topup')
      .update({
        payment_method_id: paymentMethodId,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    return !error;
  } catch (error) {
    logger.error('Error updating auto top-up payment method', { error, tenantId });
    return false;
  }
}

// ============================================================================
// Top-Up Check Functions
// ============================================================================

/**
 * Check if auto top-up should be triggered
 * Called after each credit consumption
 */
export async function checkAutoTopUp(
  tenantId: string,
  currentBalance: number
): Promise<TopUpCheckResult> {
  try {
    const config = await getAutoTopUpConfig(tenantId);

    if (!config || !config.enabled) {
      return { shouldTopUp: false, reason: 'not_enabled' };
    }

    if (currentBalance > config.triggerThreshold) {
      return { shouldTopUp: false, reason: 'above_threshold' };
    }

    if (config.topUpsThisMonth >= config.maxPerMonth) {
      return { shouldTopUp: false, reason: 'max_reached' };
    }

    if (!config.paymentMethodId) {
      return { shouldTopUp: false, reason: 'no_payment_method' };
    }

    return {
      shouldTopUp: true,
      topUpAmount: config.topUpAmount,
      paymentMethodId: config.paymentMethodId,
      stripeCustomerId: config.stripeCustomerId,
    };
  } catch (error) {
    logger.error('Error checking auto top-up', { error, tenantId });
    return { shouldTopUp: false, reason: 'error' };
  }
}

/**
 * Trigger auto top-up (call edge function)
 */
export async function triggerAutoTopUp(tenantId: string): Promise<{
  success: boolean;
  creditsAdded?: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('process-auto-topup', {
      body: { tenant_id: tenantId },
    });

    if (error) throw error;

    return data;
  } catch (error) {
    logger.error('Error triggering auto top-up', { error, tenantId });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============================================================================
// Top-Up Package Options
// ============================================================================

/**
 * Get available auto top-up amounts
 */
export function getAutoTopUpOptions(): Array<{
  credits: number;
  priceCents: number;
  label: string;
}> {
  return CREDIT_PACKAGES.map((pkg) => ({
    credits: pkg.credits,
    priceCents: pkg.priceCents,
    label: `${pkg.credits.toLocaleString()} credits - $${(pkg.priceCents / 100).toFixed(0)}`,
  }));
}

/**
 * Get available threshold options (100-5000 as per requirements)
 */
export function getThresholdOptions(): Array<{
  value: number;
  label: string;
}> {
  return [
    { value: 5000, label: '5,000 credits' },
    { value: 2500, label: '2,500 credits' },
    { value: 1000, label: '1,000 credits' },
    { value: 500, label: '500 credits' },
    { value: 250, label: '250 credits' },
    { value: 100, label: '100 credits' },
  ];
}

/**
 * Get available max per month options
 */
export function getMaxPerMonthOptions(): Array<{
  value: number;
  label: string;
}> {
  return [
    { value: 1, label: '1 time' },
    { value: 2, label: '2 times' },
    { value: 3, label: '3 times' },
    { value: 5, label: '5 times' },
    { value: 10, label: '10 times (no limit)' },
  ];
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapDbToConfig(data: Record<string, unknown>): AutoTopUpConfig {
  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    enabled: data.enabled as boolean,
    triggerThreshold: data.trigger_threshold as number,
    topUpAmount: data.topup_amount as number,
    maxPerMonth: data.max_per_month as number,
    topUpsThisMonth: data.topups_this_month as number,
    monthResetAt: data.month_reset_at ? new Date(data.month_reset_at as string) : undefined,
    paymentMethodId: data.payment_method_id as string | undefined,
    stripeCustomerId: data.stripe_customer_id as string | undefined,
    lastTopUpAt: data.last_topup_at ? new Date(data.last_topup_at as string) : undefined,
    createdAt: data.created_at ? new Date(data.created_at as string) : undefined,
    updatedAt: data.updated_at ? new Date(data.updated_at as string) : undefined,
  };
}

function getNextMonthReset(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}







