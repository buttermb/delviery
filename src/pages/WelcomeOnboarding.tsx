import { useLocation, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package, Users, Smartphone, UserPlus, ArrowRight } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WelcomeOnboarding() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantSlug, name } = location.state || { tenantSlug: "", name: "there" };

  const onboardingActions = [
    {
      icon: Package,
      title: "Import Products",
      description: "Upload a CSV or add manually",
      action: "Start Import →",
      link: `/${tenantSlug}/admin/inventory/products`,
    },
    {
      icon: Users,
      title: "Add Customers",
      description: "Import or add your customers",
      action: "Add Customers →",
      link: `/${tenantSlug}/admin/customers`,
    },
    {
      icon: Smartphone,
      title: "Create Your First Menu",
      description: "Share products with customers",
      action: "Create Menu →",
      link: `/${tenantSlug}/admin/disposable-menus`,
    },
    {
      icon: UserPlus,
      title: "Invite Team Members",
      description: "Collaborate with your team",
      action: "Invite Team →",
      link: `/${tenantSlug}/admin/team`,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEOHead 
        title="Welcome to DevPanel"
        description="Your account is ready. Let's get you set up."
      />
      
      <MarketingNav />

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-12">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Welcome to DevPanel, {name || "there"}!
            </h1>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              Your account is ready. Let's get you set up.
            </p>
          </div>

          <div className="mb-8">
            <p className="text-lg text-[hsl(var(--marketing-text))] mb-8">
              What would you like to do first?
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {onboardingActions.map((action, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(action.link)}>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4 mx-auto">
                      <action.icon className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                    </div>
                    <CardTitle className="text-xl">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full">
                      {action.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate(`/${tenantSlug}/admin/dashboard`)}
            >
              I'll explore on my own →
            </Button>
          </div>

          <div className="mt-12 pt-8 border-t border-[hsl(var(--marketing-border))]">
            <p className="text-sm text-[hsl(var(--marketing-text-light))] mb-4">Need help?</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/contact">Chat with us</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/features">Watch video tour</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

