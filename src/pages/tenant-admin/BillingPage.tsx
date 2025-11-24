import { logger } from '@/lib/logger';
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { TIER_NAMES, TIER_PRICES, getFeaturesForTier, getFeaturesByCategory, type SubscriptionTier } from "@/lib/featureConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { TrialBanner } from "@/components/tenant-admin/TrialBanner";
import { TrialCountdown } from "@/components/tenant-admin/TrialCountdown";

type Invoice = Database['public']['Tables']['invoices']['Row'];
type InvoiceLineItem = {
  description?: string;
  name?: string;
  quantity?: number;
  amount?: number;
  total?: number;
};

export default function TenantAdminBillingPage() {
  const { tenant, admin } = useTenantAdminAuth();
  const { currentTier, currentTierName } = useFeatureAccess();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Check Stripe configuration health
  const { data: stripeHealth } = useQuery({
    queryKey: ['stripe-health'],
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
    queryKey: ["tenant-invoices", tenantId],
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
        .select("*")
        .eq("tenant_id", tenantId)
        .order("issue_date", { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch subscription plans
  // @ts-ignore - Complex query return type
  const { data: subscriptionPlans = [], isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      console.log('[BillingPage] Fetching subscription plans...');
      
      // @ts-ignore - Deep instantiation error from Supabase types
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly');
      
      if (error) {
        console.error('[BillingPage] Error fetching subscription plans:', error);
        logger.error('Failed to fetch subscription plans', error, { component: 'BillingPage' });
        throw error;
      }
      
      console.log('[BillingPage] Subscription plans loaded:', data?.length || 0, 'plans');
      console.log('[BillingPage] Plans:', data?.map(p => ({ id: p.id, name: p.name, price: p.price_monthly })));
      
      return data || [];
    },
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch subscription plan details
  const { data: plan } = useQuery({
    queryKey: ["subscription-plan", tenant?.subscription_plan],
    queryFn: async () => {
      if (!tenant?.subscription_plan) return null;

      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("name", tenant.subscription_plan)
        .maybeSingle();

      return data;
    },
    enabled: !!tenant?.subscription_plan,
  });

  const limits = (tenant?.limits as Record<string, number>) || {};
  const usage = (tenant?.usage as Record<string, number>) || {};

  const getUsagePercentage = (resource: string) => {
    const limit = limits[resource] === -1 ? Infinity : (limits[resource] || 0);
    const current = usage[resource] || 0;
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
        window.open(data.url, '_blank');
        toast({
          title: 'Redirecting to Stripe',
          description: 'Opening checkout in new tab...',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
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
      
      toast({
        title: 'Upgrade Failed',
        description,
        variant: 'destructive',
      });
      
      setUpgradeLoading(false);
    }
  });

  const handlePlanChange = async (targetPlan: SubscriptionTier, useStripe = false) => {
    if (!tenantId) return;

    // Check Stripe health before proceeding
    if (!stripeHealth?.valid) {
      toast({
        title: 'Stripe Not Configured',
        description: stripeHealth?.error || 'Payment processing is not available. Please contact support.',
        variant: 'destructive',
      });
      return;
    }

    const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
    const currentIndex = tierHierarchy.indexOf(currentTier);
    const targetIndex = tierHierarchy.indexOf(targetPlan);

    if (currentIndex === targetIndex) {
      toast({
        title: 'Already on this plan',
        description: `You're already on the ${TIER_NAMES[targetPlan]} plan.`,
      });
      return;
    }

    const isUpgrade = targetIndex > currentIndex;
    const action = isUpgrade ? 'upgrade' : 'downgrade';

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
      console.error('Plan not found:', { 
        selectedPlan, 
        availablePlans: subscriptionPlans.map(p => ({ id: p.id, name: p.name }))
      });
      toast({
        title: 'Error',
        description: `Selected plan "${selectedPlan}" not found. Available plans: ${subscriptionPlans.map(p => p.name).join(', ')}`,
        variant: 'destructive',
      });
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
        toast({
          title: 'Not Authenticated',
          description: 'Please log in to manage payment methods.',
          variant: 'destructive',
        });
        return;
      }

      setUpgradeLoading(true);
      console.log('[BillingPage] Invoking stripe-customer-portal for tenant:', tenantId);

      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
        body: { tenant_id: tenantId }
      });

      console.log('[BillingPage] Portal response:', { data, error });

      if (error) {
        console.error('[BillingPage] Portal error:', error);
        throw error;
      }

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to open customer portal';
        console.error('[BillingPage] Portal returned error:', errorMessage);
        throw new Error(errorMessage);
      }
      
      if (data?.url) {
        console.log('[BillingPage] Opening portal URL:', data.url);
        window.open(data.url, '_blank');
        toast({
          title: 'Success',
          description: 'Opening Stripe Customer Portal...',
        });
      } else {
        console.error('[BillingPage] No URL in portal response:', data);
        throw new Error('No portal URL returned from Stripe');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open payment method management. Please ensure Stripe is configured.';
      console.error('[BillingPage] Payment method management error:', errorMessage, error);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUpgradeLoading(false);
    }
  };

  // Check if platform Stripe is in test mode
  const isTestMode = import.meta.env.VITE_STRIPE_SECRET_KEY?.startsWith('sk_test_');

  // Calculate trial days remaining
  const trialDaysRemaining = tenant?.trial_ends_at 
    ? Math.ceil((new Date(tenant.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const isOnTrial = tenant?.subscription_status === 'trial';

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2">💳 Billing & Subscription</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your subscription and view billing history</p>
        </div>

        {/* Payment Method Missing Alert */}
        {tenant?.payment_method_added === false && (
          <Alert className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500 border-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  ⚠️ Complete Your Trial Setup
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Add a payment method to avoid service interruption when your trial ends
                  {tenant?.trial_ends_at && ` on ${new Date(tenant.trial_ends_at).toLocaleDateString()}`}.
                </p>
              </div>
              <Button
                onClick={async () => {
                  if (!tenant?.id) return;
                  
                  try {
                    setUpgradeLoading(true);
                    
                    // Check if plans are still loading
                    if (plansLoading) {
                      toast({
                        title: 'Loading Plans',
                        description: 'Please wait while subscription plans load...',
                      });
                      return;
                    }
                    
                    // Check if plans failed to load
                    if (plansError) {
                      console.error('[BillingPage] Plans error:', plansError);
                      toast({
                        title: 'Error Loading Plans',
                        description: `Failed to load subscription plans: ${plansError.message}. Please refresh the page.`,
                        variant: 'destructive',
                      });
                      return;
                    }
                    
                    // Get current plan
                    const currentPlan = subscriptionPlans?.find(p => p.name === tenant.subscription_plan);
                    if (!currentPlan) {
                      console.error('[BillingPage] Current plan not found:', {
                        tenantPlan: tenant.subscription_plan,
                        availablePlans: subscriptionPlans?.map(p => p.name) || []
                      });
                      toast({
                        title: 'Error',
                        description: `Current plan "${tenant.subscription_plan}" not found in database. Available: ${subscriptionPlans?.map(p => p.name).join(', ') || 'none'}`,
                        variant: 'destructive',
                      });
                      return;
                    }
                    
                    const { data, error } = await supabase.functions.invoke('start-trial', {
                      body: {
                        tenant_id: tenant.id,
                        plan_id: currentPlan.id,
                      }
                    });
                    
                    if (error) throw error;
                    
                    if (data?.url) {
                      window.open(data.url, '_blank');
                      toast({
                        title: 'Opening Stripe Checkout',
                        description: 'Add your payment method to complete trial setup',
                      });
                    }
                  } catch (error: any) {
                    console.error('[BillingPage] Payment method error:', error);
                    toast({
                      title: 'Error',
                      description: error.message || 'Failed to open payment method setup',
                      variant: 'destructive',
                    });
                  } finally {
                    setUpgradeLoading(false);
                  }
                }}
                disabled={upgradeLoading}
                className="whitespace-nowrap bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {upgradeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </>
                )}
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
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="current" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">Current Plan</TabsTrigger>
            <TabsTrigger value="plans" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">Compare Plans</TabsTrigger>
            <TabsTrigger value="billing" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">Billing History</TabsTrigger>
          </TabsList>

          {/* CURRENT PLAN TAB */}
          <TabsContent value="current" className="space-y-6">
            {/* Trial Countdown */}
            {isOnTrial && tenant?.trial_ends_at && trialDaysRemaining > 0 && (
              <TrialCountdown trialEndsAt={tenant.trial_ends_at} />
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
                      {/* @ts-ignore - mrr added in pending migration */}
                      {formatCurrency((tenant?.mrr as number) || 0)}/month
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {plan?.description || "Your current subscription plan"}
                  </p>
                  
                  {/* Platform Fee Notice */}
                  <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-purple-900 dark:text-purple-100">
                      {/* @ts-ignore - mrr added in pending migration */}
                      💎 <strong>Platform Fee:</strong> {formatCurrency(((tenant?.mrr as number) || 0) * 0.02)}/month (2% of subscription)
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
                    const current = usage[resource] || 0;
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
                              className={`h-2 rounded-full transition-all ${
                                isOverLimit 
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
                {/* @ts-ignore - payment_method_added added in pending migration */}
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
                    <Button onClick={handlePaymentMethod} disabled={upgradeLoading}>
                      {upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
              <Card className={currentTier === 'starter' ? 'border-2 border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="h-8 w-8 text-green-600" />
                    {currentTier === 'starter' && <Badge>Current</Badge>}
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
                    variant={currentTier === 'starter' ? 'outline' : 'default'} 
                    className="w-full" 
                    disabled={currentTier === 'starter' || upgradeLoading}
                    onClick={() => currentTier !== 'starter' && handlePlanChange('starter')}
                  >
                    {currentTier === 'starter' ? 'Current Plan' : upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {currentTier === 'starter' ? 'Current Plan' : 'Downgrade'}
                  </Button>
                </CardContent>
              </Card>

              {/* Professional Plan */}
              <Card className={currentTier === 'professional' ? 'border-2 border-primary' : 'border-2 border-blue-500/50'}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Star className="h-8 w-8 text-blue-600" />
                    {currentTier === 'professional' && <Badge>Current</Badge>}
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
                    variant={currentTier === 'professional' ? 'outline' : 'default'} 
                    className="w-full" 
                    disabled={currentTier === 'professional' || upgradeLoading}
                    onClick={() => currentTier !== 'professional' && handlePlanChange('professional')}
                  >
                    {upgradeLoading && selectedPlan === 'professional' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {currentTier === 'professional' ? 'Current Plan' : currentTier === 'starter' ? 'Upgrade' : 'Downgrade'}
                  </Button>
                </CardContent>
              </Card>

              {/* Enterprise Plan */}
              <Card className={currentTier === 'enterprise' ? 'border-2 border-primary' : 'border-2 border-purple-500/50'}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Diamond className="h-8 w-8 text-purple-600" />
                    {currentTier === 'enterprise' && <Badge>Current</Badge>}
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
                    variant={currentTier === 'enterprise' ? 'outline' : 'default'} 
                    className="w-full" 
                    disabled={currentTier === 'enterprise' || upgradeLoading}
                    onClick={() => currentTier !== 'enterprise' && handlePlanChange('enterprise')}
                  >
                    {upgradeLoading && selectedPlan === 'enterprise' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {currentTier === 'enterprise' ? 'Current Plan' : 'Upgrade'}
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
                          <p className="font-medium">{formatCurrency(invoice.total || 0)}</p>
                          <Badge 
                            variant={invoice.status === "paid" ? "default" : "outline"}
                          >
                            {invoice.status?.toUpperCase() || "PENDING"}
                          </Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
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
    </div>
  );
}
