import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle, Mail, Eye, EyeOff, Package, Users, Settings } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function AccountSignup() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: Business Info
  const [businessName, setBusinessName] = useState("");
  const [yourName, setYourName] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");

  // Step 3: Plan
  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Step 4: Customize
  const [urlSlug, setUrlSlug] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [goals, setGoals] = useState<string[]>([]);

  const industries = ["Cannabis Wholesale", "Food & Beverage", "General Distribution", "Other"];
  const companySizes = ["1-10 employees", "11-50 employees", "51-200 employees", "201+ employees"];
  const referralSources = ["Google search", "Social media", "Referral", "Advertisement", "Other"];
  const goalOptions = [
    "Streamline order management",
    "Track inventory better",
    "Give customers a portal",
    "Replace spreadsheets",
    "Grow my business",
  ];

  const plans = [
    { id: "starter", name: "STARTER", price: 99, monthlyPrice: 99, yearlyPrice: 950 },
    { id: "professional", name: "PROFESSIONAL", price: 299, monthlyPrice: 299, yearlyPrice: 2870 },
    { id: "enterprise", name: "ENTERPRISE", price: 799, monthlyPrice: 799, yearlyPrice: 7670 },
  ];

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !yourName || !phone || !industry || !companySize) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    // Auto-generate URL slug
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setUrlSlug(slug);
    setStep(3);
  };

  const handleStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(4);
  };

  const handleStep4 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlSlug) {
      toast({
        title: "URL slug required",
        description: "Please provide a URL slug for your account",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

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
          owner_email: email,
          subscription_plan: selectedPlan,
          subscription_status: "trial",
          created_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Create tenant admin user
      const { error: tenantUserError } = await supabase.from("tenant_users").insert({
        email: email,
        name: yourName,
      } as any);

      if (tenantUserError) throw tenantUserError;

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });

      navigate("/signup/welcome", {
        state: { tenantSlug: urlSlug, name: yourName },
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleGoal = (goal: string) => {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--marketing-bg))]">
      <SEOHead 
        title="Start Your 14-Day Free Trial - DevPanel"
        description="Sign up for DevPanel. No credit card required. Get started in minutes."
      />
      
      <MarketingNav />

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-[hsl(var(--marketing-text-light))]">
                Step {step} of 4
              </span>
              <span className="text-sm text-[hsl(var(--marketing-text-light))]">
                {Math.round((step / 4) * 100)}% Complete
              </span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded-full ${
                    step >= s
                      ? "bg-[hsl(var(--marketing-primary))]"
                      : "bg-[hsl(var(--marketing-border))]"
                  }`}
                />
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {step === 1 && "Start Your 14-Day Free Trial"}
                {step === 2 && "Tell us about your business"}
                {step === 3 && "Choose Your Plan"}
                {step === 4 && "Customize Your Account"}
              </CardTitle>
              <CardDescription>
                {step === 1 && "No credit card required"}
                {step === 2 && "Step 2 of 4"}
                {step === 3 && "Step 3 of 4 • You can change this anytime"}
                {step === 4 && "Step 4 of 4 • Almost done!"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* STEP 1: Create Account */}
              {step === 1 && (
                <form onSubmit={handleStep1} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Work Email *</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-[hsl(var(--marketing-text-light))]" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative mt-2">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-[hsl(var(--marketing-text-light))]" />
                        ) : (
                          <Eye className="h-5 w-5 text-[hsl(var(--marketing-text-light))]" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-[hsl(var(--marketing-text-light))] mt-1">
                      Must be at least 8 characters
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white h-12"
                  >
                    Continue with Email
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[hsl(var(--marketing-border))]" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[hsl(var(--marketing-bg))] px-2 text-[hsl(var(--marketing-text-light))]">or</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button type="button" variant="outline" className="h-12">
                      Continue with Google
                    </Button>
                    <Button type="button" variant="outline" className="h-12">
                      Continue with Microsoft
                    </Button>
                  </div>

                  <p className="text-xs text-center text-[hsl(var(--marketing-text-light))]">
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
                    <Link to="/admin/login" className="text-[hsl(var(--marketing-primary))] hover:underline">
                      Sign in
                    </Link>
                  </p>
                </form>
              )}

              {/* STEP 2: Business Info */}
              {step === 2 && (
                <form onSubmit={handleStep2} className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      placeholder="BigMike Wholesale"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="yourName">Your Name *</Label>
                    <Input
                      id="yourName"
                      placeholder="Mike Johnson"
                      value={yourName}
                      onChange={(e) => setYourName(e.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Cannabis Wholesale" />
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
                    <Label htmlFor="companySize">Company Size</Label>
                    <Select value={companySize} onValueChange={setCompanySize}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="1-10 employees" />
                      </SelectTrigger>
                      <SelectContent>
                        {companySizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" className="flex-1 bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              )}

              {/* STEP 3: Choose Plan */}
              {step === 3 && (
                <form onSubmit={handleStep3} className="space-y-6">
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        billingCycle === "monthly"
                          ? "bg-[hsl(var(--marketing-primary))] text-white"
                          : "bg-[hsl(var(--marketing-bg-subtle))] text-[hsl(var(--marketing-text-light))]"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("yearly")}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        billingCycle === "yearly"
                          ? "bg-[hsl(var(--marketing-primary))] text-white"
                          : "bg-[hsl(var(--marketing-bg-subtle))] text-[hsl(var(--marketing-text-light))]"
                      }`}
                    >
                      Yearly (Save 20%)
                    </button>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                      const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
                      return (
                        <div
                          key={plan.id}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedPlan === plan.id
                              ? "border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/5"
                              : "border-[hsl(var(--marketing-border))]"
                          }`}
                          onClick={() => setSelectedPlan(plan.id)}
                        >
                          <div className="text-center">
                            <h3 className="font-bold mb-2 text-[hsl(var(--marketing-text))]">{plan.name}</h3>
                            <div className="text-2xl font-bold mb-1 text-[hsl(var(--marketing-text))]">
                              ${price}
                            </div>
                            <div className="text-xs text-[hsl(var(--marketing-text-light))]">
                              /{billingCycle === "monthly" ? "month" : "year"}
                            </div>
                            {selectedPlan === plan.id && (
                              <div className="mt-3">
                                <CheckCircle className="h-5 w-5 text-[hsl(var(--marketing-accent))] mx-auto" />
                                <span className="text-xs text-[hsl(var(--marketing-accent))] mt-1 block">SELECTED</span>
                              </div>
                            )}
                            {!selectedPlan && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-3 w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPlan(plan.id);
                                }}
                              >
                                Select
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-[hsl(var(--marketing-bg-subtle))] p-4 rounded-lg space-y-2">
                    <p className="font-medium text-[hsl(var(--marketing-text))] mb-2">Your trial includes:</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
                        <span className="text-[hsl(var(--marketing-text))]">14 days free</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
                        <span className="text-[hsl(var(--marketing-text))]">All Professional features</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
                        <span className="text-[hsl(var(--marketing-text))]">Unlimited products & customers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
                        <span className="text-[hsl(var(--marketing-text))]">No credit card required now</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-center text-[hsl(var(--marketing-text-light))]">
                    After trial: ${plans.find((p) => p.id === selectedPlan)?.monthlyPrice}/month • Cancel anytime
                  </p>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(2)}
                      className="flex-1"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" className="flex-1 bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              )}

              {/* STEP 4: Customize Account */}
              {step === 4 && (
                <form onSubmit={handleStep4} className="space-y-4">
                  <div>
                    <Label htmlFor="urlSlug">Your URL *</Label>
                    <div className="flex items-center mt-2">
                      <Input
                        id="urlSlug"
                        value={urlSlug}
                        onChange={(e) => setUrlSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        className="rounded-r-none"
                        required
                      />
                      <span className="px-3 py-2 bg-[hsl(var(--marketing-bg-subtle))] border border-l-0 border-[hsl(var(--marketing-border))] rounded-r-md text-[hsl(var(--marketing-text-light))]">
                        .devpanel.com
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--marketing-text-light))] mt-1">
                      This is where you and your team will log in
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="referralSource">How did you hear about us?</Label>
                    <Select value={referralSource} onValueChange={setReferralSource}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Google search" />
                      </SelectTrigger>
                      <SelectContent>
                        {referralSources.map((source) => (
                          <SelectItem key={source} value={source.toLowerCase()}>
                            {source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>What's your main goal with DevPanel? (optional)</Label>
                    <div className="space-y-2 mt-2">
                      {goalOptions.map((goal) => (
                        <div key={goal} className="flex items-center space-x-2">
                          <Checkbox
                            id={goal}
                            checked={goals.includes(goal)}
                            onCheckedChange={() => toggleGoal(goal)}
                          />
                          <label
                            htmlFor={goal}
                            className="text-sm font-normal cursor-pointer text-[hsl(var(--marketing-text))]"
                          >
                            {goal}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(3)}
                      className="flex-1"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create My Account
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
