import { useState, useEffect } from "react";
import { useLocation, Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Package, Users, Smartphone, UserPlus, ArrowRight, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateDemoData } from "@/lib/demoData";
import { OnboardingCompletionModal } from "@/components/onboarding/OnboardingCompletionModal";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logger } from "@/utils/logger";

export default function WelcomeOnboarding() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantSlug: routeSlug } = useParams<{ tenantSlug: string }>();
  const { toast } = useToast();
  const { tenant, admin } = useTenantAdminAuth();
  
  // Get tenant info from either location state (after signup) or auth context (if already logged in)
  const stateData = location.state || {};
  const tenantSlug = routeSlug || stateData.tenantSlug || tenant?.slug || "";
  const tenantId = tenant?.id || stateData.tenantId || "";
  const name = admin?.name || stateData.name || "there";
  const [isGenerating, setIsGenerating] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set());
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Fetch tenant data to get usage counts - prefer auth context tenant, fallback to query
  const effectiveTenantId = tenant?.id || tenantId;
  const { data: tenantData, refetch: refetchTenant } = useQuery({
    queryKey: ["tenant", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;
      try {
        // Try to select onboarding columns, but handle gracefully if they don't exist
        // Query only existing columns first, then add defaults for missing ones
        const { data, error } = await supabase
          .from("tenants")
          .select("usage, limits, onboarding_completed")
          .eq("id", effectiveTenantId)
          .single();
        
        // If columns don't exist (error code 42703), return null for those fields
        if (error && error.code === "42703") {
          // Columns don't exist yet - return basic data without onboarding fields
          const { data: basicData } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", effectiveTenantId)
            .single();
          return {
            ...basicData,
            usage: basicData?.usage || {},
            limits: basicData?.limits || {},
            demo_data_generated: false,
            onboarding_completed: false,
          };
        }
        
        if (error) throw error;
        // Ensure demo_data_generated is always present (defaults to false if column doesn't exist)
        return {
          ...data,
          demo_data_generated: (data as any)?.demo_data_generated ?? false,
        };
      } catch (error: any) {
        // If query fails, return defaults
        logger.warn("Error fetching tenant data", error, { component: 'WelcomeOnboarding' });
        return {
          usage: {},
          limits: {},
          demo_data_generated: false,
          onboarding_completed: false,
        };
      }
    },
    enabled: !!effectiveTenantId,
  });

  // Use tenant from auth context if available, otherwise from query
  const tenantInfo = tenant ? { ...tenant, usage: tenantData?.usage, limits: tenantData?.limits, demo_data_generated: tenantData?.demo_data_generated } : tenantData;

  // Load skipped steps from localStorage
  useEffect(() => {
    if (effectiveTenantId) {
      const stored = localStorage.getItem(`tenant_${effectiveTenantId}_onboarding_progress`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.skipped) {
            setSkippedSteps(new Set(parsed.skipped));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [effectiveTenantId]);

  const usage = (tenantInfo?.usage as any) || {};
  const limits = (tenantInfo?.limits as any) || {};

  const onboardingSteps = [
    {
      id: "account",
      icon: UserPlus,
      title: "Account Created",
      description: "Your account is ready to use",
      completed: true,
      link: null,
    },
    {
      id: "products",
      icon: Package,
      title: "Products Added",
      description: `Add products to your inventory`,
      completed: (usage.products || 0) > 0,
      count: usage.products || 0,
      limit: limits.products || 100,
      link: `/${tenantSlug}/admin/inventory/products`,
    },
    {
      id: "customers",
      icon: Users,
      title: "Customers Added",
      description: `Add customers to your CRM`,
      completed: (usage.customers || 0) > 0,
      count: usage.customers || 0,
      limit: limits.customers || 50,
      link: `/${tenantSlug}/admin/customers`,
    },
    {
      id: "menu",
      icon: Smartphone,
      title: "Menu Created",
      description: `Create your first disposable menu`,
      completed: (usage.menus || 0) > 0,
      count: usage.menus || 0,
      limit: limits.menus || 3,
      link: `/${tenantSlug}/admin/disposable-menus`,
    },
  ];

  const handleGenerateDemoData = async () => {
    if (!effectiveTenantId) {
      toast({
        title: "Error",
        description: "Tenant ID is missing",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateDemoData(effectiveTenantId);
      toast({
        title: "Demo Data Generated!",
        description: "10 products, 5 customers, and 1 menu have been created",
      });
      // Refetch tenant data to update usage counts
      await refetchTenant();
    } catch (error: any) {
      logger.error("Error generating demo data", error, { component: 'WelcomeOnboarding' });
      toast({
        title: "Error",
        description: error.message || "Failed to generate demo data",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkipStep = (stepId: string) => {
    const newSkipped = new Set(skippedSteps);
    newSkipped.add(stepId);
    setSkippedSteps(newSkipped);
    
    if (effectiveTenantId) {
      localStorage.setItem(
        `tenant_${effectiveTenantId}_onboarding_progress`,
        JSON.stringify({ skipped: Array.from(newSkipped) })
      );
    }
  };

  const completedCount = onboardingSteps.filter((step) => step.completed).length;
  const totalSteps = onboardingSteps.length;
  const progressPercentage = (completedCount / totalSteps) * 100;
  const isComplete = completedCount === totalSteps;

  // Show completion modal when all steps are done
  useEffect(() => {
    if (isComplete && !showCompletionModal && effectiveTenantId) {
      // Small delay to ensure state is updated
      const timer = setTimeout(() => {
        setShowCompletionModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, showCompletionModal, effectiveTenantId]);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead 
        title="Welcome to DevPanel"
        description="Your account is ready. Let's get you set up."
      />
      
      <MarketingNav />

      <div className="container mx-auto px-4 py-8 sm:py-12 md:py-20 safe-area-top safe-area-bottom">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8 sm:mb-12">
            <div className="text-4xl sm:text-6xl mb-4">🎉</div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))] px-2">
              Welcome to DevPanel, {name || "there"}!
            </h1>
            <p className="text-base sm:text-xl text-[hsl(var(--marketing-text-light))] px-2">
              Your account is ready. Let's get you set up.
            </p>
          </div>

          {/* Use Demo Data Button */}
          {!tenantInfo?.demo_data_generated && (
            <div className="mb-8">
              <Card className="border-2 border-[hsl(var(--marketing-primary))] bg-gradient-to-r from-[hsl(var(--marketing-primary))]/5 to-[hsl(var(--marketing-secondary))]/5">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-8 w-8 text-[hsl(var(--marketing-primary))]" />
                      <div>
                        <h3 className="text-lg font-semibold text-[hsl(var(--marketing-text))]">
                          Want to explore quickly?
                        </h3>
                        <p className="text-sm text-[hsl(var(--marketing-text-light))]">
                          Generate demo data: 10 products, 5 customers, 1 menu
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleGenerateDemoData}
                      disabled={isGenerating}
                      className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white min-h-[44px] w-full sm:w-auto px-6 touch-manipulation"
                    >
                      {isGenerating ? "Generating..." : "Use Demo Data"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Progress Tracking */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[hsl(var(--marketing-text))]">
                Setup Progress
              </h2>
              <Badge variant="outline" className="text-base sm:text-lg px-3 sm:px-4 py-1.5 sm:py-1 min-h-[44px] sm:min-h-auto flex items-center">
                {completedCount}/{totalSteps} Complete
              </Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {onboardingSteps.map((step) => {
                const isSkipped = skippedSteps.has(step.id);
                const StepIcon = step.icon;

                return (
                  <Card
                    key={step.id}
                    className={`hover:shadow-lg transition-shadow ${
                      step.completed ? "border-green-300 bg-green-50/50" : ""
                    } ${isSkipped ? "opacity-60" : ""}`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center">
                          <StepIcon className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                        </div>
                        {step.completed ? (
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        ) : (
                          <Circle className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      <CardTitle className="text-xl">{step.title}</CardTitle>
                      <CardDescription>
                        {step.description}
                        {step.count !== undefined && (
                          <span className="block mt-1 text-xs">
                            {step.count}/{step.limit} items
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                {step.link && !step.completed && (
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px] touch-manipulation text-sm sm:text-base"
                    onClick={() => navigate(step.link!)}
                  >
                    <span className="hidden sm:inline">Complete This →</span>
                    <span className="sm:hidden">Complete →</span>
                  </Button>
                )}
                {!step.completed && !isSkipped && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs sm:text-sm min-h-[44px] touch-manipulation"
                    onClick={() => handleSkipStep(step.id)}
                  >
                    Skip
                  </Button>
                )}
                      {isSkipped && (
                        <p className="text-xs text-gray-500 text-center">Skipped</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              size="lg"
              className="min-h-[44px] w-full sm:w-auto touch-manipulation"
              onClick={() => {
                if (tenantSlug) {
                  navigate(`/${tenantSlug}/admin/dashboard`);
                } else {
                  toast({
                    title: "Error",
                    description: "Tenant slug is missing. Please log in again.",
                    variant: "destructive",
                  });
                }
              }}
            >
              <span className="hidden sm:inline">I'll explore on my own →</span>
              <span className="sm:hidden">Explore Dashboard →</span>
            </Button>
          </div>

          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-[hsl(var(--marketing-border))]">
            <p className="text-sm text-[hsl(var(--marketing-text-light))] mb-4">Need help?</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="min-h-[44px] touch-manipulation"
                asChild
              >
                <Link to="/contact">Chat with us</Link>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="min-h-[44px] touch-manipulation"
                asChild
              >
                <Link to="/features">Watch video tour</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Completion Modal */}
        <OnboardingCompletionModal
        open={showCompletionModal}
        onOpenChange={setShowCompletionModal}
        tenantSlug={tenantSlug}
        tenantId={effectiveTenantId}
      />
    </div>
  );
}

