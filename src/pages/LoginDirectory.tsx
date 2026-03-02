import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ShoppingCart,
  ArrowRight,
  Package,
  Truck,
  LockKeyhole,
  Check
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeStorage } from "@/utils/safeStorage";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

export default function LoginDirectory() {
  const navigate = useNavigate();

  // Main user portals
  const mainPortals = [
    {
      icon: Building2,
      title: "Business Owner",
      subtitle: "Dispensary & Retail Management",
      description: "Complete control over your cannabis operations with real-time inventory, compliance tracking, and marketplace tools.",
      features: [
        "Real-time inventory sync",
        "Compliance & METRC integration",
        "POS & retail management",
        "Wholesale marketplace access"
      ],
      loginUrl: "/saas/login",
      buttonText: "Access Business Portal",
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "hover:border-blue-200"
    },
    {
      icon: ShoppingCart,
      title: "Customer",
      subtitle: "Shop & Order Cannabis",
      description: "Browse products from licensed dispensaries, place orders for pickup or delivery, and track everything in real-time.",
      features: [
        "Browse local dispensaries",
        "Secure online ordering",
        "Real-time order tracking",
        "Loyalty rewards & deals"
      ],
      loginUrl: "/customer/login",
      buttonText: "Start Shopping",
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "hover:border-emerald-200"
    },
    {
      icon: Truck,
      title: "Courier",
      subtitle: "Delivery Driver Portal",
      description: "Manage your delivery routes, accept orders, track earnings, and maintain compliance—all from one dashboard.",
      features: [
        "Smart route optimization",
        "Real-time order queue",
        "Earnings & tip tracking",
        "Compliance documentation"
      ],
      loginUrl: "/courier/login",
      buttonText: "Driver Dashboard",
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "hover:border-orange-200"
    },
    {
      icon: Package,
      title: "Vendor",
      subtitle: "Supplier & Wholesale",
      description: "List your products on the B2B marketplace, manage wholesale orders, and connect with dispensaries across the network.",
      features: [
        "Product catalog management",
        "Wholesale order fulfillment",
        "Invoice & payment tracking",
        "Direct buyer messaging"
      ],
      loginUrl: "/vendor/login",
      buttonText: "Vendor Portal",
      iconColor: "text-violet-600",
      bgColor: "bg-violet-50",
      borderColor: "hover:border-violet-200"
    }
  ];

  return (
    <ForceLightMode>
      <div className="min-h-dvh bg-white flex flex-col font-sans">
        <SEOHead
          title="Login | FloraIQ - Cannabis Technology Platform"
          description="Access your FloraIQ cannabis technology platform. Choose from Business Admin, Customer, Courier, or Vendor portals."
        />

        <MarketingNav />

        <main className="flex-grow pt-28 pb-16">
          <div className="container mx-auto px-4 max-w-5xl">

            {/* Header */}
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-sm font-medium text-primary mb-4">Cannabis Technology Platform</p>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
                Welcome to FloraIQ
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Select your portal to access the platform
              </p>
            </div>

            {/* Main Portal Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto mb-16">
              {mainPortals.map((portal, index) => (
                <Card
                  key={index}
                  className={`group overflow-hidden transition-all duration-200 hover:shadow-lg border ${portal.borderColor} hover:-translate-y-0.5`}
                >
                  <CardContent className="p-6 h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl ${portal.bgColor} ${portal.iconColor}`}>
                        <portal.icon className="h-6 w-6" strokeWidth={1.5} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold text-foreground mb-1">{portal.title}</h2>
                      <p className="text-sm text-muted-foreground/80 mb-3">{portal.subtitle}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {portal.description}
                      </p>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-5">
                      {portal.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className={`h-3 w-3 ${portal.iconColor} flex-shrink-0`} />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="pt-4 mt-auto border-t">
                      <Link
                        to={portal.loginUrl}
                        className="block"
                        onClick={async (e) => {
                          if (portal.title === "Business Owner") {
                            const lastTenant = safeStorage.getItem('lastTenantSlug');
                            if (lastTenant) {
                              e.preventDefault();
                              try {
                                const { data, error } = await supabase.functions.invoke('validate-tenant', {
                                  body: { slug: lastTenant }
                                });
                                if (error || !data?.valid) {
                                  safeStorage.removeItem('lastTenantSlug');
                                  navigate('/saas/login');
                                  return;
                                }
                                navigate('/saas/login');
                              } catch {
                                navigate('/saas/login');
                              }
                            }
                          }
                        }}
                      >
                        <Button className="w-full" size="lg">
                          {portal.buttonText}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Bottom Section */}
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 py-8 border-t">

              {/* New User */}
              <div className="text-center p-5">
                <h3 className="font-semibold mb-2">New to FloraIQ?</h3>
                <p className="text-sm text-muted-foreground mb-4">Start your 14-day free trial.</p>
                <div className="flex flex-col gap-2">
                  <Link to="/signup">
                    <Button className="w-full">Start Free Trial</Button>
                  </Link>
                  <Link to="/demo">
                    <Button variant="outline" className="w-full">Request Demo</Button>
                  </Link>
                </div>
              </div>

              {/* Community */}
              <div className="text-center p-5">
                <h3 className="font-semibold mb-2">Join the Community</h3>
                <p className="text-sm text-muted-foreground mb-4">Connect with cannabis professionals.</p>
                <Link to="/community">
                  <Button variant="outline" className="w-full">Visit Forum</Button>
                </Link>
              </div>

              {/* Support */}
              <div className="text-center p-5">
                <h3 className="font-semibold mb-2">Need Support?</h3>
                <p className="text-sm text-muted-foreground mb-4">Our team is available 24/7.</p>
                <div className="flex flex-col gap-2">
                  <Link to="/support">
                    <Button variant="outline" className="w-full">Contact Support</Button>
                  </Link>
                  <Link to="/faq">
                    <Button variant="ghost" className="w-full text-muted-foreground">View FAQ</Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Admin Footer Link */}
            <div className="mt-10 text-center">
              <Link
                to="/super-admin/login"
                className="inline-flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-primary transition-colors"
              >
                <LockKeyhole className="h-3 w-3" />
                <span>Platform Administration</span>
              </Link>
            </div>
          </div>
        </main>

        <MarketingFooter />
      </div>
    </ForceLightMode>
  );
}

