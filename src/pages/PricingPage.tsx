import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, ArrowRight } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const plans = [
  {
    name: "Starter",
    price: 99,
    yearlyPrice: 990,
    description: "Perfect for new THCA businesses getting started",
    features: [
      "1 Location",
      "1,000 Products",
      "5 Team Members",
      "500 Orders/month",
      "Basic Inventory Management",
      "Order Management",
      "Customer Portal",
      "Basic Analytics",
      "Email Support"
    ],
    limitations: [
      "No API Access",
      "No White-Label",
      "No Multi-Location",
      "No Advanced Analytics"
    ]
  },
  {
    name: "Professional",
    price: 299,
    yearlyPrice: 2990,
    description: "Most popular for growing businesses",
    popular: true,
    features: [
      "3 Locations",
      "5,000 Products",
      "15 Team Members",
      "2,000 Orders/month",
      "Advanced Inventory Management",
      "Multi-Location Support",
      "Purchase Orders & Vendors",
      "Advanced Analytics & Forecasting",
      "API Access",
      "Custom Reports",
      "Priority Support",
      "Appointment Booking",
      "Label Generation"
    ],
    limitations: [
      "No White-Label",
      "Limited Custom Integrations"
    ]
  },
  {
    name: "Enterprise",
    price: 699,
    yearlyPrice: 6990,
    description: "Unlimited everything for large operations",
    features: [
      "Unlimited Locations",
      "Unlimited Products",
      "Unlimited Team Members",
      "Unlimited Orders",
      "Everything in Professional",
      "White-Label Options",
      "Custom Domain",
      "Custom Integrations",
      "Dedicated Account Manager",
      "24/7 Priority Support",
      "Custom Mobile App",
      "Advanced Security Features",
      "Custom Development Hours"
    ],
    limitations: []
  }
];

const addons = [
  {
    name: "AI Forecasting & Insights",
    price: 99,
    description: "Demand forecasting, inventory optimization, and predictive analytics"
  },
  {
    name: "White-Label Mobile App",
    price: 299,
    description: "Custom branded iOS and Android apps for your business"
  },
  {
    name: "Additional Location",
    price: 50,
    description: "Add extra locations beyond your plan limit"
  },
  {
    name: "Metrc Integration",
    price: 149,
    description: "Full bi-directional sync with state compliance systems"
  }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background">
      <SEOHead 
        title="Pricing Plans | BuddasH Platform"
        description="Simple, transparent pricing for THCA operations. Start with our 14-day free trial. Plans from $99/month."
        keywords="THCA software pricing, cannabis platform cost, dispensary software"
      />

      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">
            BuddasH <span className="text-primary">Platform</span>
          </Link>
          
          <Link to="/signup">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Choose the plan that fits your business. All plans include 14-day free trial.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-sm">
          <CheckCircle className="h-4 w-4 text-primary" />
          No credit card required • Cancel anytime
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`relative rounded-2xl border p-8 ${
                plan.popular
                  ? 'border-primary bg-primary/5 shadow-xl scale-105'
                  : 'border-border bg-card'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  MOST POPULAR
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <div className="mb-2">
                  <span className="text-5xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  ${plan.yearlyPrice}/year (save ${(plan.price * 12) - plan.yearlyPrice})
                </div>
              </div>

              <Link to="/signup">
                <Button className="w-full mb-6" variant={plan.popular ? "default" : "outline"}>
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <div className="space-y-3">
                <div className="text-sm font-semibold mb-2">What's included:</div>
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
                
                {plan.limitations.length > 0 && (
                  <>
                    <div className="text-sm font-semibold mt-4 mb-2 text-muted-foreground">Not included:</div>
                    {plan.limitations.map((limitation, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <X className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{limitation}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Powerful Add-Ons
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Enhance your plan with premium features
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {addons.map((addon, index) => (
              <div key={index} className="p-6 rounded-xl border border-border bg-card">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold">{addon.name}</h3>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">${addon.price}</div>
                    <div className="text-xs text-muted-foreground">/month</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{addon.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16 bg-muted/30 rounded-3xl">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: "Can I change plans anytime?",
                a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference."
              },
              {
                q: "What happens after the free trial?",
                a: "Your trial converts to a paid subscription automatically. You'll be charged only after your 14-day trial ends. Cancel anytime before that with no charges."
              },
              {
                q: "Do you offer discounts for annual billing?",
                a: "Yes! Save 2 months when you pay annually. For example, the Professional plan is $2,990/year instead of $3,588."
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards (Visa, Mastercard, Amex, Discover) and ACH bank transfers for annual plans."
              },
              {
                q: "Can I get a custom plan?",
                a: "Absolutely! Contact us for custom Enterprise plans with specific features, custom integrations, or unique requirements."
              },
              {
                q: "Is there a setup fee?",
                a: "No setup fees. Ever. We'll help you get started at no extra cost."
              }
            ].map((faq, index) => (
              <div key={index} className="p-6 rounded-xl bg-card border border-border">
                <h3 className="font-bold mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center p-12 rounded-3xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20">
          <h2 className="text-4xl font-bold mb-4">
            Still Have Questions?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Schedule a personalized demo with our team
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/demo">
              <Button size="lg" variant="outline" className="h-12 px-8">
                Schedule Demo
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
