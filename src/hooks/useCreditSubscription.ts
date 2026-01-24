/**
 * useCreditSubscription Hook
 *
 * Manages subscription state and lifecycle for the credit system.
 * Provides subscribe, cancel, pause, resume functions via mutations.
 * Tracks subscription status and renewal date.
 * Calculates credits remaining this period.
 * Handles upgrade and downgrade flows.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import {
  SUBSCRIPTION_PLANS,
  PLAN_FEATURES,
  type SubscriptionPlan,
} from '@/utils/subscriptionPlans';
import {
  SUBSCRIPTION_STATUS,
  isActiveSubscription,
  isCancelled,
  isTrial,
  getSubscriptionStatusLabel,
  type SubscriptionStatus,
} from '@/utils/subscriptionStatus';

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionInfo {
  id: string;
  planId: string;
  planName: string;
  displayName: string;
  status: SubscriptionStatus | string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt: Date | null;
  cancelledAt: Date | null;
  stripeSubscriptionId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface SubscriptionPlanInfo {
  id: string;
  name: string;
  displayName: string | null;
  price: number;
  priceMonthly: number | null;
  priceYearly: number | null;
  features: Record<string, unknown> | null;
  limits: Record<string, unknown> | null;
  stripePriceId: string | null;
  stripePriceIdYearly: string | null;
}

export interface CreditPeriodInfo {
  creditsUsedThisPeriod: number;
  creditsRemainingThisPeriod: number;
  periodStartDate: Date;
  periodEndDate: Date;
  daysRemainingInPeriod: number;
  dailyBurnRate: number;
  projectedEndOfPeriodBalance: number;
}

export interface SubscribeParams {
  planId: string;
  billingCycle?: 'monthly' | 'yearly';
}

export interface UpgradeDowngradeParams {
  newPlanId: string;
  immediate?: boolean;
}

export interface UseCreditSubscriptionReturn {
  // Subscription state
  subscription: SubscriptionInfo | null;
  currentPlan: SubscriptionPlanInfo | null;
  availablePlans: SubscriptionPlanInfo[];
  isLoading: boolean;
  error: Error | null;

  // Status flags
  isActive: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  isTrial: boolean;
  isPastDue: boolean;
  isFreeTier: boolean;

  // Renewal / period info
  renewalDate: Date | null;
  statusLabel: string;

  // Credits remaining this period
  creditPeriodInfo: CreditPeriodInfo | null;

  // Mutations
  subscribe: (params: SubscribeParams) => void;
  cancel: (reason?: string) => void;
  pause: () => void;
  resume: () => void;
  upgrade: (params: UpgradeDowngradeParams) => void;
  downgrade: (params: UpgradeDowngradeParams) => void;

  // Mutation states
  isSubscribing: boolean;
  isCancelling: boolean;
  isPausing: boolean;
  isResuming: boolean;
  isChangingPlan: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SUBSCRIPTION_QUERY_KEY = 'subscriptions';
const SUBSCRIPTION_PLANS_QUERY_KEY = 'subscription-plans';

// Credits included per plan per period (monthly)
const PLAN_CREDITS_PER_PERIOD: Record<string, number> = {
  [SUBSCRIPTION_PLANS.STARTER]: 500,
  [SUBSCRIPTION_PLANS.PROFESSIONAL]: 10000,
  [SUBSCRIPTION_PLANS.ENTERPRISE]: 50000,
};

// ============================================================================
// Helper Functions
// ============================================================================

function mapSubscriptionRow(row: {
  id: string;
  plan_id: string;
  status: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at: string | null;
  cancelled_at: string | null;
  stripe_subscription_id: string | null;
  metadata: unknown;
}): SubscriptionInfo {
  const planKey = Object.entries(PLAN_FEATURES).find(
    ([, plan]) => plan.displayName.toLowerCase() === row.plan_id?.toLowerCase()
  );

  return {
    id: row.id,
    planId: row.plan_id,
    planName: planKey ? planKey[0] : row.plan_id,
    displayName: planKey ? planKey[1].displayName : row.plan_id,
    status: (row.status ?? SUBSCRIPTION_STATUS.ACTIVE) as SubscriptionStatus,
    currentPeriodStart: new Date(row.current_period_start),
    currentPeriodEnd: new Date(row.current_period_end),
    cancelAt: row.cancel_at ? new Date(row.cancel_at) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    stripeSubscriptionId: row.stripe_subscription_id,
    metadata: row.metadata as Record<string, unknown> | null,
  };
}

function mapPlanRow(row: {
  id: string;
  name: string;
  display_name: string | null;
  price: number;
  price_monthly: number | null;
  price_yearly: number | null;
  features: unknown;
  limits: unknown;
  stripe_price_id: string | null;
  stripe_price_id_yearly: string | null;
}): SubscriptionPlanInfo {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    price: row.price,
    priceMonthly: row.price_monthly,
    priceYearly: row.price_yearly,
    features: row.features as Record<string, unknown> | null,
    limits: row.limits as Record<string, unknown> | null,
    stripePriceId: row.stripe_price_id,
    stripePriceIdYearly: row.stripe_price_id_yearly,
  };
}

function getDaysRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getDaysElapsed(startDate: Date): number {
  const now = new Date();
  const diff = now.getTime() - startDate.getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCreditSubscription(): UseCreditSubscriptionReturn {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // ---- Fetch current subscription ----
  const {
    data: subscriptionData,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
  } = useQuery({
    queryKey: [SUBSCRIPTION_QUERY_KEY, tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Get the account for this tenant first
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (accountError) {
        logger.error('Failed to fetch account for subscription', { error: accountError, tenantId }, 'useCreditSubscription');
        throw new Error(accountError.message);
      }

      if (!account) {
        logger.debug('No account found for tenant', { tenantId }, 'useCreditSubscription');
        return null;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch subscription', { error, tenantId }, 'useCreditSubscription');
        throw new Error(error.message);
      }

      return data ? mapSubscriptionRow(data) : null;
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // ---- Fetch available plans ----
  const {
    data: plansData,
    isLoading: isLoadingPlans,
    error: plansError,
  } = useQuery({
    queryKey: [SUBSCRIPTION_PLANS_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        logger.error('Failed to fetch subscription plans', { error }, 'useCreditSubscription');
        throw new Error(error.message);
      }

      return (data ?? []).map(mapPlanRow);
    },
    staleTime: 5 * 60 * 1000, // Plans rarely change
  });

  // ---- Fetch credit balance for period calculation ----
  const { data: creditData } = useQuery({
    queryKey: ['credits', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenant_credits')
        .select('balance, lifetime_earned, lifetime_spent, last_refill_at, next_refill_at')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.warn('Failed to fetch tenant credits for period calc', { error, tenantId }, 'useCreditSubscription');
        return null;
      }

      return data;
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  // ---- Derived status flags ----
  const subscription = subscriptionData ?? null;
  const tenantPlan = tenant?.subscription_plan?.toLowerCase() ?? SUBSCRIPTION_PLANS.STARTER;
  const tenantStatus = tenant?.subscription_status?.toLowerCase() ?? SUBSCRIPTION_STATUS.ACTIVE;
  const isFreeTier = tenant?.is_free_tier ?? true;

  const isActive = isActiveSubscription(subscription?.status ?? tenantStatus);
  const isPaused = (subscription?.status ?? tenantStatus) === SUBSCRIPTION_STATUS.SUSPENDED;
  const isCancelledStatus = isCancelled(subscription?.status ?? tenantStatus);
  const isTrialStatus = isTrial(subscription?.status ?? tenantStatus);
  const isPastDue = (subscription?.status ?? tenantStatus) === SUBSCRIPTION_STATUS.PAST_DUE;

  const renewalDate = useMemo(() => {
    if (subscription?.currentPeriodEnd) {
      return subscription.currentPeriodEnd;
    }
    return null;
  }, [subscription]);

  const statusLabel = getSubscriptionStatusLabel(subscription?.status ?? tenantStatus);

  // ---- Current plan info ----
  const currentPlan = useMemo(() => {
    if (!plansData) return null;
    const planId = subscription?.planId ?? tenantPlan;
    return plansData.find(p => p.name.toLowerCase() === planId.toLowerCase()
      || p.id === planId) ?? null;
  }, [plansData, subscription, tenantPlan]);

  // ---- Credits remaining this period ----
  const creditPeriodInfo = useMemo((): CreditPeriodInfo | null => {
    if (!subscription && !creditData) return null;

    const periodStart = subscription?.currentPeriodStart ?? (
      creditData?.last_refill_at ? new Date(creditData.last_refill_at) : new Date()
    );
    const periodEnd = subscription?.currentPeriodEnd ?? (
      creditData?.next_refill_at ? new Date(creditData.next_refill_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    const balance = creditData?.balance ?? 0;
    const creditsPerPeriod = PLAN_CREDITS_PER_PERIOD[tenantPlan] ?? PLAN_CREDITS_PER_PERIOD[SUBSCRIPTION_PLANS.STARTER];
    const daysElapsed = getDaysElapsed(periodStart);
    const daysRemaining = getDaysRemaining(periodEnd);
    const totalPeriodDays = daysElapsed + daysRemaining;

    // Calculate usage this period (credits allocated minus remaining balance)
    const creditsUsedThisPeriod = Math.max(0, creditsPerPeriod - balance);
    const dailyBurnRate = daysElapsed > 0 ? creditsUsedThisPeriod / daysElapsed : 0;
    const projectedEndOfPeriodBalance = Math.max(0, balance - (dailyBurnRate * daysRemaining));

    return {
      creditsUsedThisPeriod,
      creditsRemainingThisPeriod: Math.max(0, balance),
      periodStartDate: periodStart instanceof Date ? periodStart : new Date(periodStart),
      periodEndDate: periodEnd instanceof Date ? periodEnd : new Date(periodEnd),
      daysRemainingInPeriod: daysRemaining,
      dailyBurnRate: Math.round(dailyBurnRate * 10) / 10,
      projectedEndOfPeriodBalance: Math.round(projectedEndOfPeriodBalance),
    };
  }, [subscription, creditData, tenantPlan]);

  // ---- Log subscription event helper ----
  const logSubscriptionEvent = useCallback(async (
    eventType: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!tenantId) return;
    try {
      await supabase
        .from('subscription_events')
        .insert({
          tenant_id: tenantId,
          event_type: eventType,
          metadata: metadata ?? null,
        });
    } catch (err) {
      logger.warn('Failed to log subscription event', { eventType, err }, 'useCreditSubscription');
    }
  }, [tenantId]);

  // ---- Invalidate subscription queries ----
  const invalidateSubscriptionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [SUBSCRIPTION_QUERY_KEY, tenantId] });
    queryClient.invalidateQueries({ queryKey: ['credits', tenantId] });
  }, [queryClient, tenantId]);

  // ---- Subscribe Mutation ----
  const subscribeMutation = useMutation({
    mutationFn: async (params: SubscribeParams) => {
      if (!tenantId) throw new Error('No tenant found');

      // Get or create account
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (accountError) throw new Error(accountError.message);
      if (!account) throw new Error('No account found for tenant');

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + (params.billingCycle === 'yearly' ? 12 : 1));

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          account_id: account.id,
          plan_id: params.planId,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          metadata: { billing_cycle: params.billingCycle ?? 'monthly' },
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Update tenant subscription fields
      await supabase
        .from('tenants')
        .update({
          subscription_plan: params.planId,
          subscription_status: SUBSCRIPTION_STATUS.ACTIVE,
          is_free_tier: false,
        })
        .eq('id', tenantId);

      await logSubscriptionEvent('subscribed', {
        plan_id: params.planId,
        billing_cycle: params.billingCycle ?? 'monthly',
      });

      return data;
    },
    onSuccess: () => {
      invalidateSubscriptionQueries();
      toast.success('Subscription activated', {
        description: 'Your subscription is now active.',
      });
    },
    onError: (error: Error) => {
      logger.error('Subscribe failed', { error }, 'useCreditSubscription');
      toast.error('Subscription failed', {
        description: error.message,
      });
    },
  });

  // ---- Cancel Mutation ----
  const cancelMutation = useMutation({
    mutationFn: async (reason?: string) => {
      if (!tenantId || !subscription) throw new Error('No active subscription');

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: SUBSCRIPTION_STATUS.CANCELLED,
          cancelled_at: now,
          cancel_at: subscription.currentPeriodEnd.toISOString(),
        })
        .eq('id', subscription.id);

      if (error) throw new Error(error.message);

      // Update tenant status - remains active until period end
      await supabase
        .from('tenants')
        .update({
          subscription_status: SUBSCRIPTION_STATUS.CANCELLED,
          cancellation_reason: reason ?? null,
          cancellation_requested_at: now,
        })
        .eq('id', tenantId);

      await logSubscriptionEvent('cancelled', {
        reason,
        effective_at: subscription.currentPeriodEnd.toISOString(),
      });
    },
    onSuccess: () => {
      invalidateSubscriptionQueries();
      toast.success('Subscription cancelled', {
        description: 'Your subscription will remain active until the end of the current billing period.',
      });
    },
    onError: (error: Error) => {
      logger.error('Cancel subscription failed', { error }, 'useCreditSubscription');
      toast.error('Cancellation failed', {
        description: error.message,
      });
    },
  });

  // ---- Pause Mutation ----
  const pauseMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !subscription) throw new Error('No active subscription');

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: SUBSCRIPTION_STATUS.SUSPENDED,
          metadata: {
            ...(subscription.metadata ?? {}),
            paused_at: new Date().toISOString(),
            status_before_pause: subscription.status,
          },
        })
        .eq('id', subscription.id);

      if (error) throw new Error(error.message);

      await supabase
        .from('tenants')
        .update({ subscription_status: SUBSCRIPTION_STATUS.SUSPENDED })
        .eq('id', tenantId);

      await logSubscriptionEvent('paused', {
        previous_status: subscription.status,
      });
    },
    onSuccess: () => {
      invalidateSubscriptionQueries();
      toast.success('Subscription paused', {
        description: 'Your subscription has been paused. You can resume anytime.',
      });
    },
    onError: (error: Error) => {
      logger.error('Pause subscription failed', { error }, 'useCreditSubscription');
      toast.error('Pause failed', {
        description: error.message,
      });
    },
  });

  // ---- Resume Mutation ----
  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !subscription) throw new Error('No paused subscription');

      const previousStatus = (subscription.metadata as Record<string, unknown>)?.status_before_pause as string ?? SUBSCRIPTION_STATUS.ACTIVE;

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: previousStatus,
          metadata: {
            ...(subscription.metadata ?? {}),
            resumed_at: new Date().toISOString(),
            paused_at: undefined,
            status_before_pause: undefined,
          },
        })
        .eq('id', subscription.id);

      if (error) throw new Error(error.message);

      await supabase
        .from('tenants')
        .update({ subscription_status: previousStatus })
        .eq('id', tenantId);

      await logSubscriptionEvent('resumed', {
        previous_status: SUBSCRIPTION_STATUS.SUSPENDED,
        restored_status: previousStatus,
      });
    },
    onSuccess: () => {
      invalidateSubscriptionQueries();
      toast.success('Subscription resumed', {
        description: 'Your subscription is active again.',
      });
    },
    onError: (error: Error) => {
      logger.error('Resume subscription failed', { error }, 'useCreditSubscription');
      toast.error('Resume failed', {
        description: error.message,
      });
    },
  });

  // ---- Upgrade Mutation ----
  const upgradeMutation = useMutation({
    mutationFn: async (params: UpgradeDowngradeParams) => {
      if (!tenantId || !subscription) throw new Error('No active subscription');

      const now = new Date();
      const updateData: Record<string, unknown> = {
        plan_id: params.newPlanId,
        metadata: {
          ...(subscription.metadata ?? {}),
          previous_plan: subscription.planId,
          upgraded_at: now.toISOString(),
          upgrade_immediate: params.immediate ?? true,
        },
      };

      // Immediate upgrade resets the period
      if (params.immediate !== false) {
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        updateData.current_period_start = now.toISOString();
        updateData.current_period_end = periodEnd.toISOString();
      }

      const { error } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscription.id);

      if (error) throw new Error(error.message);

      // Update tenant plan
      await supabase
        .from('tenants')
        .update({
          subscription_plan: params.newPlanId,
          is_free_tier: false,
        })
        .eq('id', tenantId);

      await logSubscriptionEvent('upgraded', {
        from_plan: subscription.planId,
        to_plan: params.newPlanId,
        immediate: params.immediate ?? true,
      });
    },
    onSuccess: () => {
      invalidateSubscriptionQueries();
      toast.success('Plan upgraded', {
        description: 'Your plan has been upgraded. New credits will be available shortly.',
      });
    },
    onError: (error: Error) => {
      logger.error('Upgrade subscription failed', { error }, 'useCreditSubscription');
      toast.error('Upgrade failed', {
        description: error.message,
      });
    },
  });

  // ---- Downgrade Mutation ----
  const downgradeMutation = useMutation({
    mutationFn: async (params: UpgradeDowngradeParams) => {
      if (!tenantId || !subscription) throw new Error('No active subscription');

      // Downgrades take effect at end of current period by default
      const effectiveAt = params.immediate
        ? new Date().toISOString()
        : subscription.currentPeriodEnd.toISOString();

      const { error } = await supabase
        .from('subscriptions')
        .update({
          metadata: {
            ...(subscription.metadata ?? {}),
            downgrade_pending: !params.immediate,
            downgrade_to_plan: params.newPlanId,
            downgrade_effective_at: effectiveAt,
            previous_plan: subscription.planId,
          },
          ...(params.immediate ? { plan_id: params.newPlanId } : {}),
        })
        .eq('id', subscription.id);

      if (error) throw new Error(error.message);

      // Only update tenant immediately if immediate downgrade
      if (params.immediate) {
        const isStarter = params.newPlanId.toLowerCase() === SUBSCRIPTION_PLANS.STARTER;
        await supabase
          .from('tenants')
          .update({
            subscription_plan: params.newPlanId,
            is_free_tier: isStarter,
          })
          .eq('id', tenantId);
      }

      await logSubscriptionEvent('downgraded', {
        from_plan: subscription.planId,
        to_plan: params.newPlanId,
        immediate: params.immediate ?? false,
        effective_at: effectiveAt,
      });
    },
    onSuccess: (_data, variables) => {
      invalidateSubscriptionQueries();
      const message = variables.immediate
        ? 'Your plan has been downgraded immediately.'
        : 'Your plan will be downgraded at the end of the current billing period.';
      toast.success('Plan downgrade scheduled', { description: message });
    },
    onError: (error: Error) => {
      logger.error('Downgrade subscription failed', { error }, 'useCreditSubscription');
      toast.error('Downgrade failed', {
        description: error.message,
      });
    },
  });

  // ---- Public API ----
  return {
    // Subscription state
    subscription,
    currentPlan,
    availablePlans: plansData ?? [],
    isLoading: isLoadingSubscription || isLoadingPlans,
    error: (subscriptionError ?? plansError) as Error | null,

    // Status flags
    isActive,
    isPaused,
    isCancelled: isCancelledStatus,
    isTrial: isTrialStatus,
    isPastDue,
    isFreeTier,

    // Renewal / period info
    renewalDate,
    statusLabel,

    // Credits remaining this period
    creditPeriodInfo,

    // Mutations
    subscribe: (params: SubscribeParams) => subscribeMutation.mutate(params),
    cancel: (reason?: string) => cancelMutation.mutate(reason),
    pause: () => pauseMutation.mutate(),
    resume: () => resumeMutation.mutate(),
    upgrade: (params: UpgradeDowngradeParams) => upgradeMutation.mutate(params),
    downgrade: (params: UpgradeDowngradeParams) => downgradeMutation.mutate(params),

    // Mutation states
    isSubscribing: subscribeMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isChangingPlan: upgradeMutation.isPending || downgradeMutation.isPending,
  };
}
