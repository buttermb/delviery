/**
 * useFreeTierLimits Hook
 * 
 * Tracks and enforces daily/monthly limits for free tier users.
 * Prevents abuse and encourages upgrades.
 * 
 * IMPORTANT: Users who have PURCHASED credits bypass daily/monthly limits.
 * They only consume credits without restrictions - their purchase removed limits.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { FREE_TIER_LIMITS, type BlockedFeature } from '@/lib/credits';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface FreeTierUsage {
  // Daily counts
  menusCreatedToday: number;
  ordersCreatedToday: number;
  smsSentToday: number;
  emailsSentToday: number;
  posSalesToday: number;
  bulkOperationsToday: number;
  
  // Monthly counts
  exportsThisMonth: number;
  invoicesThisMonth: number;
  customReportsThisMonth: number;
  aiFeaturesThisMonth: number;
  
  // Current counts (all time)
  totalProducts: number;
  totalCustomers: number;
  totalTeamMembers: number;
  totalLocations: number;
  
  // Timestamps
  lastDailyReset: string | null;
  lastMonthlyReset: string | null;
}

export interface LimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  message: string;
  upgradeRequired: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useFreeTierLimits() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  
  const tenantId = tenant?.id;
  
  // PRIORITY: Check subscription status first - this is the source of truth
  // Active/trial subscriptions are NOT on free tier, regardless of is_free_tier flag
  const hasActiveSubscription = tenant?.subscription_status === 'active' || 
                                 tenant?.subscription_status === 'trial';
  const isFreeTier = hasActiveSubscription ? false : (tenant?.is_free_tier ?? true);

  // Check if user has purchased credits AND has a positive balance
  // Users need BOTH to bypass daily/monthly limits:
  // 1. Must have made at least one purchase (hasPurchasedCredits)
  // 2. Must still have credits remaining (creditBalance > 0)
  // When credits run out, limits re-apply until they purchase again
  const { data: purchaseAndBalanceData } = useQuery({
    queryKey: queryKeys.freeTier.purchaseStatusAndBalance(tenantId),
    queryFn: async () => {
      if (!tenantId) return { hasPurchased: false, balance: 0 };

      // Check for any purchase transactions
      const { count: purchaseCount, error: purchaseError } = await supabase
        .from('credit_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('transaction_type', 'purchase');

      if (purchaseError) {
        logger.error('Failed to check purchased credits', purchaseError);
      }

      // Get current credit balance
      const { data: creditData, error: balanceError } = await supabase
        .from('tenant_credits')
        .select('balance')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (balanceError) {
        logger.error('Failed to get credit balance', balanceError);
      }

      return {
        hasPurchased: (purchaseCount ?? 0) > 0,
        balance: creditData?.balance ?? 0,
      };
    },
    enabled: !!tenantId && isFreeTier,
    staleTime: 30 * 1000, // Cache for 30 seconds (balance can change)
  });

  const hasPurchasedCredits = purchaseAndBalanceData?.hasPurchased ?? false;
  const creditBalance = purchaseAndBalanceData?.balance ?? 0;

  // Determine if limits should apply:
  // - Not free tier = no limits (paid subscription)
  // - Has purchased credits AND balance > 0 = no limits (full access)
  // - Has purchased credits but balance = 0 = limits RE-APPLY (must buy more)
  // - Free tier with only free credits = limits apply
  const hasActiveCredits = hasPurchasedCredits && creditBalance > 0;
  const limitsApply = isFreeTier && !hasActiveCredits;

  // Fetch current usage from database
  const { data: usage, isLoading } = useQuery({
    queryKey: queryKeys.freeTier.usage(tenantId),
    queryFn: async () => {
      if (!tenantId || !isFreeTier) return null;

      // Get or create usage record
      const { data, error } = await supabase
        .from('tenant_free_tier_usage')
        .select('menus_created_today, orders_created_today, sms_sent_today, emails_sent_today, pos_sales_today, bulk_operations_today, exports_this_month, invoices_this_month, custom_reports_this_month, ai_features_this_month, total_products, total_customers, total_team_members, total_locations, last_daily_reset, last_monthly_reset')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to fetch free tier usage', error);
        return null;
      }

      // If no record, return defaults (will be created on first action)
      if (!data) {
        return {
          menusCreatedToday: 0,
          ordersCreatedToday: 0,
          smsSentToday: 0,
          emailsSentToday: 0,
          posSalesToday: 0,
          bulkOperationsToday: 0,
          exportsThisMonth: 0,
          invoicesThisMonth: 0,
          customReportsThisMonth: 0,
          aiFeaturesThisMonth: 0,
          totalProducts: 0,
          totalCustomers: 0,
          totalTeamMembers: 1,
          totalLocations: 1,
          lastDailyReset: null,
          lastMonthlyReset: null,
        } as FreeTierUsage;
      }

      return {
        menusCreatedToday: data.menus_created_today ?? 0,
        ordersCreatedToday: data.orders_created_today ?? 0,
        smsSentToday: data.sms_sent_today ?? 0,
        emailsSentToday: data.emails_sent_today ?? 0,
        posSalesToday: data.pos_sales_today ?? 0,
        bulkOperationsToday: data.bulk_operations_today ?? 0,
        exportsThisMonth: data.exports_this_month ?? 0,
        invoicesThisMonth: data.invoices_this_month ?? 0,
        customReportsThisMonth: data.custom_reports_this_month ?? 0,
        aiFeaturesThisMonth: data.ai_features_this_month ?? 0,
        totalProducts: data.total_products ?? 0,
        totalCustomers: data.total_customers ?? 0,
        totalTeamMembers: data.total_team_members || 1,
        totalLocations: data.total_locations || 1,
        lastDailyReset: data.last_daily_reset,
        lastMonthlyReset: data.last_monthly_reset,
      } as FreeTierUsage;
    },
    enabled: !!tenantId && isFreeTier,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Increment usage mutation
  const incrementMutation = useMutation({
    mutationFn: async ({ actionType }: { actionType: string }) => {
      if (!tenantId) throw new Error('No tenant ID');

      const { error } = await supabase.rpc('increment_free_tier_usage', {
        p_tenant_id: tenantId,
        p_action_type: actionType,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.freeTier.usage(tenantId) });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to track usage', error, { component: 'useFreeTierLimits' });
      toast.error('Failed to track usage', { description: errorMessage });
    },
  });

  // Check if an action is allowed
  const checkLimit = useCallback((actionType: string, _count: number = 1): LimitCheckResult => {
    // If not on free tier, or has active purchased credits, everything is allowed
    // Users who buy credits get full access - they just spend their credits
    // Once credits run out, limits re-apply
    if (!limitsApply) {
      let message = 'Unlimited access';
      if (hasActiveCredits) {
        message = `Full access (${creditBalance.toLocaleString()} credits remaining)`;
      }
      return {
        allowed: true,
        currentCount: 0,
        limit: Infinity,
        remaining: Infinity,
        message,
        upgradeRequired: false,
      };
    }

    const currentUsage = usage || {
      menusCreatedToday: 0,
      ordersCreatedToday: 0,
      smsSentToday: 0,
      emailsSentToday: 0,
      posSalesToday: 0,
      bulkOperationsToday: 0,
      exportsThisMonth: 0,
      invoicesThisMonth: 0,
      customReportsThisMonth: 0,
      aiFeaturesThisMonth: 0,
      totalProducts: 0,
      totalCustomers: 0,
      totalTeamMembers: 1,
      totalLocations: 1,
    };

    // Map action types to limits and current counts
    const limitMap: Record<string, { current: number; limit: number; period: string }> = {
      // Daily limits
      'menu_create': { 
        current: currentUsage.menusCreatedToday, 
        limit: FREE_TIER_LIMITS.max_menus_per_day,
        period: 'today',
      },
      'order_create': { 
        current: currentUsage.ordersCreatedToday, 
        limit: FREE_TIER_LIMITS.max_orders_per_day,
        period: 'today',
      },
      'sms_send': { 
        current: currentUsage.smsSentToday, 
        limit: FREE_TIER_LIMITS.max_sms_per_day,
        period: 'today',
      },
      'email_send': { 
        current: currentUsage.emailsSentToday, 
        limit: FREE_TIER_LIMITS.max_emails_per_day,
        period: 'today',
      },
      'pos_sale': { 
        current: currentUsage.posSalesToday, 
        limit: FREE_TIER_LIMITS.max_pos_sales_per_day,
        period: 'today',
      },
      'bulk_operation': { 
        current: currentUsage.bulkOperationsToday, 
        limit: FREE_TIER_LIMITS.max_bulk_operations_per_day,
        period: 'today',
      },
      
      // Monthly limits
      'export': { 
        current: currentUsage.exportsThisMonth, 
        limit: FREE_TIER_LIMITS.max_exports_per_month,
        period: 'this month',
      },
      'invoice_create': { 
        current: currentUsage.invoicesThisMonth, 
        limit: FREE_TIER_LIMITS.max_invoices_per_month,
        period: 'this month',
      },
      'custom_report': { 
        current: currentUsage.customReportsThisMonth, 
        limit: FREE_TIER_LIMITS.max_custom_reports_per_month,
        period: 'this month',
      },
      'ai_feature': { 
        current: currentUsage.aiFeaturesThisMonth, 
        limit: FREE_TIER_LIMITS.max_ai_features_per_month,
        period: 'this month',
      },
      
      // Resource limits
      'product_add': { 
        current: currentUsage.totalProducts, 
        limit: FREE_TIER_LIMITS.max_products,
        period: 'total',
      },
      'customer_add': { 
        current: currentUsage.totalCustomers, 
        limit: FREE_TIER_LIMITS.max_customers,
        period: 'total',
      },
      'team_member_add': { 
        current: currentUsage.totalTeamMembers, 
        limit: FREE_TIER_LIMITS.max_team_members,
        period: 'total',
      },
      'location_add': { 
        current: currentUsage.totalLocations, 
        limit: FREE_TIER_LIMITS.max_locations,
        period: 'total',
      },
    };

    const limitInfo = limitMap[actionType];
    
    if (!limitInfo) {
      // Action not limited
      return {
        allowed: true,
        currentCount: 0,
        limit: Infinity,
        remaining: Infinity,
        message: 'Action allowed',
        upgradeRequired: false,
      };
    }

    const { current, limit, period } = limitInfo;
    const remaining = Math.max(0, limit - current);
    const allowed = current < limit;

    let message = allowed 
      ? `${remaining} remaining ${period}`
      : `Limit reached (${limit}/${period}). Upgrade for unlimited access.`;

    if (limit === 0) {
      message = 'This feature requires a paid plan';
    }

    return {
      allowed,
      currentCount: current,
      limit,
      remaining,
      message,
      upgradeRequired: !allowed,
    };
  }, [limitsApply, hasActiveCredits, creditBalance, usage]);

  // Check if a feature is blocked
  // Users with purchased credits have full access to all features
  const isFeatureBlocked = useCallback((feature: BlockedFeature): boolean => {
    if (!limitsApply) return false;
    return FREE_TIER_LIMITS.blocked_features.includes(feature);
  }, [limitsApply]);

  // Record an action (increment counter)
  // Users with active purchased credits still get tracked for analytics, but not blocked
  const recordAction = useCallback(async (actionType: string): Promise<boolean> => {
    // Skip for paid tier users
    if (!isFreeTier || !tenantId) return true;

    // Users with ACTIVE purchased credits (balance > 0) bypass limits
    // If they've exhausted their credits, limits re-apply
    if (hasActiveCredits) {
      try {
        await incrementMutation.mutateAsync({ actionType });
      } catch (error) {
        logger.error('Failed to record action', error as Error);
      }
      return true; // Always allow for users with active credits
    }

    // For free tier users without purchases (or exhausted credits), check limits
    const check = checkLimit(actionType);
    if (!check.allowed) {
      const description = hasPurchasedCredits 
        ? 'Your credits have run out. Buy more credits to restore unlimited access.'
        : 'Upgrade to a paid plan or buy credits for unlimited access';
      
      toast.error(check.message, {
        description,
        action: {
          label: hasPurchasedCredits ? 'Buy Credits' : 'Upgrade',
          onClick: () => window.location.href = `/${tenant?.slug}/admin/settings/billing`,
        },
      });
      return false;
    }

    try {
      await incrementMutation.mutateAsync({ actionType });
      return true;
    } catch (error) {
      logger.error('Failed to record action', error as Error);
      return true; // Don't block on tracking errors
    }
  }, [isFreeTier, tenantId, hasActiveCredits, hasPurchasedCredits, checkLimit, incrementMutation, tenant?.slug]);

  // Get all limits with current status
  const allLimits = useMemo(() => {
    const actions = [
      'menu_create', 'order_create', 'sms_send', 'email_send',
      'pos_sale', 'bulk_operation', 'export', 'invoice_create',
      'custom_report', 'ai_feature', 'product_add', 'customer_add',
      'team_member_add', 'location_add',
    ];

    return actions.reduce((acc, action) => {
      acc[action] = checkLimit(action);
      return acc;
    }, {} as Record<string, LimitCheckResult>);
  }, [checkLimit]);

  return {
    usage,
    isLoading,
    isFreeTier,
    hasPurchasedCredits,
    hasActiveCredits,
    creditBalance,
    limitsApply,
    checkLimit,
    isFeatureBlocked,
    recordAction,
    allLimits,
    limits: FREE_TIER_LIMITS,
  };
}

// ============================================================================
// Wrapper Component for Limit Enforcement
// ============================================================================

export interface WithFreeTierLimitProps {
  actionType: string;
  children: React.ReactNode;
  onBlocked?: () => void;
  showWarning?: boolean;
}

/**
 * HOC that shows limit warnings before an action
 */
export function useFreeTierGuard(actionType: string) {
  const { checkLimit, recordAction, limitsApply } = useFreeTierLimits();

  const canPerform = useCallback(async (): Promise<boolean> => {
    // No limits for paid users or users who purchased credits
    if (!limitsApply) return true;

    const result = checkLimit(actionType);
    
    if (!result.allowed) {
      toast.error('Daily limit reached', {
        description: result.message,
      });
      return false;
    }

    // Show warning if close to limit
    if (result.remaining <= 1 && result.remaining > 0) {
      toast.warning(`Last ${result.remaining} remaining today!`, {
        description: 'Upgrade or buy credits for unlimited access',
      });
    }

    return true;
  }, [limitsApply, actionType, checkLimit]);

  const performWithTracking = useCallback(async <T,>(
    action: () => Promise<T>
  ): Promise<T | null> => {
    const allowed = await canPerform();
    if (!allowed) return null;

    const result = await action();
    await recordAction(actionType);
    return result;
  }, [canPerform, recordAction, actionType]);

  return {
    canPerform,
    performWithTracking,
    ...checkLimit(actionType),
  };
}







