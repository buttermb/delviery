import { logger } from '@/lib/logger';
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle, Mail, Eye, EyeOff, Building2, Sparkles } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { RateLimitWarning } from "@/components/auth/RateLimitWarning";
import { useAuthRateLimit } from "@/hooks/useAuthRateLimit";


export default function AccountSignup() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1: Account + Name
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [yourName, setYourName] = useState("");

  // Step 2: Business Info + Plan
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("cannabis wholesale");
  const [selectedPlan, setSelectedPlan] = useState(searchParams.get("plan") || "free");

  const { isLocked, remainingSeconds, recordAttempt, resetOnSuccess } = useAuthRateLimit({
    storageKey: 'floraiq_account_signup_rate_limit',
  });

  const industries = ["Cannabis Wholesale", "Food & Beverage", "General Distribution", "Other"];

  const plans = [
    { id: "free", name: "FREE", price: 0, description: "500 credits/month, no CC required", isFree: true },
    { id: "starter", name: "STARTER", price: 79, description: "Unlimited usage for small teams" },
    { id: "professional", name: "PROFESSIONAL", price: 150, description: "Most popular choice", popular: true },
    { id: "enterprise", name: "ENTERPRISE", price: 499, description: "For large operations" },
  ];

  // Password validation
  const passwordValid = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const isPasswordValid = passwordValid.length && passwordValid.uppercase && passwordValid.number;

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !yourName) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    if (!isPasswordValid) {
      toast({
        title: "Password requirements not met",
        description: "Please ensure your password meets all requirements",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      return;
    }

    if (!businessName) {
      toast({
        title: "Business name required",
        description: "Please enter your business name",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    // Auto-generate URL slug from business name
    const urlSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/${urlSlug}/admin/dashboard`,
          data: {
            full_name: yourName,
            business_name: businessName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          business_name: businessName,
          slug: urlSlug,
          owner_email: email,
          owner_name: yourName,
          subscription_plan: selectedPlan,
          subscription_status: "trial",
          created_at: new Date().toISOString(),
        } as any)
        .select()
        .maybeSingle();

      if (tenantError) throw tenantError;

      // Create tenant admin user
      const { error: tenantUserError } = await supabase.from("tenant_users").insert({
        email: email,
        name: yourName,
      } as any);

      if (tenantUserError) throw tenantUserError;

      resetOnSuccess();

      toast({
        title: "🎉 Account created!",
        description: "Please check your email to verify your account.",
      });

      // Redirect to plan selection
      navigate("/select-plan", {
        state: {
          fromSignup: true,
          userId: authData.user.id,
          tenantSlug: urlSlug,
          email: email
        },
      });
    } catch (error: any) {
      recordAttempt();
      logger.error("Signup error", error, { component: 'AccountSignup' });
      toast({
        title: "Signup failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[hsl(var(--marketing-bg))]">
      <SEOHead
        title="Start Your 14-Day Free Trial - FloraIQ"
        description="Sign up for FloraIQ. No credit card required. Get started in 60 seconds."
      />

      <MarketingNav />

      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-lg mx-auto">
          {/* Progress Indicator - Simplified */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all ${step >= 1 ? "bg-[hsl(var(--marketing-primary))] text-white" : "bg-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text-light))]"
                }`}>
                {step > 1 ? <CheckCircle className="h-5 w-5" /> : "1"}
              </div>
              <div className={`h-1 w-16 rounded-full transition-all ${step > 1 ? "bg-[hsl(var(--marketing-primary))]" : "bg-[hsl(var(--marketing-border))]"
                }`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all ${step >= 2 ? "bg-[hsl(var(--marketing-primary))] text-white" : "bg-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text-light))]"
                }`}>
                2
              </div>
            </div>
            <p className="text-center text-sm text-[hsl(var(--marketing-text-light))]">
              {step === 1 ? "Create your account" : "Set up your business"}
            </p>
          </div>

          <Card className="border-[hsl(var(--marketing-border))] shadow-xl">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl md:text-3xl">
                {step === 1 && "Start Your Free Trial"}
                {step === 2 && "Almost there!"}
              </CardTitle>
              <CardDescription className="text-base">
                {step === 1 && "No credit card required • 14 days free"}
                {step === 2 && "Just a few more details"}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2">
              {/* STEP 1: Create Account */}
              {step === 1 && (
                <form onSubmit={handleStep1} className="space-y-4">
                  <div>
                    <Label htmlFor="yourName">Your Name</Label>
                    <Input
                      id="yourName"
                      placeholder="John Smith"
                      value={yourName}
                      onChange={(e) => setYourName(e.target.value)}
                      className="mt-2 h-12"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Work Email</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-3.5 h-5 w-5 text-[hsl(var(--marketing-text-light))]" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-2">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10 h-12"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-[hsl(var(--marketing-text-light))]" />
                        ) : (
                          <Eye className="h-5 w-5 text-[hsl(var(--marketing-text-light))]" />
                        )}
                      </button>
                    </div>
                    {/* Real-time Password Requirements */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { valid: passwordValid.length, label: "8+ chars" },
                        { valid: passwordValid.uppercase, label: "Uppercase" },
                        { valid: passwordValid.number, label: "Number" },
                      ].map((req) => (
                        <span
                          key={req.label}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${req.valid
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                        >
                          {req.valid && <CheckCircle className="h-3 w-3" />}
                          {req.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white h-14 text-lg font-semibold mt-6"
                  >
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[hsl(var(--marketing-border))]" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-[hsl(var(--marketing-text-light))]">or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant="outline" className="h-12">
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Google
                    </Button>
                    <Button type="button" variant="outline" className="h-12">
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                      </svg>
                      Microsoft
                    </Button>
                  </div>

                  <p className="text-xs text-center text-[hsl(var(--marketing-text-light))] mt-6">
                    By signing up, you agree to our{" "}
                    <Link to="/terms" className="text-[hsl(var(--marketing-primary))] hover:underline">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-[hsl(var(--marketing-primary))] hover:underline">
                      Privacy Policy
                    </Link>
                  </p>

                  <p className="text-center text-sm text-[hsl(var(--marketing-text))]">
                    Already have an account?{" "}
                    <Link to="/login" className="text-[hsl(var(--marketing-primary))] hover:underline font-medium">
                      Sign in
                    </Link>
                  </p>
                </form>
              )}

              {/* STEP 2: Business Info + Plan */}
              {step === 2 && (
                <form onSubmit={handleStep2} className="space-y-5">
                  <RateLimitWarning remainingSeconds={remainingSeconds} variant="light" />

                  <div>
                    <Label htmlFor="businessName">Business Name</Label>
                    <div className="relative mt-2">
                      <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-[hsl(var(--marketing-text-light))]" />
                      <Input
                        id="businessName"
                        placeholder="Your Company Name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="pl-10 h-12"
                        required
                        autoFocus
                      />
                    </div>
                    {businessName && (
                      <p className="text-xs text-[hsl(var(--marketing-text-light))] mt-2">
                        Your URL: <span className="font-medium">{businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.floraiq.com</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="industry">Industry (optional)</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger className="mt-2 h-12">
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((ind) => (
                          <SelectItem key={ind} value={ind.toLowerCase()}>
                            {ind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-3 block">Choose Your Plan</Label>
                    <div className="grid gap-3">
                      {plans.map((plan) => (
                        <div
                          key={plan.id}
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${selectedPlan === plan.id
                            ? "border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/5"
                            : "border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-primary))]/50"
                            }`}
                          onClick={() => setSelectedPlan(plan.id)}
                        >
                          {plan.popular && (
                            <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--marketing-primary))] text-white text-xs font-bold">
                              <Sparkles className="h-3 w-3" />
                              POPULAR
                            </span>
                          )}
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-[hsl(var(--marketing-text))]">{plan.name}</h4>
                              <p className="text-sm text-[hsl(var(--marketing-text-light))]">{plan.description}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-[hsl(var(--marketing-text))]">${plan.price}</span>
                              <span className="text-sm text-[hsl(var(--marketing-text-light))]">/mo</span>
                            </div>
                          </div>
                          {selectedPlan === plan.id && (
                            <div className="absolute top-1/2 -translate-y-1/2 right-4">
                              <CheckCircle className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                            </div>
                          )}
                          {/* @ts-ignore */}
                          {plan.isFree && (
                            <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-sm z-10">
                              NO CC REQUIRED
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[hsl(var(--marketing-bg-subtle))] p-4 rounded-xl">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[hsl(var(--marketing-text))]">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                        14 days free
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                        No credit card
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                        Cancel anytime
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 h-14"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || isLocked}
                      className="flex-[2] bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white h-14 text-lg font-semibold"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Create My Account
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Trust indicators */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[hsl(var(--marketing-text-light))]">
              Trusted by 500+ cannabis distributors
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
