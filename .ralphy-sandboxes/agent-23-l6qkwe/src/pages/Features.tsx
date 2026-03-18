import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Smartphone, Package, ShoppingCart, Users, BarChart3 } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CTASection } from "@/components/marketing/CTASection";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

export default function Features() {
  const features = [
    {
      icon: Smartphone,
      title: "DISPOSABLE MENUS",
      description: "Create encrypted product catalogs that your customers can access via a secure link. Set expiration times or burn after first view for maximum security.",
      benefits: [
        "Encrypted with bank-level security",
        "Burns after viewing or time expires",
        "Track who viewed and when",
        "Custom pricing per customer",
        "Mobile-optimized customer experience",
      ],
    },
    {
      icon: Package,
      title: "INVENTORY MANAGEMENT",
      description: "Track inventory in real-time across multiple locations. Barcode scanning, low stock alerts, batch tracking, and automated reordering.",
      benefits: [
        "Real-time inventory tracking",
        "Barcode/QR code scanning",
        "Multi-location support",
        "Low stock alerts",
        "Batch & expiry tracking",
        "Automated reorder points",
      ],
    },
    {
      icon: ShoppingCart,
      title: "ORDER MANAGEMENT",
      description: "Manage orders from creation to delivery. Approval workflows, automatic invoicing, delivery tracking, and payment processing.",
      benefits: [
        "Order approval workflows",
        "Automatic invoice generation",
        "Delivery tracking & routing",
        "Payment processing",
        "Order history & analytics",
        "Automated order confirmations",
      ],
    },
    {
      icon: Users,
      title: "CUSTOMER PORTAL",
      description: "Give your customers a beautiful, white-labeled portal to browse products, place orders, and track deliveries 24/7 without calling you.",
      benefits: [
        "White-label with your branding",
        "24/7 self-service ordering",
        "Order history & tracking",
        "Custom pricing per customer",
        "Mobile-responsive",
        "Secure login",
      ],
    },
    {
      icon: BarChart3,
      title: "ANALYTICS & REPORTING",
      description: "Real-time insights into your business. Track sales, inventory, customer behavior, and more with beautiful, actionable dashboards.",
      benefits: [
        "Sales analytics",
        "Inventory reports",
        "Customer insights",
        "Product performance",
        "Custom reports",
        "Export to Excel/PDF",
      ],
    },
  ];

  return (
    <ForceLightMode>
      <div className="min-h-dvh bg-[hsl(var(--marketing-bg))]">
        <SEOHead
          title="Features - FloraIQ | Everything You Need in One Platform"
          description="Comprehensive features for wholesale distributors: disposable menus, inventory tracking, order management, customer portal, and analytics."
        />

        <MarketingNav />

        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Everything You Need in One Platform
            </h1>
          </div>

          {features.map((feature, index) => (
            <div key={index} className="max-w-6xl mx-auto mb-24">
              <div className="border-t border-[hsl(var(--marketing-border))] pt-16">
                <div className={`grid md:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                  <div className={index % 2 === 1 ? "md:order-2" : ""}>
                    <div className="w-16 h-16 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-6">
                      <feature.icon className="h-8 w-8 text-[hsl(var(--marketing-primary))]" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
                      {feature.title}
                    </h2>
                    <p className="text-xl text-[hsl(var(--marketing-text-light))] mb-6">
                      {feature.description}
                    </p>
                    <ul className="space-y-3 mb-6">
                      {feature.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-[hsl(var(--marketing-accent))] flex-shrink-0 mt-0.5" />
                          <span className="text-[hsl(var(--marketing-text))]">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    {index === 0 && (
                      <Link to="/menu/example">
                        <Button variant="outline" size="lg">
                          See Example Menu
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                  <div className={index % 2 === 1 ? "md:order-1" : ""}>
                    <div className="aspect-video bg-[hsl(var(--marketing-primary))] rounded-2xl flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-4 flex items-center justify-center">
                          <feature.icon className="h-10 w-10" />
                        </div>
                        <p className="text-sm opacity-80">Screenshot</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        <CTASection
          title="Ready to Get Started?"
          description="Start your 14-day free trial and experience all these features."
          primaryCta={{
            text: "Start Free Trial →",
            link: "/signup",
          }}
        />

        <MarketingFooter />
      </div>
    </ForceLightMode>
  );
}

