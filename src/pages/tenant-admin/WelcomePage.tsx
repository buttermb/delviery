import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Users, 
  Menu, 
  Zap, 
  Check, 
  ArrowRight,
  Sparkles,
  PlayCircle,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useToast } from "@/hooks/use-toast";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  action: string;
  link: string;
  tip?: string;
}

export default function TenantAdminWelcomePage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, admin } = useTenantAdminAuth();
  const { toast } = useToast();
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  // Use tenant usage data for setup status
  const setupStatus = {
    hasProducts: ((tenant as any)?.usage?.products || 0) > 0,
    hasCustomers: ((tenant as any)?.usage?.customers || 0) > 0,
    hasMenus: ((tenant as any)?.usage?.menus || 0) > 0,
    hasOrders: false, // Will be checked via orders existence
  };

  const refetch = () => {}; // Placeholder for refetch

  const generateDemoData = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("No tenant ID");

      // Generate 10 demo products
      const demoProducts = Array.from({ length: 10 }, (_, i) => ({
        tenant_id: tenant.id,
        product_name: `Demo Strain ${i + 1}`,
        strain: `Demo Strain ${i + 1}`,
        category: "flower",
        quantity_lbs: Math.floor(Math.random() * 50) + 10,
        quantity_units: Math.floor(Math.random() * 100) + 20,
        thca_percentage: (Math.random() * 15 + 15).toFixed(1),
        price_per_lb: Math.floor(Math.random() * 500) + 500,
        low_stock_threshold: 10,
      }));

      await supabase.from("wholesale_inventory").insert(demoProducts);

      // Generate 5 demo customers
      const demoCustomers = Array.from({ length: 5 }, (_, i) => ({
        tenant_id: tenant.id,
        business_name: `Demo Customer ${i + 1}`,
        contact_name: `Contact Person ${i + 1}`,
        email: `demo${i + 1}@example.com`,
        phone: `555-${String(i).padStart(3, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
        address: "123 Demo Street, Demo City, NY 10001",
        client_type: "retail",
        credit_limit: Math.floor(Math.random() * 5000) + 1000,
        payment_terms: 30,
        status: "active",
      }));

      await supabase.from("wholesale_clients").insert(demoCustomers);

      // Update tenant usage
      await supabase
        .from("tenants")
        .update({
          usage: {
            ...((tenant as any).usage || {}),
            products: 10,
            customers: 5,
          },
        })
        .eq("id", tenant.id);

      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Demo Data Generated! 🎉",
        description: "10 products and 5 customers have been added to your account",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Generate Demo Data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerateDemo = async () => {
    setIsGeneratingDemo(true);
    await generateDemoData.mutateAsync();
    setIsGeneratingDemo(false);
  };

  const steps: SetupStep[] = [
    {
      id: "products",
      title: "Add Products",
      description: "Import your inventory or start with demo data",
      icon: Package,
      completed: setupStatus?.hasProducts || false,
      action: "Add Products",
      link: `/${tenantSlug}/admin/inventory`,
      tip: "💡 You can import products via CSV to save time",
    },
    {
      id: "customers",
      title: "Add Customers",
      description: "Build your customer base",
      icon: Users,
      completed: setupStatus?.hasCustomers || false,
      action: "Add Customers",
      link: `/${tenantSlug}/admin/big-plug-clients`,
      tip: "💡 Import customer lists from your existing system",
    },
    {
      id: "menus",
      title: "Create a Menu",
      description: "Share products with customers via disposable menus",
      icon: Menu,
      completed: setupStatus?.hasMenus || false,
      action: "Create Menu",
      link: `/${tenantSlug}/admin/disposable-menus`,
      tip: "💡 Menus are temporary and perfect for quick sales",
    },
    {
      id: "orders",
      title: "Receive Your First Order",
      description: "Start processing orders from customers",
      icon: Zap,
      completed: setupStatus?.hasOrders || false,
      action: "View Orders",
      link: `/${tenantSlug}/admin/big-plug-order`,
      tip: "💡 Orders will appear here once customers place them",
    },
  ];

  const completedSteps = steps.filter((s) => s.completed).length;
  const progressPercentage = Math.round((completedSteps / steps.length) * 100);

  // Calculate days left in trial
  const trialEndsAt = (tenant as any)?.trial_ends_at;
  const daysLeft = trialEndsAt 
    ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 14;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--tenant-bg))] to-[hsl(var(--tenant-surface))]/30">
      <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 md:py-12 max-w-6xl">
        {/* Welcome Header */}
        <div className="text-center mb-6 sm:mb-8 md:mb-12">
          <div className="text-4xl sm:text-5xl md:text-6xl mb-4 sm:mb-6 animate-bounce">🎉</div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-4 text-[hsl(var(--tenant-text))] break-words px-2">
            Welcome to {tenant?.business_name || "Your Dashboard"}!
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-[hsl(var(--tenant-text-light))] mb-4 sm:mb-6 px-2">
            Your 14-day trial has started. Let's get you set up in minutes.
          </p>
          <Badge className="bg-[hsl(var(--tenant-primary))] text-white px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base min-h-[44px] touch-manipulation">
            ⏰ {daysLeft} days left in trial
          </Badge>
        </div>

        {/* Progress Overview */}
        <Card className="mb-4 sm:mb-6 md:mb-8 border-2 border-[hsl(var(--tenant-primary))]/20">
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg sm:text-xl md:text-2xl">Setup Progress</CardTitle>
              <div className="text-2xl sm:text-3xl font-bold text-[hsl(var(--tenant-primary))]">
                {progressPercentage}%
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <Progress value={progressPercentage} className="h-2 sm:h-3 mb-4 sm:mb-6" />
            <p className="text-sm sm:text-base text-[hsl(var(--tenant-text-light))]">
              {completedSteps} of {steps.length} steps completed
            </p>
          </CardContent>
        </Card>

        {/* Demo Data Button */}
        {completedSteps === 0 && (
          <Card className="mb-4 sm:mb-6 md:mb-8 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base sm:text-lg mb-1">Want to explore first?</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Generate demo data to see how everything works (10 products + 5 customers)
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleGenerateDemo}
                  disabled={isGeneratingDemo}
                  className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto min-h-[44px] touch-manipulation text-sm sm:text-base"
                >
                  {isGeneratingDemo ? "Generating..." : "Generate Demo Data"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8 md:mb-12">
          {steps.map((step, index) => (
            <Card
              key={step.id}
              className={`hover:shadow-lg transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
                step.completed
                  ? "border-green-200 bg-green-50/50"
                  : "border-[hsl(var(--tenant-border))]"
              }`}
              onClick={() => navigate(step.link)}
            >
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div
                    className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      step.completed
                        ? "bg-green-100"
                        : "bg-[hsl(var(--tenant-primary))]/10"
                    }`}
                  >
                    {step.completed ? (
                      <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    ) : (
                      <step.icon className="h-5 w-5 sm:h-6 sm:w-6 text-[hsl(var(--tenant-primary))]" />
                    )}
                  </div>
                  <Badge variant={step.completed ? "default" : "secondary"} className="text-xs sm:text-sm">
                    Step {index + 1}
                  </Badge>
                </div>
                <CardTitle className="text-base sm:text-lg md:text-xl mb-1 sm:mb-2">{step.title}</CardTitle>
                <p className="text-[hsl(var(--tenant-text-light))] text-xs sm:text-sm mb-3 sm:mb-4">
                  {step.description}
                </p>
                {step.tip && !step.completed && (
                  <p className="text-xs text-purple-600 bg-purple-50 p-2 rounded">
                    {step.tip}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                <Button
                  variant={step.completed ? "outline" : "default"}
                  className="w-full min-h-[44px] touch-manipulation text-sm sm:text-base"
                >
                  <span>{step.completed ? "View" : step.action}</span> <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Resources */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="text-base sm:text-lg md:text-xl">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
              <Button variant="outline" className="h-auto min-h-[44px] py-3 sm:py-4 flex-col gap-2 touch-manipulation" asChild>
                <a href="https://docs.example.com" target="_blank" rel="noopener noreferrer">
                  <BookOpen className="h-5 w-5" />
                  <span className="text-xs sm:text-sm">Documentation</span>
                </a>
              </Button>
              <Button variant="outline" className="h-auto min-h-[44px] py-3 sm:py-4 flex-col gap-2 touch-manipulation" asChild>
                <a href="https://youtube.com/tutorials" target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="h-5 w-5" />
                  <span className="text-xs sm:text-sm">Video Tutorials</span>
                </a>
              </Button>
              <Button variant="outline" className="h-auto min-h-[44px] py-3 sm:py-4 flex-col gap-2 touch-manipulation sm:col-span-2 md:col-span-1" asChild>
                <a href="/contact" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-xs sm:text-sm">Contact Support</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Skip to Dashboard */}
        <div className="text-center mt-4 sm:mt-6 md:mt-8">
          <Button
            variant="ghost"
            onClick={() => navigate(`/${tenantSlug}/admin/dashboard`)}
            className="text-[hsl(var(--tenant-text-light))] min-h-[44px] touch-manipulation text-sm sm:text-base"
          >
            Skip setup and go to dashboard →
          </Button>
        </div>
      </div>
    </div>
  );
}
