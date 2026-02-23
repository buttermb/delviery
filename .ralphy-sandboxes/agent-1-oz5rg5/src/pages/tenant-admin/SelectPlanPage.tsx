import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, Crown, Sparkles, Shield, Clock, Zap, Coins, ArrowRight } from "lucide-react";
import { logger } from "@/lib/logger";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { handleError } from '@/utils/errorHandling/handlers';
import { cn } from "@/lib/utils";
import { FREE_TIER_MONTHLY_CREDITS } from "@/lib/credits";

type BillingCycle = 'monthly' | 'yearly';

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: string[];
  popular?: boolean;
}

export default function SelectPlanPage() {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const {
    isEnterprise,
    isTrial,
    isActive,
    currentTier,
    hasActiveSubscription
  } = useSubscriptionStatus();
  const [loading, setLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryPlanId, setRetryPlanId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [skipTrial, setSkipTrial] = useState(false);
  const [isFreeTier, setIsFreeTier] = useState(false);

  // Check if tenant is on free tier
  useEffect(() => {
    const checkFreeTier = async () => {
      if (!tenant?.id) return;
      const { data } = await supabase
        .from('tenants')
        .select('is_free_tier')
        .eq('id', tenant.id)
        .maybeSingle();
      setIsFreeTier((data as any)?.is_free_tier || false);
    };
    checkFreeTier();
  }, [tenant?.id]);

  // Check if user already completed payment and redirect to dashboard
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!tenant?.id) return;

      const { data: freshTenant } = await supabase
        .from('tenants')
        .select('payment_method_added, subscription_status, slug')
        .eq('id', tenant.id)
        .maybeSingle();

      if ((freshTenant as any)?.payment_method_added && (freshTenant as any)?.subscription_status === 'active') {
        logger.info('[SELECT_PLAN] Already has active subscription, redirecting to dashboard');
        navigate(`/${(freshTenant as any).slug || tenant.slug}/admin/dashboard`, { replace: true });
      }
    };

    checkPaymentStatus();
  }, [tenant?.id, tenant?.slug, navigate]);

  // Load plans from configuration (Static source of truth)
  useEffect(() => {
    const PLAN_CONFIG: Record<string, {
      name: string;
      priceMonthly: number;
      priceYearly: number;
      description: string;
    }> = {
      starter: {
        name: 'Starter',
        priceMonthly: 79,
        priceYearly: 790,
        description: 'Unlimited usage for small businesses',
      },
      professional: {
        name: 'Professional',
        priceMonthly: 150,
        priceYearly: 1500,
        description: 'Ideal for growing businesses',
      },
      enterprise: {
        name: 'Enterprise',
        priceMonthly: 499,
        priceYearly: 4990,
        description: 'Complete solution for large operations',
      },
    };

    const PLAN_FEATURES_LIST: Record<string, string[]> = {
      starter: [
        "Unlimited Products",
        "3 Staff Members",
        "Basic Reporting",
        "Standard Support",
        "Mobile App Access"
      ],
      professional: [
        "Everything in Starter",
        "10 Staff Members",
        "Advanced Analytics",
        "API Access",
        "Priority Email Support",
        "Custom Branding"
      ],
      enterprise: [
        "Everything in Professional",
        "Unlimited Staff",
        "Dedicated Account Manager",
        "White-Label Options",
        "Custom Integrations",
        "SLA Guarantees"
      ]
    };

    const plansList: Plan[] = Object.entries(PLAN_CONFIG).map(([key, config]) => ({
      id: key,
      name: config.name,
      priceMonthly: config.priceMonthly,
      priceYearly: config.priceYearly,
      description: config.description,
      features: PLAN_FEATURES_LIST[key] || [],
      popular: key === 'professional',
    }));

    setPlans(plansList);
    setLoadingPlans(false);
  }, []);

  // Calculate savings
  const getSavings = (plan: Plan) => {
    const monthlyTotal = plan.priceMonthly * 12;
    const yearlySavings = monthlyTotal - plan.priceYearly;
    const savingsPercent = Math.round((yearlySavings / monthlyTotal) * 100);
    return { amount: yearlySavings, percent: savingsPercent };
  };

  const getEffectiveMonthly = (plan: Plan) => {
    return (plan.priceYearly / 12).toFixed(0);
  };

  const getDisplayPrice = (plan: Plan) => {
    return billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  };

  // Check if plan is current
  const isCurrentPlan = (plan: Plan): boolean => {
    return plan.name.toLowerCase() === currentTier;
  };

  // Check if plan is an upgrade
  const isUpgrade = (plan: Plan): boolean => {
    const tierOrder: Record<string, number> = { starter: 1, professional: 2, enterprise: 3 };
    const currentOrder = tierOrder[currentTier] || 0;
    const planOrder = tierOrder[plan.name.toLowerCase()] || 0;
    return planOrder > currentOrder;
  };

  // Get button text
  const getButtonText = (plan: Plan): string => {
    const planTier = plan.name.toLowerCase();
    const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    const period = billingCycle === 'yearly' ? '/yr' : '/mo';

    if (planTier === currentTier) {
      return 'Current Plan';
    }

    if (isTrial) {
      return skipTrial ? `Subscribe Now - $${price}${period}` : 'Start 14-Day Free Trial';
    }

    if (isActive) {
      const tierOrder: Record<string, number> = { starter: 1, professional: 2, enterprise: 3 };
      const currentOrder = tierOrder[currentTier] || 0;
      const planOrder = tierOrder[planTier] || 0;

      if (planOrder > currentOrder) {
        return `Upgrade to $${price}${period}`;
      } else if (planOrder < currentOrder) {
        return `Downgrade to $${price}${period}`;
      }
    }

    return skipTrial ? `Subscribe - $${price}${period}` : 'Start Free Trial';
  };

  const handleSelectFreeTier = async () => {
    if (!tenant?.id) {
      toast.error("Missing tenant information");
      return;
    }

    setLoading('free');
    setError(null);

    try {
      // Update tenant to free tier
      const { error: updateError } = await supabase
        .from('tenants')
        .update({ is_free_tier: true })
        .eq('id', tenant.id);

      if (updateError) throw updateError;

      // Grant initial credits via RPC
      const { error: creditError } = await supabase.rpc('grant_free_credits', {
        p_tenant_id: tenant.id
      });

      if (creditError) {
        logger.warn('[SELECT_PLAN] Failed to grant initial credits', creditError);
        // Don't fail the whole operation, credits can be granted later
      }

      toast.success("Welcome to the Free tier! You've received your credits.");
      navigate(`/${tenant.slug}/admin/dashboard`);
    } catch (error) {
      handleError(error, {
        component: 'SelectPlanPage',
        toastTitle: 'Failed to switch to free tier',
        context: { tenantId: tenant.id }
      });
    } finally {
      setLoading(null);
    }
  };

  const handleSelectPlan = async (planId: string, isRetry = false) => {
    if (!tenant) {
      toast.error("Missing tenant information");
      setError("Missing tenant information");
      return;
    }

    setLoading(planId);
    setError(null);
    if (isRetry) setRetryPlanId(null);

    try {
      const { data, error } = await supabase.functions.invoke("start-trial", {
        body: {
          tenant_id: tenant.id,
          plan_id: planId,
          billing_cycle: billingCycle,
          skip_trial: skipTrial,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        setLoading(null);
        toast.success("Checkout opened in new tab");
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      handleError(error, {
        component: 'SelectPlanPage',
        toastTitle: 'Failed to start checkout',
        context: { planId, tenantId: tenant.id }
      });
      setRetryPlanId(planId);
      setLoading(null);
    }
  };

  if (loadingPlans) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Plans Available</CardTitle>
            <CardDescription>Please contact support.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate(`/${tenant?.slug}/admin`)} className="w-full">
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Enterprise guard
  if (isEnterprise && hasActiveSubscription) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">You're on our highest tier!</h1>
            <p className="text-xl text-muted-foreground mb-6">
              You have access to all features with our Enterprise plan
            </p>
          </div>

          <Alert className="mb-6">
            <AlertDescription>
              <strong>Enterprise Plan Benefits:</strong> Unlimited everything, priority support,
              custom integrations, and dedicated account management.
            </AlertDescription>
          </Alert>

          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate(`/${tenant?.slug}/admin/dashboard`)}
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={async () => {
                if (!tenant?.id) return;
                setLoadingPortal(true);
                try {
                  const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
                    body: { tenant_id: tenant.id }
                  });
                  if (error) throw error;
                  if (data?.url) {
                    window.open(data.url, '_blank');
                  } else {
                    throw new Error('No portal URL received');
                  }
                } catch (error) {
                  handleError(error, { component: 'SelectPlanPage', toastTitle: 'Failed to open subscription management' });
                } finally {
                  setLoadingPortal(false);
                }
              }}
              disabled={loadingPortal}
            >
              {loadingPortal ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Manage Subscription'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            {isTrial ? 'Complete Your Subscription' : 'Manage Your Plan'}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {isTrial ? 'Add Payment Method' : 'Choose Your Plan'}
          </h1>
          <p className="text-xl text-muted-foreground">
            {isTrial
              ? (skipTrial ? "Get started immediately with full access" : "Start your 14-day free trial today")
              : "Upgrade or change your subscription"
            }
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "px-6 py-2.5 rounded-md font-medium transition-all text-sm",
                billingCycle === 'monthly'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={cn(
                "px-6 py-2.5 rounded-md font-medium transition-all text-sm flex items-center gap-2",
                billingCycle === 'yearly'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Save 17%
              </Badge>
            </button>
          </div>
        </div>

        {/* Skip Trial Option - Only show for trial users */}
        {isTrial && (
          <div className="flex justify-center mb-8">
            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={skipTrial}
                onCheckedChange={(checked) => setSkipTrial(checked === true)}
                id="skipTrial"
              />
              <div>
                <span className="font-medium">Skip trial and subscribe immediately</span>
                <p className="text-sm text-muted-foreground">
                  Ready to commit? Get started right away.
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Free Tier Card */}
          <Card
            className={cn(
              "relative overflow-hidden transition-all duration-300 border-dashed",
              isFreeTier
                ? "border-emerald-500 shadow-xl scale-[1.02] ring-2 ring-emerald-500"
                : "border-emerald-500/50 bg-emerald-500/5 hover:shadow-lg hover:scale-[1.01]"
            )}
          >
            {isFreeTier && (
              <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                CURRENT PLAN
              </div>
            )}
            {!isFreeTier && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-emerald-500 text-white px-3 py-1">
                  <Coins className="h-3 w-3 mr-1" />
                  FREE
                </Badge>
              </div>
            )}

            <CardHeader className="pb-4 pt-6">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-2xl">Free</CardTitle>
              </div>
              <CardDescription className="min-h-[40px]">
                Try everything with monthly credits
              </CardDescription>

              <div className="mt-4 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits/month
                </p>
              </div>
            </CardHeader>

            <CardContent className="pb-4">
              <ul className="space-y-3">
                {[
                  `${FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits/month`,
                  "All core features",
                  "50 customers",
                  "100 products",
                  "1 location",
                  "Email support",
                  "Credits auto-refresh monthly",
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter className="flex-col gap-3 pt-0">
              <Button
                className={cn(
                  "w-full h-12 text-base font-semibold",
                  isFreeTier ? "" : "bg-emerald-600 hover:bg-emerald-700"
                )}
                size="lg"
                onClick={handleSelectFreeTier}
                disabled={loading !== null || isFreeTier}
                variant={isFreeTier ? "outline" : "default"}
              >
                {loading === 'free' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : isFreeTier ? (
                  "Current Plan"
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Switch to Free
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                No credit card required
              </p>
            </CardFooter>
          </Card>

          {/* Paid Plan Cards */}
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan);
            const isUpgradePlan = isUpgrade(plan);
            const savings = getSavings(plan);
            const effectiveMonthly = getEffectiveMonthly(plan);

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative overflow-hidden transition-all duration-300",
                  isCurrent
                    ? "border-primary shadow-xl scale-[1.02] ring-2 ring-primary"
                    : plan.popular
                      ? "border-primary shadow-xl scale-[1.02] ring-2 ring-primary/20"
                      : "hover:shadow-lg hover:scale-[1.01]"
                )}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-bold rounded-bl-lg">
                    CURRENT PLAN
                  </div>
                )}
                {!isCurrent && plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-bold rounded-bl-lg">
                    MOST POPULAR
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>

                  <div className="mt-4 space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        ${getDisplayPrice(plan)}
                      </span>
                      <span className="text-muted-foreground">
                        /{billingCycle === 'yearly' ? 'year' : 'month'}
                      </span>
                    </div>

                    {billingCycle === 'yearly' && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          ${effectiveMonthly}/mo billed annually
                        </p>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          Save ${savings.amount}/year ({savings.percent}% off)
                        </p>
                      </div>
                    )}

                    {!billingCycle && (
                      <p className="text-sm font-medium text-primary">
                        <ArrowRight className="h-3 w-3 inline mr-1" />
                        Unlimited usage
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <ul className="space-y-3">
                    {plan.features.slice(0, 8).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 8 && (
                      <li className="text-sm text-muted-foreground pl-7">
                        +{plan.features.length - 8} more features
                      </li>
                    )}
                  </ul>
                </CardContent>

                <CardFooter className="flex-col gap-3 pt-0">
                  <Button
                    className={cn(
                      "w-full h-12 text-base font-semibold",
                      (plan.popular || isUpgradePlan) && !isCurrent && "bg-primary hover:bg-primary/90"
                    )}
                    size="lg"
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={loading !== null || isCurrent}
                    variant={isCurrent ? "outline" : (isUpgradePlan || plan.popular) ? "default" : "outline"}
                  >
                    {loading === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      getButtonText(plan)
                    )}
                  </Button>

                  {error && retryPlanId === plan.id && loading !== plan.id && (
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => handleSelectPlan(plan.id, true)}
                      variant="outline"
                    >
                      Try Again
                    </Button>
                  )}

                  {!skipTrial && isTrial && (
                    <p className="text-xs text-muted-foreground text-center">
                      No charges until trial ends
                    </p>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center gap-6 mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4 text-emerald-500" />
            <span>Free tier available</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-green-500" />
            <span>Bank-level security</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-blue-500" />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Changes take effect immediately</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setError(null)}>
                Dismiss
              </Button>
              {retryPlanId && (
                <Button
                  onClick={() => handleSelectPlan(retryPlanId, true)}
                  disabled={loading !== null}
                >
                  Retry
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {/* Legal Text */}
        <div className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
          <p>
            By {skipTrial ? "subscribing" : "starting a trial"}, you agree to our{" "}
            <a href="/terms" className="text-primary hover:underline">Terms of Service</a> and{" "}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            {!skipTrial && isTrial && (
              <> Your card will be charged <span className="font-semibold">after 14 days</span> unless you cancel.</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
