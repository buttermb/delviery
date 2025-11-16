import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card } from "@/components/ui/card";
import { CTASection } from "@/components/marketing/CTASection";
import { FeatureComparisonTable } from "@/components/pricing/FeatureComparisonTable";

const plans = [
  {
    name: "BASIC",
    monthlyPrice: 79,
    yearlyPrice: 790,
    description: "Perfect for small businesses getting started",
    features: [
      "28 Core Features",
      "50 customers",
      "100 products",
      "2 locations",
      "3 team members",
      "Basic analytics",
      "Email support",
      "Disposable menus",
      "Inventory management",
      "Customer CRM",
      "Orders & invoicing",
    ],
  },
  {
    name: "PROFESSIONAL",
    monthlyPrice: 150,
    yearlyPrice: 1500,
    description: "Ideal for growing businesses",
    popular: true,
    features: [
      "All Basic Features",
      "55 Total Features",
      "500 customers",
      "1,000 products",
      "5 locations",
      "15 team members",
      "Advanced CRM",
      "Marketing automation",
      "Quality control",
      "Advanced analytics",
      "Live orders dashboard",
      "POS system (basic)",
      "Priority support",
    ],
  },
  {
    name: "ENTERPRISE",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    description: "Complete solution for large operations",
    features: [
      "All Professional Features",
      "All 87 Features",
      "Unlimited customers",
      "Unlimited products",
      "Unlimited locations",
      "Unlimited team members",
      "Fleet management",
      "Delivery tracking",
      "Route optimization",
      "API access & webhooks",
      "White-label branding",
      "Custom domain",
      "Workflow automation",
      "24/7 priority support",
      "Dedicated account manager",
    ],
  },
];

const addons = [
  {
    name: "SMS Notifications",
    price: "0.02",
    unit: "per message",
    icon: "💬",
  },
  {
    name: "Email Credits",
    price: "0.001",
    unit: "per email",
    icon: "📧",
  },
  {
    name: "Label Printing",
    price: "0.015",
    unit: "per label",
    icon: "🏷️",
  },
  {
    name: "Extra Storage",
    price: "10",
    unit: "per 50GB",
    icon: "💾",
  },
];

const faqs = [
  {
    q: "Can I change plans later?",
    a: "Yes! Upgrade or downgrade anytime. Changes take effect immediately with prorated billing.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, ACH, and wire transfer for Enterprise plans.",
  },
  {
    q: "Is there a setup fee?",
    a: "No setup fees. Ever.",
  },
  {
    q: "What happens after the trial?",
    a: "You can choose a plan or your account will revert to free (limited features). No charges without your approval.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes, 30-day money-back guarantee, no questions asked.",
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const getPrice = (plan: typeof plans[0]) => {
    return billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  };

  const getSavings = (plan: typeof plans[0]) => {
    if (billingCycle === "yearly") {
      const monthlyTotal = plan.monthlyPrice * 12;
      return monthlyTotal - plan.yearlyPrice;
    }
    return 0;
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--marketing-bg))]">
      <SEOHead 
        title="Pricing - DevPanel | Simple, Transparent Pricing"
        description="Simple, transparent pricing for wholesale distributors. Plans from $79/month. Start free, upgrade as you grow. 14-day free trial."
      />
      
      <MarketingNav />

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-[hsl(var(--marketing-text-light))] mb-8">
          No hidden fees. Cancel anytime.
        </p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center gap-4 mb-8">
          <button
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

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--marketing-accent))]/10 text-sm text-[hsl(var(--marketing-text))]">
          <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
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
                  ? "border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/5 shadow-xl scale-105"
                  : "border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[hsl(var(--marketing-primary))] text-white text-sm font-bold">
                  ⭐ MOST POPULAR
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2 text-[hsl(var(--marketing-text))]">{plan.name}</h3>
                <p className="text-sm text-[hsl(var(--marketing-text-light))] mb-4">{plan.description}</p>
                <div className="mb-2">
                  <span className="text-5xl font-bold text-[hsl(var(--marketing-text))]">
                    ${getPrice(plan)}
                  </span>
                  <span className="text-[hsl(var(--marketing-text-light))]">/{billingCycle === "monthly" ? "month" : "year"}</span>
                </div>
                {billingCycle === "yearly" && (
                  <div className="text-sm text-[hsl(var(--marketing-accent))]">
                    Save ${getSavings(plan)}
                  </div>
                )}
              </div>

              <Link to="/signup">
                <Button
                  className="w-full mb-6"
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.name === "ENTERPRISE" ? "Contact Sales" : "Start Free"}
                </Button>
              </Link>

              <div className="space-y-3">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))] flex-shrink-0 mt-0.5" />
                    <span className="text-[hsl(var(--marketing-text))]">{feature}</span>
                  </div>
                ))}
              </div>

              {plan.name === "PROFESSIONAL" && (
                <div className="mt-6 pt-6 border-t border-[hsl(var(--marketing-border))]">
                  <p className="text-sm text-center text-[hsl(var(--marketing-text-light))]">
                    14-day trial
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Complete Feature Comparison
            </h2>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              See exactly what's included in each plan - all 87 features side-by-side
            </p>
          </div>
          <FeatureComparisonTable />
        </div>
      </section>

      {/* Add-ons */}
      <section className="container mx-auto px-4 py-16 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-[hsl(var(--marketing-text))]">
            ADD-ONS (Optional)
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mt-8">
            {addons.map((addon, index) => (
              <Card key={index} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{addon.icon}</span>
                    <div>
                      <h3 className="font-bold text-[hsl(var(--marketing-text))]">{addon.name}</h3>
                      <p className="text-sm text-[hsl(var(--marketing-text-light))]">{addon.unit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[hsl(var(--marketing-primary))]">
                      ${addon.price}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* All Plans Include */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-[hsl(var(--marketing-text))]">
            ALL PLANS INCLUDE:
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              "14-day free trial",
              "No credit card required",
              "Cancel anytime",
              "30-day money-back guarantee",
              "Free data migration",
              "Free training & onboarding",
              "99.9% uptime SLA",
              "Bank-level security",
              "GDPR & CCPA compliant",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))] flex-shrink-0" />
                <span className="text-sm text-[hsl(var(--marketing-text))]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-[hsl(var(--marketing-text))]">
            FREQUENTLY ASKED QUESTIONS
          </h2>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <Card key={index} className="p-6">
                <h3 className="font-bold mb-2 text-[hsl(var(--marketing-text))]">{faq.q}</h3>
                <p className="text-sm text-[hsl(var(--marketing-text-light))]">{faq.a}</p>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/faq">
              <Button variant="ghost">
                View All FAQs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <CTASection
        title="Ready to get started?"
        description="Start your 14-day free trial today. No credit card required."
        primaryCta={{
          text: "Start Your 14-Day Free Trial →",
          link: "/signup",
        }}
        secondaryCta={{
          text: "Schedule a Demo",
          link: "/demo",
        }}
      />

      <MarketingFooter />
    </div>
  );
}
