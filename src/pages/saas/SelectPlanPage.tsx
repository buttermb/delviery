import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Zap, Shield, Clock } from "lucide-react";
import { logger } from "@/lib/logger";
import { SUBSCRIPTION_PLANS } from "@/utils/subscriptionPlans";
import { handleError } from '@/utils/errorHandling/handlers';
import { cn } from "@/lib/utils";

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

  // Load plans from database
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('id, name, price_monthly, price_yearly, description, features')
          .order('price_monthly', { ascending: true });

        if (error) throw error;

        const formattedPlans: Plan[] = (data || []).map((plan) => ({
          id: plan.id,
          name: plan.name,
          priceMonthly: plan.price_monthly || 0,
          priceYearly: plan.price_yearly || (plan.price_monthly * 10), // Default: ~17% discount
          description: plan.description || '',
          features: Array.isArray(plan.features) ? plan.features as string[] : [],
          popular: plan.name.toLowerCase() === SUBSCRIPTION_PLANS.PROFESSIONAL,
        }));

        setPlans(formattedPlans);
      } catch (error) {
        logger.error('[SELECT_PLAN] Failed to load plans', error);
        toast.error("Failed to load subscription plans");
      } finally {
        setLoadingPlans(false);
      }
    };

    loadPlans();
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

    try {
      // Call start-trial edge function with billing cycle and skip trial options
      const { data, error } = await supabase.functions.invoke("start-trial", {
        body: {
          tenant_id: tenantId,
          plan_id: planId,
          billing_cycle: billingCycle,
          skip_trial: skipTrial,
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
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
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
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
        <div className="grid md:grid-cols-3 gap-6 mb-8">
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
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
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
            <Shield className="h-4 w-4 text-green-500" />
            <span>Bank-level security</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-blue-500" />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-amber-500" />
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
  );
}
