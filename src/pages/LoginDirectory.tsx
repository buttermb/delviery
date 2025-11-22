import { logger } from '@/lib/logger';
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Building2, ShoppingCart, ArrowRight, Users, Cog, Package, Truck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { safeStorage } from "@/utils/safeStorage";

export default function LoginDirectory() {
  const navigate = useNavigate();
  const loginPortals = [
    {
      icon: Shield,
      title: "Super Admin",
      badge: "Platform Management",
      description: "Access the platform-wide administration panel. Manage all tenants, monitor system health, and configure global settings.",
      features: [
        "Manage all tenant accounts",
        "System monitoring & analytics",
        "Platform-wide settings",
        "Billing & subscriptions"
      ],
      loginUrl: "/super-admin/login",
      buttonText: "Super Admin Login",
      color: "from-red-500/10 to-red-500/5 border-red-500/20",
      iconColor: "text-red-600",
      forWho: "Platform administrators only"
    },
    {
      icon: Building2,
      title: "Business Owner",
      badge: "Tenant Admin",
      description: "Manage your cannabis business operations, inventory, compliance, and marketplace presence. Access retail, wholesale, and delivery management tools.",
      features: [
        "Inventory & compliance tracking",
        "Retail & wholesale orders",
        "Team & delivery management",
        "Marketplace selling (Medium+ tier)"
      ],
      loginUrl: "/saas/login",
      buttonText: "Business Admin Login",
      color: "from-blue-500/10 to-blue-500/5 border-blue-500/20",
      iconColor: "text-blue-600",
      forWho: "Business owners & administrators"
    },
    {
      icon: ShoppingCart,
      title: "Customer Portal",
      badge: "Customer Access",
      description: "Shop cannabis products from local dispensaries (Retail Mode) or browse wholesale marketplace for bulk purchases (Wholesale Mode - business license required).",
      features: [
        "Browse & order products (Retail)",
        "Wholesale marketplace (B2B)",
        "Switch between Retail/Wholesale",
        "Order tracking & history"
      ],
      loginUrl: "/customer/login",
      buttonText: "Customer Login",
      color: "from-green-500/10 to-green-500/5 border-green-500/20",
      iconColor: "text-green-600",
      forWho: "Retail & wholesale customers"
    },
    {
      icon: Truck,
      title: "Courier Portal",
      badge: "Delivery Driver",
      description: "Access your courier dashboard for licensed cannabis delivery. View available orders, manage deliveries, track earnings, and update your status.",
      features: [
        "View available orders",
        "Track active deliveries",
        "Real-time earnings",
        "Location & compliance tracking"
      ],
      loginUrl: "/courier/login",
      buttonText: "Courier Login",
      color: "from-orange-500/10 to-orange-500/5 border-orange-500/20",
      iconColor: "text-orange-600",
      forWho: "Licensed delivery drivers"
    },
    {
      icon: Package,
      title: "Vendor Portal",
      badge: "Supplier Access",
      description: "External vendor access for suppliers and partners. Manage your product listings, view orders, and track payments in the FloraIQ marketplace.",
      features: [
        "Manage product listings",
        "View wholesale orders",
        "Track payments & invoices",
        "Communication with buyers"
      ],
      loginUrl: "/vendor/login",
      buttonText: "Vendor Login",
      color: "from-purple-500/10 to-purple-500/5 border-purple-500/20",
      iconColor: "text-purple-600",
      forWho: "External suppliers & vendors"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Login Portal Directory | FloraIQ"
        description="Access your FloraIQ cannabis technology platform. Choose from Business Admin, Customer, Courier, Vendor, or Super Admin portals."
      />
      
      <MarketingNav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4">Login Portal</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
              Welcome Back to
              <span className="block text-primary">FloraIQ</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Access your FloraIQ cannabis technology platform based on your role.
            </p>
          </div>
        </div>
      </section>

      {/* Login Options */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            {loginPortals.map((portal, index) => (
              <Card 
                key={index} 
                className={`overflow-hidden hover:shadow-xl transition-all bg-gradient-to-br ${portal.color}`}
              >
                <CardContent className="p-8">
                  <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 items-start">
                    {/* Icon */}
                    <div className={`p-4 rounded-xl bg-background shadow-sm`}>
                      <portal.icon className={`h-12 w-12 ${portal.iconColor}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-foreground">{portal.title}</h2>
                        <Badge variant="outline">{portal.badge}</Badge>
                      </div>
                      <p className="text-muted-foreground mb-4">{portal.description}</p>
                      
                      {/* Features */}
                      <div className="grid sm:grid-cols-2 gap-2 mb-4">
                        {portal.features.map((feature, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <div className={`p-0.5 rounded-full ${portal.iconColor} bg-background mt-0.5`}>
                              <Package className="h-3 w-3" />
                            </div>
                            <span className="text-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-muted-foreground italic">
                        <Users className="h-3 w-3 inline mr-1" />
                        {portal.forWho}
                      </p>
                    </div>

                    {/* Action Button */}
                    <div className="flex flex-col gap-3">
                      <Link 
                        to={portal.loginUrl} 
                        onClick={async (e) => {
                          // For business owner login, check if we have a saved tenant
                          if (portal.title === "Business Owner") {
                            const lastTenant = safeStorage.getItem('lastTenantSlug');
                            if (lastTenant) {
                              e.preventDefault();
                              
                              try {
                                // Validate tenant exists via edge function
                                const { data, error } = await supabase.functions.invoke('validate-tenant', {
                                  body: { slug: lastTenant }
                                });
                                
                                if (error || !data?.valid) {
                                  // Invalid tenant - clear and fall back to generic login
                                  logger.warn('[LoginDirectory] Invalid tenant slug, clearing', { slug: lastTenant });
                                  safeStorage.removeItem('lastTenantSlug');
                                  navigate('/saas/login');
                                  return;
                                }
                                
                                // Valid tenant - proceed with redirect
                                navigate(`/${lastTenant}/admin/login`);
                              } catch (err) {
                                // Network error - fall back to generic login
                                logger.error('[LoginDirectory] Tenant validation failed', err);
                                navigate('/saas/login');
                              }
                            }
                          }
                        }}
                      >
                        <Button size="lg" className="w-full">
                          {portal.buttonText}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* New User Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-8 text-center">
                <div className="p-4 rounded-lg bg-primary/10 w-fit mx-auto mb-4">
                  <Cog className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                  New to FloraIQ?
                </h2>
                <p className="text-muted-foreground mb-6">
                  Ready to transform your cannabis business? Start your 14-day free trial today.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to="/signup">
                    <Button size="lg">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/demo">
                    <Button size="lg" variant="outline">
                      Schedule a Demo
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Community Forum Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="p-8 text-center">
                <div className="p-4 rounded-lg bg-green-500/10 w-fit mx-auto mb-4">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                  Join Our Community Forum
                </h2>
                <p className="text-muted-foreground mb-6">
                  Connect with other cannabis professionals, share experiences, ask questions, and stay updated with industry insights.
                </p>
                <Link to="/community">
                  <Button size="lg">
                    Visit Community Forum
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-4 text-foreground">
              Need Help Logging In?
            </h3>
            <p className="text-muted-foreground mb-6">
              If you're unsure which portal to use or having trouble logging in, our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/support">
                <Button variant="outline">
                  Contact Support
                </Button>
              </Link>
              <Link to="/faq">
                <Button variant="outline">
                  View FAQ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
