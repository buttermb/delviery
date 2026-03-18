import { logger } from '@/lib/logger';
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { businessTierToSubscriptionTier } from '@/lib/tierMapping';
import {
  CreditCard,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  Star,
  Diamond,
  Zap,
  Loader2,
  Settings,
  ArrowLeft,
  Coins,
  Sparkles,
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/formatters";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { TIER_NAMES, TIER_PRICES, getFeaturesByCategory, type SubscriptionTier } from "@/lib/featureConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { TrialBanner } from "@/components/tenant-admin/TrialBanner";
import { TrialCountdown } from "@/components/tenant-admin/TrialCountdown";
import { AddPaymentMethodDialog } from "@/components/billing/AddPaymentMethodDialog";
import { useStripeRedirectHandler } from "@/hooks/useStripeRedirectHandler";
import { IntegrationStatus } from "@/components/integrations/IntegrationStatus";
import { useCredits } from "@/hooks/useCredits";
import { CreditBalance } from "@/components/credits/CreditBalance";
import { CreditPurchaseModal } from "@/components/credits/CreditPurchaseModal";
import { FREE_TIER_MONTHLY_CREDITS, CREDIT_PACKAGES } from "@/lib/credits";
import { queryKeys } from '@/lib/queryKeys';

type Invoice = Database['public']['Tables']['invoices']['Row'];

export default function TenantAdminBillingPage() {
  const { tenant } = useTenantAdminAuth();
  const { currentTier } = useFeatureAccess();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [creditPurchaseOpen, setCreditPurchaseOpen] = useState(false);
  const navigate = useNavigate();

  // Handle Stripe redirect success
  useStripeRedirectHandler();

  // Check for Stripe success in URL params
  useEffect(() => {
    const success = searchParams.get('success');
    const paymentMethod = searchParams.get('payment_method');

    if (success === 'true' && paymentMethod === 'true') {
      logger.info('[BillingPage] Payment method added successfully via Stripe');

      toast.success('Payment Method Added', { description: 'Your payment method has been successfully added.' });

      // Clean up URL params
      setSearchParams({});

      // Refresh tenant data
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
    }
  }, [searchParams, setSearchParams, queryClient]);

  // Check Stripe configuration health
  const { data: stripeHealth } = useQuery({
    queryKey: queryKeys.stripeHealth.all,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-stripe-config');
      if (error) throw error;
      return data as { configured: boolean; valid: boolean; error?: string; testMode?: boolean };
    },
    retry: 2,
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch invoices using Edge Function
  const { data: invoices } = useQuery({
    queryKey: queryKeys.tenantInvoices.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      // Try Edge Function first
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('invoice-management', {
          body: { action: 'list', tenant_id: tenantId },
        });

        // Check for error in response body (some edge functions return 200 with error)
        if (edgeData && typeof edgeData === 'object' && 'error' in edgeData && edgeData.error) {
          const errorMessage = typeof edgeData.error === 'string' ? edgeData.error : 'Failed to load invoices';
          logger.error('Edge function returned error in response', { error: errorMessage, functionName: 'invoice-management', component: 'BillingPage' });
          throw new Error(errorMessage);
        }

        if (!edgeError && edgeData?.invoices) {
          return edgeData.invoices;
        }

        if (edgeError) {
          throw edgeError;
        }
      } catch (error) {
        logger.debug('Edge function call failed, falling back to direct query', { error, component: 'BillingPage' });
      }

      // Fallback to direct query
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, due_date, total, status")
        .eq("tenant_id", tenantId)
        .order("issue_date", { ascending: false })
        .limit(10);

      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch subscription plans
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: queryKeys.subscriptionPlans.all,
    queryFn: async () => {
      logger.info('[BillingPage] Fetching subscription plans...', { component: 'BillingPage' });

      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, display_name, description, price_monthly, is_active, limits, features')
        .eq('is_active', true)
        .order('price_monthly') as unknown as { data: Database['public']['Tables']['subscription_plans']['Row'][] | null; error: { message: string; code: string } | null };

      if (error) {
        logger.error('[BillingPage] Error fetching subscription plans:', error, { component: 'BillingPage' });
        logger.error('Failed to fetch subscription plans', error, { component: 'BillingPage' });
        throw error;
      }

      logger.info('[BillingPage] Subscription plans loaded:', { count: data?.length ?? 0, component: 'BillingPage' });
      logger.debug('[BillingPage] Plans:', { plans: data?.map(p => ({ id: p.id, name: p.name, price: p.price_monthly })), component: 'BillingPage' });

      return data ?? [];
    },
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch subscription plan details
  const { data: plan } = useQuery({
    queryKey: queryKeys.superAdminTenantDetail.subscriptionPlan(tenant?.subscription_plan),
    queryFn: async () => {
      if (!tenant?.subscription_plan) return null;

      const { data } = await supabase
        .from("subscription_plans")
        .select("id, name, display_name, description, features, price_monthly, limits")
        .eq("name", tenant.subscription_plan)
        .maybeSingle();

      return data;
    },
    enabled: !!tenant?.subscription_plan,
  });

  const limits = (tenant?.limits as Record<string, number>) || {};
  const usage = (tenant?.usage as Record<string, number>) || {};

  // Credit system hook for free tier users
  const {
    balance: creditBalance,
    isFreeTier,
    isLowCredits,
    isCriticalCredits,
    isOutOfCredits,
    nextFreeGrantAt,
    lifetimeSpent,
  } = useCredits();

  const getUsagePercentage = (resource: string) => {
    const limit = limits[resource] === -1 ? Infinity : (limits[resource] ?? 0);
    const current = usage[resource] ?? 0;
    if (limit === Infinity) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  // Subscription update mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.functions.invoke('update-subscription', {
        body: {
          tenant_id: tenant?.id,
          plan_id: planId
        }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to update subscription';
        throw new Error(errorMessage);
      }

      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        toast.success('Redirecting to Stripe', { description: 'Opening checkout in new tab...' });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
      setUpgradeDialogOpen(false);
      setUpgradeLoading(false);
    },
    onError: (error: unknown) => {
      logger.error('Error updating subscription', error, { component: 'BillingPage' });
      const errorMessage = error instanceof Error ? error.message : 'Failed to update subscription';

      // Provide specific guidance for Stripe configuration errors
      let description = errorMessage;
      if (errorMessage.includes('Invalid STRIPE_SECRET_KEY') || errorMessage.includes('secret key')) {
        description = '⚠️ Stripe is not properly configured. The secret key must start with "sk_", not "pk_". Please contact support or check your integration settings.';
      }

      toast.error('Upgrade Failed', { description });

      setUpgradeLoading(false);
    }
  });

  const handlePlanChange = async (targetPlan: SubscriptionTier, _useStripe = false) => {
    if (!tenantId) return;

    // Guard: Validate user is not already on this plan
    const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
    const currentSubscriptionTier = businessTierToSubscriptionTier(currentTier);
    const currentIndex = tierHierarchy.indexOf(currentSubscriptionTier);
    const targetIndex = tierHierarchy.indexOf(targetPlan);

    if (currentIndex === targetIndex && !isOnTrial) {
      toast.info('Already on this plan', { description: `You're already on the ${TIER_NAMES[targetPlan]} plan.` });
      return;
    }

    // Guard: Check Stripe health before proceeding
    if (!stripeHealth?.valid) {
      toast.error('Stripe Not Configured', { description: stripeHealth?.error || 'Payment processing is not available. Please contact support.' });
      return;
    }

    // Check for downgrade limits
    const targetPlanObj = subscriptionPlans.find(p => p.name.toLowerCase() === targetPlan.toLowerCase());
    if (targetPlanObj && targetPlanObj.limits) {
      const violations: string[] = [];
      const limits = targetPlanObj.limits as Record<string, number>;
      const currentUsage = usage as Record<string, number>;

      for (const [resource, limit] of Object.entries(limits)) {
        if (limit === -1) continue; // Unlimited
        const current = currentUsage[resource] ?? 0;
        if (current > limit) {
          violations.push(`${resource}: ${current} (Limit: ${limit})`);
        }
      }

      if (violations.length > 0) {
        toast.error("Cannot Downgrade Yet", {
          description: `Your current usage exceeds the limits of the ${targetPlanObj.name} plan: ${violations.join(', ')}. Please archive or delete items to proceed.`,
          duration: 10000,
        });
        return;
      }
    }

    // Show confirmation dialog
    setSelectedPlan(targetPlan);
    setUpgradeDialogOpen(true);
  };

  const confirmPlanChange = async () => {
    if (!selectedPlan || !subscriptionPlans) return;

    // Find the plan ID from the subscription plans - match by name (case-insensitive)
    const targetPlan = subscriptionPlans.find(p =>
      p.name.toLowerCase() === selectedPlan.toLowerCase()
    );

    if (!targetPlan) {
      logger.error('Plan not found:', {
        plan: selectedPlan,
        availablePlans: subscriptionPlans.map(p => ({ id: p.id, name: p.name })),
        component: 'BillingPage'
      });
      toast.error('Error', { description: `Selected plan "${selectedPlan}" not found. Available plans: ${subscriptionPlans.map(p => p.name).join(', ')}` });
      return;
    }

    setUpgradeLoading(true);
    updateSubscriptionMutation.mutate(targetPlan.id);
  };

  const handlePaymentMethod = async () => {
    if (!tenantId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not Authenticated', { description: 'Please log in to manage payment methods.' });
        return;
      }

      setUpgradeLoading(true);
      logger.info('[BillingPage] Invoking stripe-customer-portal for tenant:', { tenantId, component: 'BillingPage' });

      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
        body: { tenant_id: tenantId }
      });

      logger.info('[BillingPage] Portal response:', { data, error, component: 'BillingPage' });

      if (error) {
        logger.error('[BillingPage] Portal error:', error, { component: 'BillingPage' });
        throw error;
      }

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to open customer portal';
        logger.error('[BillingPage] Portal returned error:', { errorMessage, component: 'BillingPage' });
        throw new Error(errorMessage);
      }

      if (data?.url) {
        logger.info('[BillingPage] Opening portal URL:', { url: data.url, component: 'BillingPage' });
        window.open(data.url, '_blank', 'noopener,noreferrer');
        toast.success('Success', { description: 'Opening Stripe Customer Portal...' });
      } else {
        logger.error('[BillingPage] No URL in portal response:', data, { component: 'BillingPage' });
        throw new Error('No portal URL returned from Stripe');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open payment method management. Please ensure Stripe is configured.';
      logger.error('[BillingPage] Payment method management error:', { errorMessage, error, component: 'BillingPage' });
      toast.error('Error', { description: errorMessage });
    } finally {
      setUpgradeLoading(false);
    }
  };

  // Calculate trial days remaining
  const trialDaysRemaining = tenant?.trial_ends_at
    ? Math.ceil((new Date(tenant.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const isOnTrial = tenant?.subscription_status === 'trial';

  return (
    <div className="min-h-dvh bg-background">
      <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Back Button and Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/${tenant?.slug}/admin`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Billing & Subscription</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage your subscription, payment methods, and billing history
            </p>
          </div>
        </div>

        {/* Payment Method Missing Alert - Only show for trial users */}
        {tenant?.payment_method_added === false && tenant?.subscription_status === 'trial' && (
          <Alert className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500 border-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  ⚠️ Complete Your Trial Setup
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Add a payment method to avoid service interruption when your trial ends
                  {tenant?.trial_ends_at && ` on ${formatSmartDate(tenant.trial_ends_at)}`}.
                </p>
              </div>
              <Button
                onClick={() => setPaymentDialogOpen(true)}
                className="whitespace-nowrap bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Trial Banner */}
        {isOnTrial && tenant?.trial_ends_at && trialDaysRemaining > 0 && (
          <TrialBanner
            daysRemaining={trialDaysRemaining}
            trialEndsAt={tenant.trial_ends_at}
            tenantSlug={tenant.slug}
          />
        )}

        {/* Stripe Configuration Status */}
        {stripeHealth && !stripeHealth.valid && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>⚠️ Stripe Not Configured:</strong> {stripeHealth.error || 'Payment processing is unavailable. Upgrade and payment features are disabled.'}
            </AlertDescription>
          </Alert>
        )}

        {stripeHealth?.valid && stripeHealth.testMode && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Platform Test Mode:</strong> Subscription billing is using Stripe test mode. Use test card: 4242 4242 4242 4242
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="current" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-4 sm:w-full h-auto gap-1 sm:gap-0">
              <TabsTrigger value="current" className="min-h-[44px] touch-manipulation text-xs sm:text-sm whitespace-nowrap flex-shrink-0">Current Plan</TabsTrigger>
              <TabsTrigger value="plans" className="min-h-[44px] touch-manipulation text-xs sm:text-sm whitespace-nowrap flex-shrink-0">Compare Plans</TabsTrigger>
              <TabsTrigger value="billing" className="min-h-[44px] touch-manipulation text-xs sm:text-sm whitespace-nowrap flex-shrink-0">Billing</TabsTrigger>
              <TabsTrigger value="integrations" className="min-h-[44px] touch-manipulation text-xs sm:text-sm whitespace-nowrap flex-shrink-0">Integrations</TabsTrigger>
            </TabsList>
          </div>

          {/* CURRENT PLAN TAB */}
          <TabsContent value="current" className="space-y-6">
            {/* Trial Countdown */}
            {isOnTrial && tenant?.trial_ends_at && trialDaysRemaining > 0 && (
              <TrialCountdown trialEndsAt={tenant.trial_ends_at} />
            )}

            {/* Free Tier Credit Balance */}
            {isFreeTier && (
              <Card className="border-emerald-500/50 bg-emerald-500/5">
                <CardHeader className="p-3 sm:p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                    <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                    Credit Balance
                    <Badge variant="outline" className="ml-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      Free Tier
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-3 sm:p-4 md:p-6 pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-emerald-600">
                        {creditBalance.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        of {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} monthly credits
                      </p>
                    </div>
                    <CreditBalance variant="badge" />
                  </div>

                  {/* Credit Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Used this month</span>
                      <span className="font-medium">
                        {lifetimeSpent.toLocaleString()} credits
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${isOutOfCredits ? 'bg-red-500' :
                          isCriticalCredits ? 'bg-orange-500' :
                            isLowCredits ? 'bg-yellow-500' :
                              'bg-emerald-500'
                          }`}
                        style={{
                          width: `${Math.min(100, (creditBalance / FREE_TIER_MONTHLY_CREDITS) * 100)}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Next refresh */}
                  {nextFreeGrantAt && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        <Sparkles className="h-4 w-4 inline mr-1" />
                        Credits refresh on{' '}
                        <strong>
                          {formatSmartDate(nextFreeGrantAt)}
                        </strong>
                      </p>
                    </div>
                  )}

                  {/* Low credit warning */}
                  {(isLowCredits || isCriticalCredits || isOutOfCredits) && (
                    <Alert variant={isOutOfCredits ? 'destructive' : 'default'} className="border-amber-500/50 bg-amber-500/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {isOutOfCredits
                          ? "You're out of credits! Purchase more or upgrade to continue using all features."
                          : "Running low on credits. Consider upgrading for unlimited usage."}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Value comparison */}
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      💡 <strong>Did you know?</strong> Starter plan ($79/mo) gives you unlimited usage.
                      That's better value than buying just 2 credit packs!
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => navigate(`/${tenant?.slug}/admin/select-plan`)}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Upgrade for Unlimited
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCreditPurchaseOpen(true)}
                    >
                      <Coins className="h-4 w-4 mr-2" />
                      Buy Credits
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Credit Packages (for free tier) */}
            {isFreeTier && (
              <Card>
                <CardHeader className="p-3 sm:p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                    <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                    Credit Packages
                    <Badge variant="secondary" className="ml-2">Pay As You Go</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                  <p className="text-sm text-muted-foreground mb-4">
                    Need more credits? Purchase a pack anytime. No commitment required.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {CREDIT_PACKAGES.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="relative border rounded-lg p-3 text-center hover:border-purple-500/50 transition-colors cursor-pointer"
                        onClick={() => setCreditPurchaseOpen(true)}
                      >
                        {pkg.badge && (
                          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs">
                            {pkg.badge}
                          </Badge>
                        )}
                        <div className="text-xl font-bold text-purple-600 mt-2">
                          {pkg.credits.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">credits</div>
                        <div className="font-semibold">${(pkg.priceCents / 100).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    ⚠️ Credit packs cost more per-action than subscription plans
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Current Plan */}
            <Card>
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-3 sm:p-4 md:p-6 pt-0">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">
                      {plan?.display_name || (tenant?.subscription_plan as string)?.toUpperCase() || "No Plan"}
                    </span>
                    <Badge variant="outline">
                      {formatCurrency((tenant?.mrr as number) ?? 0)}/month
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {plan?.description || "Your current subscription plan"}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Subscriptions auto-renew monthly/yearly. Cancel anytime before renewal date.
                  </p>

                  {/* Platform Fee Notice */}
                  <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-purple-900 dark:text-purple-100">
                      💎 <strong>Platform Fee:</strong> {formatCurrency(((tenant?.mrr as number) ?? 0) * 0.02)}/month (2% of subscription)
                    </p>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      This fee covers platform hosting, maintenance, and support
                    </p>
                  </div>

                  {plan?.features && Array.isArray(plan.features) && (
                    <div className="space-y-2 mb-4">
                      {plan.features.map((feature: string, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>{feature.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => document.querySelector('[data-value="plans"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>
                      ⬆️ View Plans
                    </Button>
                    <Button
                      variant="default"
                      onClick={handlePaymentMethod}
                      disabled={upgradeLoading}
                    >
                      {upgradeLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Settings className="h-4 w-4 mr-2" />
                      )}
                      Manage Subscription
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage This Month */}
            <Card>
              <CardHeader>
                <CardTitle>📊 Usage This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(limits).length > 0 ? (
                  Object.keys(limits).map((resource) => {
                    const limit = limits[resource];
                    const current = usage[resource] ?? 0;
                    const isUnlimited = limit === -1;
                    const percentage = getUsagePercentage(resource);
                    const isOverLimit = !isUnlimited && current > limit;

                    return (
                      <div key={resource} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{resource.replace(/_/g, " ")}</span>
                          <span className={isOverLimit ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                            {current.toLocaleString()} / {isUnlimited ? "Unlimited" : limit.toLocaleString()}
                            {!isUnlimited && ` (${percentage.toFixed(0)}%)`}
                          </span>
                        </div>
                        {!isUnlimited && (
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isOverLimit
                                ? "bg-red-500"
                                : percentage > 80
                                  ? "bg-yellow-500"
                                  : "bg-primary"
                                }`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        )}
                        {isOverLimit && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Over limit! Overage charges may apply.
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-4">No usage limits configured</p>
                )}

                {usage?.customers && limits?.customers && usage.customers > limits.customers && (
                  <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500 border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Overage Charges</p>
                      </div>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>{formatCurrency(
                          ((usage.customers - limits.customers) * 0.50)
                        )}</strong> for exceeding customer limit
                      </p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(tenant?.payment_method_added as boolean) ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Payment method on file</p>
                        <p className="text-sm text-muted-foreground">Visa ending in 4242</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handlePaymentMethod} disabled={upgradeLoading}>
                      {upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Update Payment Method
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">No payment method added</p>
                    <Button onClick={() => setPaymentDialogOpen(true)}>
                      Add Payment Method
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPARE PLANS TAB */}
          <TabsContent value="plans" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Starter Plan */}
              <Card className={businessTierToSubscriptionTier(currentTier) === 'starter' ? 'border-2 border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="h-8 w-8 text-green-600" />
                    {businessTierToSubscriptionTier(currentTier) === 'starter' && <Badge>Current</Badge>}
                  </div>
                  <CardTitle className="text-2xl">Starter</CardTitle>
                  <div className="text-3xl font-bold">${TIER_PRICES.starter}<span className="text-sm text-muted-foreground">/mo</span></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Perfect for small businesses getting started</p>
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Includes:</p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>50 customers</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>3 menus</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>100 products</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>12 core features</span>
                      </li>
                    </ul>
                  </div>
                  <Button
                    variant={businessTierToSubscriptionTier(currentTier) === 'starter' ? 'outline' : 'default'}
                    className="w-full"
                    disabled={businessTierToSubscriptionTier(currentTier) === 'starter' || upgradeLoading}
                    onClick={() => businessTierToSubscriptionTier(currentTier) !== 'starter' && handlePlanChange('starter')}
                  >
                    {businessTierToSubscriptionTier(currentTier) === 'starter' ? 'Current Plan' : upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {businessTierToSubscriptionTier(currentTier) === 'starter' ? 'Current Plan' : 'Downgrade'}
                  </Button>
                </CardContent>
              </Card>

              {/* Professional Plan */}
              <Card className={businessTierToSubscriptionTier(currentTier) === 'professional' ? 'border-2 border-primary' : 'border-2 border-blue-500/50'}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Star className="h-8 w-8 text-blue-600" />
                    {businessTierToSubscriptionTier(currentTier) === 'professional' && <Badge>Current</Badge>}
                  </div>
                  <CardTitle className="text-2xl">Professional</CardTitle>
                  <div className="text-3xl font-bold">${TIER_PRICES.professional}<span className="text-sm text-muted-foreground">/mo</span></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">For growing businesses with advanced needs</p>
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Everything in Starter, plus:</p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>200 customers</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>10 menus</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>500 products</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>31 total features</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>Advanced analytics</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>Team management</span>
                      </li>
                    </ul>
                  </div>
                  <Button
                    variant={businessTierToSubscriptionTier(currentTier) === 'professional' ? 'outline' : 'default'}
                    className="w-full"
                    disabled={businessTierToSubscriptionTier(currentTier) === 'professional' || upgradeLoading}
                    onClick={() => businessTierToSubscriptionTier(currentTier) !== 'professional' && handlePlanChange('professional')}
                  >
                    {upgradeLoading && selectedPlan === 'professional' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {businessTierToSubscriptionTier(currentTier) === 'professional' ? 'Current Plan' : businessTierToSubscriptionTier(currentTier) === 'starter' ? 'Upgrade' : 'Downgrade'}
                  </Button>
                </CardContent>
              </Card>

              {/* Enterprise Plan */}
              <Card className={businessTierToSubscriptionTier(currentTier) === 'enterprise' ? 'border-2 border-primary' : 'border-2 border-purple-500/50'}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Diamond className="h-8 w-8 text-purple-600" />
                    {businessTierToSubscriptionTier(currentTier) === 'enterprise' && <Badge>Current</Badge>}
                  </div>
                  <CardTitle className="text-2xl">Enterprise</CardTitle>
                  <div className="text-3xl font-bold">${TIER_PRICES.enterprise}+<span className="text-sm text-muted-foreground">/mo</span></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Complete solution for large operations</p>
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Everything in Professional, plus:</p>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>Unlimited everything</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>All 56 features</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>Fleet management</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>POS system</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>API access</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span>24/7 priority support</span>
                      </li>
                    </ul>
                  </div>
                  <Button
                    variant={businessTierToSubscriptionTier(currentTier) === 'enterprise' ? 'outline' : 'default'}
                    className="w-full"
                    disabled={businessTierToSubscriptionTier(currentTier) === 'enterprise' || upgradeLoading}
                    onClick={() => businessTierToSubscriptionTier(currentTier) !== 'enterprise' && handlePlanChange('enterprise')}
                  >
                    {upgradeLoading && selectedPlan === 'enterprise' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {businessTierToSubscriptionTier(currentTier) === 'enterprise' ? 'Current Plan' : 'Upgrade'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Feature Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Full Feature Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(getFeaturesByCategory()).map(([category, features]) => (
                    <div key={category}>
                      <h3 className="font-semibold text-lg mb-3">{category}</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="font-medium text-sm text-muted-foreground">Feature</div>
                        <div className="font-medium text-sm text-muted-foreground text-center">Starter</div>
                        <div className="font-medium text-sm text-muted-foreground text-center">Professional</div>
                        <div className="font-medium text-sm text-muted-foreground text-center">Enterprise</div>

                        {features.map((feature, idx) => (
                          <React.Fragment key={`${feature.name}-${idx}`}>
                            <div className="text-sm py-2">{feature.name}</div>
                            <div className="text-center py-2">
                              {feature.tier === 'starter' || feature.tier === 'professional' || feature.tier === 'enterprise' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-center py-2">
                              {feature.tier === 'professional' || feature.tier === 'enterprise' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : feature.tier === 'starter' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-center py-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BILLING HISTORY TAB */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>📄 Billing History</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices && invoices.length > 0 ? (
                  <div className="space-y-2">
                    {invoices.map((invoice: Invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="font-medium">{invoice.invoice_number || `Invoice #${invoice.id.slice(0, 8)}`}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatSmartDate(invoice.issue_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(invoice.total ?? 0)}</p>
                          <Badge
                            variant={invoice.status === "paid" ? "default" : "outline"}
                          >
                            {invoice.status?.toUpperCase() || "PENDING"}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="View invoice"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No invoices yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Footer Note */}
            <Card>
              <CardContent className="text-center text-sm text-muted-foreground p-4">
                <p className="mb-1">Billing is managed by the platform administrator.</p>
                <p>For changes to your subscription, please contact support.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INTEGRATIONS TAB */}
          <TabsContent value="integrations" className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Payment Integrations</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage your payment processing connections and test their status
                </p>
              </div>

              <IntegrationStatus
                name="Stripe Payment Processing"
                description="Platform-wide Stripe integration for subscription billing"
                status={
                  !stripeHealth
                    ? "checking"
                    : stripeHealth.valid
                      ? "connected"
                      : "error"
                }
                error={stripeHealth?.valid === false ? stripeHealth.error : undefined}
                onTest={async () => {
                  // Re-check Stripe configuration
                  const { data, error } = await supabase.functions.invoke('check-stripe-config');
                  if (error) throw error;
                  if (!data?.valid) throw new Error(data?.error || 'Stripe configuration is invalid');
                }}
                testButtonLabel="Test Stripe Connection"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Upgrade/Downgrade Confirmation Dialog */}
        <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedPlan && currentTier &&
                  (['starter', 'professional', 'enterprise'].indexOf(selectedPlan) > ['starter', 'professional', 'enterprise'].indexOf(currentTier)
                    ? 'Confirm Upgrade'
                    : 'Confirm Downgrade')
                }
              </DialogTitle>
              <DialogDescription>
                {selectedPlan && currentTier && (
                  <>
                    You are about to {['starter', 'professional', 'enterprise'].indexOf(selectedPlan) > ['starter', 'professional', 'enterprise'].indexOf(currentTier) ? 'upgrade' : 'downgrade'} from{' '}
                    <strong>{TIER_NAMES[currentTier]}</strong> to <strong>{TIER_NAMES[selectedPlan]}</strong> plan.
                    <br /><br />
                    {['starter', 'professional', 'enterprise'].indexOf(selectedPlan) > ['starter', 'professional', 'enterprise'].indexOf(currentTier) ? (
                      <>
                        New monthly price: <strong>{formatCurrency(TIER_PRICES[selectedPlan])}</strong>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Your subscription will be updated immediately.
                        </span>
                      </>
                    ) : (
                      <>
                        Your plan will be changed to <strong>{TIER_NAMES[selectedPlan]}</strong>.
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Changes will be effective immediately.
                        </span>
                        Some features may become unavailable after downgrade.
                      </>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setUpgradeDialogOpen(false);
                setSelectedPlan(null);
                setUpgradeLoading(false);
              }} disabled={upgradeLoading}>
                Cancel
              </Button>
              <Button onClick={confirmPlanChange} disabled={upgradeLoading || !selectedPlan}>
                {upgradeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AddPaymentMethodDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        tenantId={tenantId ?? ''}
      />

      {/* Credit Purchase Modal */}
      {isFreeTier && (
        <CreditPurchaseModal
          open={creditPurchaseOpen}
          onOpenChange={setCreditPurchaseOpen}
        />
      )}
    </div >
  );
}
