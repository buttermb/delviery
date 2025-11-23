import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 79,
    description: "Perfect for small businesses getting started",
    features: [
      "Up to 50 customers",
      "3 disposable menus",
      "100 products",
      "Email support",
      "Basic analytics",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 150,
    description: "For growing businesses with expanding needs",
    features: [
      "Up to 500 customers",
      "Unlimited menus",
      "Unlimited products",
      "Priority support",
      "Advanced analytics",
      "API access",
      "Custom branding",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 499,
    description: "For large organizations with complex requirements",
    features: [
      "Unlimited customers",
      "Unlimited menus",
      "Unlimited products",
      "24/7 dedicated support",
      "Advanced analytics",
      "Full API access",
      "White label",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

export default function SelectPlanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const tenantId = searchParams.get("tenant_id");

  const handleSelectPlan = async (planId: string) => {
    if (!tenantId) {
      toast.error("Missing tenant information");
      return;
    }

    setLoading(planId);

    try {
      // Get plan details from database
      const { data: plans } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("name", planId.charAt(0).toUpperCase() + planId.slice(1))
        .single();

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
    } catch (error: any) {
      console.error("Error starting trial:", error);
      toast.error(error.message || "Failed to start trial");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground mb-2">
            Start your 14-day free trial today
          </p>
          <p className="text-sm text-muted-foreground">
            Credit card required • No charges for 14 days • Cancel anytime
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card 
              key={plan.id} 
              className={plan.id === "professional" ? "border-primary shadow-lg scale-105" : ""}
            >
              <CardHeader>
                {plan.id === "professional" && (
                  <div className="text-xs font-semibold text-primary mb-2">MOST POPULAR</div>
                )}
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
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
                  variant={plan.id === "professional" ? "default" : "outline"}
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
            Your card will be charged ${" "}
            <span className="font-semibold">after 14 days</span> unless you cancel.
          </p>
        </div>
      </div>
    </div>
  );
}
