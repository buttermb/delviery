import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Building2, ShoppingCart, ArrowRight, Users, Cog, Package, Truck } from "lucide-react";
import { Link } from "react-router-dom";

export default function LoginDirectory() {
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
      description: "Access your business administration dashboard. Manage operations, inventory, orders, and team members.",
      features: [
        "Order & inventory management",
        "Team & location management",
        "Business analytics",
        "Customer management"
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
      description: "Access your customer account. Browse products, place orders, track deliveries, and manage your profile.",
      features: [
        "Browse product catalogs",
        "Place & track orders",
        "Order history & invoices",
        "Profile management"
      ],
      loginUrl: "/customer/login",
      buttonText: "Customer Login",
      color: "from-green-500/10 to-green-500/5 border-green-500/20",
      iconColor: "text-green-600",
      forWho: "Customers & end users"
    },
    {
      icon: Truck,
      title: "Courier Portal",
      badge: "Delivery Driver",
      description: "Access your courier dashboard. View available orders, manage deliveries, track earnings, and update your status.",
      features: [
        "View available orders",
        "Track active deliveries",
        "Real-time earnings",
        "Location tracking"
      ],
      loginUrl: "/courier/login",
      buttonText: "Courier Login",
      color: "from-orange-500/10 to-orange-500/5 border-orange-500/20",
      iconColor: "text-orange-600",
      forWho: "Delivery drivers & couriers"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Login Portal Directory | DevPanel"
        description="Access your DevPanel account. Choose from Super Admin, Business Admin, or Customer portals."
      />
      
      <MarketingNav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4">Login Portal</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
              Welcome Back to
              <span className="block text-primary">DevPanel</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Choose the appropriate portal based on your role to access your account.
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
                        onClick={(e) => {
                          // For business owner login, check if we have a saved tenant
                          if (portal.title === "Business Owner") {
                            const lastTenant = localStorage.getItem('lastTenantSlug');
                            if (lastTenant) {
                              e.preventDefault();
                              window.location.href = `/${lastTenant}/admin/login`;
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
                  New to DevPanel?
                </h2>
                <p className="text-muted-foreground mb-6">
                  Ready to transform your wholesale business? Start your 14-day free trial today.
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
