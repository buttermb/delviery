import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Coins, Sparkles, TrendingUp, Calculator, Zap } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card } from "@/components/ui/card";
import { CTASection } from "@/components/marketing/CTASection";
import { FeatureComparisonTable } from "@/components/pricing/FeatureComparisonTable";
import { Badge } from "@/components/ui/badge";
import { FREE_TIER_MONTHLY_CREDITS, CREDIT_PACKAGES } from "@/lib/credits";

const plans = [
  {
    name: "FREE",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Try everything with monthly credits",
    isFree: true,
    features: [
      `${FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits/month`,
      "All core features",
      "50 customers",
      "100 products",
      "1 location",
      "Email support",
      "No credit card required",
      "Upgrade anytime",
    ],
  },
  {
    name: "STARTER",
    monthlyPrice: 79,
    yearlyPrice: 790,
    description: "Unlimited usage for small businesses",
    features: [
      "Unlimited usage",
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
      "All Starter Features",
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
    q: "How does the free tier work?",
    a: `You get ${FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits every month that auto-refill. Each action uses credits (e.g., receiving an order = 75 credits, creating a menu = 100 credits). Perfect for getting started or light users. Active businesses typically find subscriptions more cost-effective within the first week.`,
  },
  {
    q: "Can I change plans later?",
    a: "Yes! Upgrade or downgrade anytime. Changes take effect immediately with prorated billing. You can also switch between free and paid plans.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, ACH, and wire transfer for Enterprise plans. Free tier requires no payment method.",
  },
  {
    q: "Is there a setup fee?",
    a: "No setup fees. Ever. Start free and only pay when you're ready.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "You can purchase more credits instantly at any time. Paid plans give you unlimited usage - no credits to worry about. Most active businesses find upgrading is much more cost-effective than buying credit packs.",
  },
  {
    q: "Why choose a paid plan over buying credits?",
    a: "Credit packs are great for occasional use, but they're designed to encourage subscription. For example, $79/month for Starter gives unlimited usage - that's less than what 2-3 days of active credit usage would cost. The math is simple: if you're active, subscribe!",
  },
  {
    q: "Can I get a refund?",
    a: "Yes, 30-day money-back guarantee on all paid plans, no questions asked.",
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
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const isFree = (plan as any).isFree;
            
            return (
              <div
                key={index}
                className={`relative rounded-2xl border p-6 ${
                  plan.popular
                    ? "border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/5 shadow-xl md:scale-105"
                    : isFree
                    ? "border-emerald-500/50 bg-emerald-500/5 border-dashed"
                    : "border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[hsl(var(--marketing-primary))] text-white text-sm font-bold whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                
                {isFree && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-white px-3 py-1">
                      <Coins className="h-3 w-3 mr-1" />
                      FREE FOREVER
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-6 pt-2">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {isFree && <Coins className="h-5 w-5 text-emerald-500" />}
                    <h3 className="text-xl font-bold text-[hsl(var(--marketing-text))]">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-[hsl(var(--marketing-text-light))] mb-4">{plan.description}</p>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-[hsl(var(--marketing-text))]">
                      ${isFree ? 0 : getPrice(plan)}
                    </span>
                    <span className="text-[hsl(var(--marketing-text-light))]">
                      /{billingCycle === "monthly" ? "month" : "year"}
                    </span>
                  </div>
                  {!isFree && billingCycle === "yearly" && getSavings(plan) > 0 && (
                    <div className="text-sm text-[hsl(var(--marketing-accent))]">
                      Save ${getSavings(plan)}/year
                    </div>
                  )}
                  {isFree && (
                    <div className="text-sm text-emerald-600 font-medium">
                      {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits/month
                    </div>
                  )}
                </div>

                <Link to="/signup">
                  <Button
                    className={`w-full mb-6 ${isFree ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                    variant={plan.popular ? "default" : isFree ? "default" : "outline"}
                  >
                    {isFree ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Start Free
                      </>
                    ) : plan.name === "ENTERPRISE" ? (
                      "Contact Sales"
                    ) : (
                      "Start 14-Day Trial"
                    )}
                  </Button>
                </Link>

                <div className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isFree ? "text-emerald-500" : "text-[hsl(var(--marketing-primary))]"}`} />
                      <span className="text-[hsl(var(--marketing-text))]">{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.popular && (
                  <div className="mt-6 pt-4 border-t border-[hsl(var(--marketing-border))]">
                    <p className="text-sm text-center text-[hsl(var(--marketing-text-light))]">
                      14-day free trial included
                    </p>
                  </div>
                )}
                
                {isFree && (
                  <div className="mt-6 pt-4 border-t border-emerald-500/20">
                    <p className="text-xs text-center text-emerald-600">
                      No credit card required
                    </p>
                  </div>
                )}
              </div>
            );
          })}
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

      {/* Credit System Explainer */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
              <Coins className="h-3 w-3 mr-1" />
              Free Tier Credits
            </Badge>
            <h2 className="text-3xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Start Free, Upgrade When You're Ready
            </h2>
            <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
              Every new account gets {FREE_TIER_MONTHLY_CREDITS} credits to explore. 
              Here's what you can do with them:
            </p>
          </div>

          {/* What Credits Get You */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 text-center border-emerald-500/20 bg-emerald-500/5">
              <div className="text-4xl font-bold text-emerald-600 mb-2">~5</div>
              <div className="text-sm text-[hsl(var(--marketing-text))]">Orders Received</div>
              <div className="text-xs text-[hsl(var(--marketing-text-light))] mt-1">@ 75 credits each</div>
            </Card>
            <Card className="p-6 text-center border-emerald-500/20 bg-emerald-500/5">
              <div className="text-4xl font-bold text-emerald-600 mb-2">~3</div>
              <div className="text-sm text-[hsl(var(--marketing-text))]">Menus Created</div>
              <div className="text-xs text-[hsl(var(--marketing-text-light))] mt-1">@ 100 credits each</div>
            </Card>
            <Card className="p-6 text-center border-emerald-500/20 bg-emerald-500/5">
              <div className="text-4xl font-bold text-emerald-600 mb-2">~10</div>
              <div className="text-sm text-[hsl(var(--marketing-text))]">SMS Notifications</div>
              <div className="text-xs text-[hsl(var(--marketing-text-light))] mt-1">@ 25 credits each</div>
            </Card>
          </div>

          {/* Value Comparison */}
          <Card className="p-8 border-amber-500/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-2 mb-3 justify-center md:justify-start">
                  <Calculator className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold text-[hsl(var(--marketing-text))]">The Math is Simple</span>
                </div>
                <p className="text-[hsl(var(--marketing-text-light))] mb-4">
                  Active businesses typically burn through {FREE_TIER_MONTHLY_CREDITS} credits in <strong>about 1 day</strong>.
                  A credit pack costs ~$20 for 500 credits. That's $600+/month for heavy usage.
                </p>
                <p className="text-lg font-semibold text-amber-700">
                  Starter plan: $79/month = <span className="text-emerald-600">Unlimited usage</span>
                </p>
              </div>
              <div className="flex-shrink-0">
                <Link to="/signup">
                  <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    See All Plans
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          {/* Credit Packs (For those who want to stay on free) */}
          <div className="mt-12">
            <h3 className="text-xl font-semibold text-center mb-6 text-[hsl(var(--marketing-text))]">
              Need More Credits? Purchase Credit Packs
            </h3>
            <div className="grid md:grid-cols-4 gap-4">
              {CREDIT_PACKAGES.map((pkg) => (
                <Card key={pkg.id} className="p-4 text-center relative">
                  {pkg.badge && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs">
                      {pkg.badge}
                    </Badge>
                  )}
                  <div className="text-2xl font-bold text-[hsl(var(--marketing-text))] mt-2">
                    {pkg.credits.toLocaleString()}
                  </div>
                  <div className="text-sm text-[hsl(var(--marketing-text-light))] mb-2">credits</div>
                  <div className="text-lg font-semibold text-[hsl(var(--marketing-primary))]">
                    ${(pkg.priceCents / 100).toFixed(2)}
                  </div>
                  <div className="text-xs text-[hsl(var(--marketing-text-light))]">
                    ${((pkg.priceCents / 100) / pkg.credits * 100).toFixed(1)}¢/credit
                  </div>
                </Card>
              ))}
            </div>
            <p className="text-center text-sm text-[hsl(var(--marketing-text-light))] mt-4">
              💡 <strong>Pro tip:</strong> If you're buying credits regularly, a subscription saves you money.
            </p>
          </div>
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
              "Free tier available",
              "No credit card for free",
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
        description={`Start free with ${FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits/month, or try any paid plan with a 14-day trial. No credit card required.`}
        primaryCta={{
          text: "Start Free Today →",
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
