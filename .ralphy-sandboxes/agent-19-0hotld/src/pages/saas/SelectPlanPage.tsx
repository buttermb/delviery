import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Shield, Clock, Coins, ArrowLeft, Zap } from "lucide-react";
import { logger } from "@/lib/logger";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";
import { handleError } from '@/utils/errorHandling/handlers';
import { cn } from "@/lib/utils";
import FloraIQLogo from '@/components/FloraIQLogo';
import { FREE_TIER_MONTHLY_CREDITS } from "@/lib/credits";
import { PLAN_CONFIG, type PlanKey } from "@/config/planPricing";

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromSignup = location.state?.fromSignup;
  const [loading, setLoading] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [skipTrial, setSkipTrial] = useState(false);
  const tenantId = searchParams.get("tenant_id");

  // Load plans from configuration (Static source of truth)
  useEffect(() => {
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

    const plansList: Plan[] = (Object.entries(PLAN_CONFIG) as [PlanKey, typeof PLAN_CONFIG[PlanKey]][])
      .filter(([key]) => key !== 'free')
      .map(([key, config]) => ({
        id: key,
        name: config.name,
        priceMonthly: config.priceMonthly,
        priceYearly: config.priceYearly,
        description: config.description,
        features: PLAN_FEATURES_LIST[key] ?? [],
        popular: key === 'professional',
      }));

    setPlans(plansList);
    setLoadingPlans(false);
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      logger.debug('[SELECT_PLAN] Starting auth check', { fromSignup, tenantId });

      const isFromSignupFlow = fromSignup || !!tenantId;

      if (isFromSignupFlow) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      let session = null;
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (session) break;
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (!session && !isFromSignupFlow) {
        toast.error("Please log in to select a plan");
        navigate('/saas/login?returnUrl=/select-plan');
        return;
      }

      setIsAuthenticated(true);
      setCheckingAuth(false);
    };

    checkAuth();
  }, [navigate, fromSignup, tenantId]);

  // Check for existing active subscription
  useEffect(() => {
    async function checkExistingSubscription() {
      if (!isAuthenticated || !tenantId) return;

      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('subscription_status, subscription_plan, slug')
        .eq('id', tenantId)
        .maybeSingle();

      if (error || !tenant) return;

      // If active and not free tier, redirect to billing or show message
      // Note: 'free' plan is technically 'active' status usually, so we check plan too.
      // Assuming 'free' plan is named 'free' or similar.
      if (tenant.subscription_status === 'active' && tenant.subscription_plan !== 'free') {
        toast.info("You already have an active subscription. Redirecting to billing...");
        navigate(`/${tenant.slug}/admin/settings/billing`);
      }
    }

    checkExistingSubscription();
  }, [isAuthenticated, tenantId, navigate]);

  // Calculate savings
  const getSavings = (plan: Plan) => {
    const monthlyTotal = plan.priceMonthly * 12;
    const yearlySavings = monthlyTotal - plan.priceYearly;
    const savingsPercent = Math.round((yearlySavings / monthlyTotal) * 100);
    return { amount: yearlySavings, percent: savingsPercent };
  };

  // Get effective monthly price for yearly billing
  const getEffectiveMonthly = (plan: Plan) => {
    return (plan.priceYearly / 12).toFixed(0);
  };

  // Get display price based on billing cycle
  const getDisplayPrice = (plan: Plan) => {
    if (billingCycle === 'yearly') {
      return plan.priceYearly;
    }
    return plan.priceMonthly;
  };

  const handleSelectPlan = async (planId: string) => {
    if (!tenantId) {
      toast.error("Missing tenant information");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please log in first");
      return;
    }

    setLoading(planId);

    const idempotencyKey = crypto.randomUUID();

    try {
      // Call start-trial edge function with billing cycle and skip trial options
      const { data, error } = await supabase.functions.invoke("start-trial", {
        body: {
          tenant_id: tenantId,
          plan_id: planId,
          billing_cycle: billingCycle,
          skip_trial: skipTrial,
          idempotency_key: idempotencyKey,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      handleError(error, { component: 'SelectPlanPage', toastTitle: 'Failed to start checkout' });
      setLoading(null);
    }
  };

  // Handle selecting the free tier
  const handleSelectFreeTier = async () => {
    if (!tenantId) {
      toast.error("Missing tenant information");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please log in first");
      return;
    }

    setLoading('free');

    try {
      // Set tenant to free tier and grant initial credits
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          is_free_tier: true,
          subscription_status: 'active',
          subscription_plan: 'free',
        })
        .eq('id', tenantId);

      if (updateError) throw updateError;

      // Grant initial credits
      const rpc = supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
      const { error: creditError } = await rpc('grant_free_credits', { // Supabase type limitation
        p_tenant_id: tenantId,
        p_amount: FREE_TIER_MONTHLY_CREDITS,
      });

      if (creditError) {
        logger.warn('[SELECT_PLAN] Failed to grant initial credits', creditError);
      }

      // Get tenant slug for redirect
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', tenantId)
        .maybeSingle();

      toast.success(`You've been granted ${FREE_TIER_MONTHLY_CREDITS.toLocaleString()} free credits!`);

      // Redirect to dashboard
      navigate(`/${tenant?.slug || 'admin'}/admin/dashboard`, { replace: true });
    } catch (error) {
      handleError(error, { component: 'SelectPlanPage', toastTitle: 'Failed to start free tier' });
      setLoading(null);
    }
  };

  // Button text based on options
  const getButtonText = (plan: Plan) => {
    if (skipTrial) {
      const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
      const period = billingCycle === 'yearly' ? '/yr' : '/mo';
      return `Subscribe Now - $${price}${period}`;
    }
    return "Start 14-Day Free Trial";
  };

  if (checkingAuth || loadingPlans) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <ForceLightMode>
      <div className="min-h-dvh bg-gradient-to-b from-background to-muted/20 py-12 px-4 relative">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="w-full max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <FloraIQLogo size="xl" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              {fromSignup ? "Complete Your Registration" : "Choose Your Plan"}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground">
              {skipTrial ? "Get started immediately with full access" : "Start your 14-day free trial today"}
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
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                  Save 17%
                </Badge>
              </button>
            </div>
          </div>

          {/* Skip Trial Option */}
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
                  Ready to commit? Get started right away without the trial period.
                </p>
              </div>
            </label>
          </div>

          {/* Plan Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            {/* Free Tier Card */}
            <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.01] border-dashed">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Coins className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    FREE
                  </Badge>
                </div>
                <CardTitle className="text-2xl">Free Forever</CardTitle>
                <CardDescription className="min-h-[40px]">
                  Get started with credits. Perfect for trying out the platform.
                </CardDescription>

                <div className="mt-4 space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">$0</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-primary font-medium">
                    {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits/month
                  </p>
                </div>
              </CardHeader>

              <CardContent className="pb-4">
                <ul className="space-y-3">
                  {[
                    `${FREE_TIER_MONTHLY_CREDITS.toLocaleString()} free credits monthly`,
                    "All core features unlocked",
                    "Email support",
                    "Buy more credits anytime",
                    "No credit card required",
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Credit usage hint */}
                <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    💡 <span className="font-medium">Tip:</span> {FREE_TIER_MONTHLY_CREDITS} credits ≈ 1 day of active use.
                    Upgrade for unlimited!
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex-col gap-3 pt-0">
                <Button
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                  onClick={handleSelectFreeTier}
                  disabled={loading !== null}
                  variant="outline"
                >
                  {loading === 'free' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Coins className="mr-2 h-4 w-4" />
                      Start Free
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Upgrade anytime for unlimited access
                </p>
              </CardFooter>
            </Card>

            {/* Paid Plan Cards */}
            {plans.map((plan) => {
              const savings = getSavings(plan);
              const effectiveMonthly = getEffectiveMonthly(plan);

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300",
                    plan.popular
                      ? "border-primary shadow-xl scale-[1.02] ring-2 ring-primary/20"
                      : "hover:shadow-lg hover:scale-[1.01]"
                  )}
                >
                  {plan.popular && (
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
                          <p className="text-sm font-medium text-primary">
                            Save ${savings.amount}/year ({savings.percent}% off)
                          </p>
                        </div>
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
                        plan.popular && "bg-primary hover:bg-primary/90"
                      )}
                      size="lg"
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={loading !== null}
                      variant={plan.popular ? "default" : "outline"}
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

                    {!skipTrial && (
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
              <Shield className="h-4 w-4 text-primary" />
              <span>Bank-level security</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              <span>Setup in 2 minutes</span>
            </div>
          </div>

          {/* Legal Text */}
          <div className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            <p>
              By {skipTrial ? "subscribing" : "starting a trial"}, you agree to our{" "}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a> and{" "}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
              {!skipTrial && (
                <> Your card will be charged <span className="font-semibold">after 14 days</span> unless you cancel.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </ForceLightMode>
  );
}
