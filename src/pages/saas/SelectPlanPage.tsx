import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { SUBSCRIPTION_PLANS } from "@/utils/subscriptionPlans";
import { handleError } from '@/utils/errorHandling/handlers';

interface Plan {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}

export default function SelectPlanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromSignup = location.state?.fromSignup;
  const signupEmail = location.state?.email;
  const [loading, setLoading] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const tenantId = searchParams.get("tenant_id");

  // Load plans from database
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('id, name, price_monthly, description, features')
          .order('price_monthly', { ascending: true });

        if (error) throw error;

        const formattedPlans: Plan[] = (data || []).map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: `$${plan.price_monthly}/month`,
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
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && !fromSignup) {
        toast.error("Please log in to select a plan");
        // Redirect to login with return URL
        navigate(`/saas/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      setIsAuthenticated(true);
      setCheckingAuth(false);
    };

    checkAuth();
  }, [navigate]);

  const handleSelectPlan = async (planId: string) => {
    if (!tenantId) {
      toast.error("Missing tenant information");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please log in to start your trial");
      return;
    }

    setLoading(planId);

    try {
      // Get plan details from database
      const { data: plans } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();

      if (!plans) {
        throw new Error("Plan not found");
      }

      // Call start-trial edge function
      const { data, error } = await supabase.functions.invoke("start-trial", {
        body: {
          tenant_id: tenantId,
          plan_id: plans.id,
        },
      });

      if (error) throw error;

      // Redirect to Stripe Checkout
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      handleError(error, { component: 'SelectPlanPage', toastTitle: 'Failed to start trial' });
      setLoading(null);
    }
  };

  if (checkingAuth || loadingPlans) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {fromSignup ? "Complete Your Registration" : "Choose Your Plan"}
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Start your 14-day free trial today
          </p>
          <p className="text-sm text-muted-foreground">
            Credit card required • No charges for 14 days • Cancel anytime
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={plan.popular ? "border-primary shadow-lg scale-105" : ""}
            >
              <CardHeader>
                {plan.popular && (
                  <Badge className="w-fit mb-2" variant="default">MOST POPULAR</Badge>
                )}
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading !== null}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting trial...
                    </>
                  ) : (
                    "Start 14-Day Free Trial"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            By starting a trial, you agree to our Terms of Service and Privacy Policy.
            Your card will be charged <span className="font-semibold">after 14 days</span> unless you cancel.
          </p>
        </div>
      </div>
    </div>
  );
}
