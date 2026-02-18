import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CTASection } from "@/components/marketing/CTASection";
import { ModernHero } from "@/components/marketing/ModernHero";
import { DetailedFeatureSection } from "@/components/marketing/DetailedFeatureSection";
import { ScrollProgressIndicator } from "@/components/marketing/ScrollProgressIndicator";
import { SectionTransition } from "@/components/marketing/SectionTransition";
import { ConfettiButton } from "@/components/marketing/ConfettiButton";
import { SectionSkeleton } from "@/components/marketing/SkeletonLoader";
import { KeyboardNavigationHelper } from "@/components/marketing/KeyboardNavigationHelper";
import { LiveChatWidget } from "@/components/LiveChatWidget";
import { MarketingErrorBoundary } from "@/components/marketing/MarketingErrorBoundary";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

import { StatsSection } from "@/components/marketing/StatsSection";

import { lazy, Suspense, useEffect } from "react";
import { analytics } from "@/utils/analytics";

// Lazy load heavy components
const ProblemSolutionSection = lazy(() => import("@/components/marketing/ProblemSolutionSection").then(m => ({ default: m.ProblemSolutionSection })));
const IntegrationEcosystem = lazy(() => import("@/components/marketing/IntegrationEcosystem").then(m => ({ default: m.IntegrationEcosystem })));
const ROICalculator = lazy(() => import("@/components/marketing/ROICalculator").then(m => ({ default: m.ROICalculator })));
const FloatingChatButton = lazy(() => import("@/components/marketing/FloatingChatButton").then(m => ({ default: m.FloatingChatButton })));


// Loading fallback component
const SectionLoader = () => (
  <SectionSkeleton />
);

export default function MarketingHome() {
  // Scroll to top on mount and track page view
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo({ top: 0, behavior: 'auto' });

    // Track page view
    analytics.track('marketing_page_view', {
      page: 'home',
      referrer: document.referrer,
    });
  }, []);

  return (
    <ForceLightMode>
      <div id="main-content" className="min-h-dvh bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))] font-sans">

        <SEOHead
          title="FloraIQ - Cannabis Wholesale Operations Platform"
          description="Create encrypted, disposable menus in 30 seconds. Auto-burn on screenshot, device fingerprinting, OPSEC-grade security. No demo required."
          image="/og-image.png"
          structuredData={{
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "FloraIQ",
            "applicationCategory": "BusinessApplication",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            }
          }}
        />

        <ScrollProgressIndicator />
        <MarketingNav />

        {/* SECTION 1: MODERN HERO - WHITE BG */}
        <ModernHero />

        {/* SECTION 2: PROBLEM/SOLUTION - GRAY BG */}
        <MarketingErrorBoundary section="ProblemSolution">
          <SectionTransition variant="fade" delay={0}>
            <section className="bg-gray-50 py-24 border-y border-gray-100">
              <Suspense fallback={<SectionLoader />}>
                <ProblemSolutionSection />
              </Suspense>
            </section>
          </SectionTransition>
        </MarketingErrorBoundary>

        {/* SECTION 3: DETAILED FEATURES - WHITE BG */}
        <section className="bg-white py-24">
          <DetailedFeatureSection />
        </section>

        {/* STATS SECTION - GRAY BG */}
        <section className="bg-gray-50 py-24 border-y border-gray-100">
          <StatsSection />
        </section>



        {/* SECTION 7: INTEGRATION - GRAY BG */}
        <MarketingErrorBoundary section="IntegrationEcosystem">
          <SectionTransition variant="fade" delay={0}>
            <section className="bg-gray-50 py-24 border-y border-gray-100">
              <Suspense fallback={<SectionLoader />}>
                <IntegrationEcosystem />
              </Suspense>
            </section>
          </SectionTransition>
        </MarketingErrorBoundary>


        {/* SECTION 9: PRICING PREVIEW - GRAY BG */}
        <section className="py-24 bg-gray-50 border-t border-gray-100">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-slate-600">
                Start free, upgrade as you grow
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {/* FREE TIER - With Premium Glow Animation */}
              <div className="p-6 rounded-xl border-2 border-emerald-500 bg-white relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md">

                <div className="absolute top-0 right-0 px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-bl-xl shadow-sm tracking-wider uppercase">
                  NO CC REQUIRED
                </div>

                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-2 text-center text-emerald-700 tracking-wide">FREE FOREVER</h3>
                  <div className="text-center mb-4">
                    <span className="text-5xl font-bold text-emerald-600">$0</span>
                    <span className="text-lg text-slate-500">/mo</span>
                  </div>
                  <p className="text-sm text-center text-slate-500 mb-6">Perfect for getting started</p>
                  <div className="text-center mb-6 py-2 px-4 bg-emerald-50 rounded-full inline-flex items-center gap-2 mx-auto w-full justify-center border border-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">500 FREE credits/month</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {["All core features", "50 customers", "3 menus", "1 location", "No credit card ever"].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup?plan=free">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5">
                      Start Free Now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>

              {[
                {
                  id: "starter",
                  name: "STARTER",
                  price: "$79",
                  period: "/mo",
                  description: "Unlimited for small teams",
                  features: ["Unlimited usage", "Unlimited menus", "2 locations", "3 team members", "Email support"],
                  cta: "Start 14-Day Trial"
                },
                {
                  id: "professional",
                  name: "PROFESSIONAL",
                  price: "$150",
                  period: "/mo",
                  popular: true,
                  description: "Most popular choice",
                  features: ["55 Total Features", "500 customers", "5 locations", "Advanced CRM", "Priority support"],
                  cta: "Start 14-Day Trial"
                },
                {
                  id: "enterprise",
                  name: "ENTERPRISE",
                  price: "$499",
                  period: "/mo",
                  description: "For large-scale operations",
                  features: ["All 87 Features", "Unlimited everything", "Fleet management", "API & webhooks", "White-label"],
                  cta: "Contact Sales"
                },
              ].map((plan, index) => (
                <div
                  key={index}
                  className={`p-6 rounded-xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-md relative overflow-hidden bg-white ${plan.popular
                    ? "border-emerald-500 shadow-sm ring-4 ring-emerald-500/5 md:scale-105"
                    : "border-gray-200"
                    }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
                  )}

                  {plan.popular && (
                    <div className="text-center mb-6">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wider uppercase border border-emerald-200">
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                  <h3 className="text-lg font-bold mb-2 text-center text-slate-900 tracking-wide uppercase">{plan.name}</h3>
                  <div className="text-center mb-4">
                    <span className="text-5xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-lg text-slate-500">{plan.period}</span>
                  </div>
                  <p className="text-sm text-center text-slate-500 mb-6">{plan.description}</p>
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${plan.popular ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                          <CheckCircle className={`h-3 w-3 ${plan.popular ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to={plan.id === "enterprise" ? "/contact?reason=enterprise" : `/signup?plan=${plan.id}`}>
                    <ConfettiButton
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                      className={`w-full rounded-xl h-12 font-semibold transition-all duration-200 ${plan.popular
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg"
                        : "border-gray-200 text-slate-700 hover:bg-gray-50 hover:border-emerald-200 hover:text-emerald-700"
                        }`}
                      confettiConfig={{
                        particleCount: plan.popular ? 150 : 100,
                        colors: ['#10B981', '#34D399', '#059669'],
                      }}
                    >
                      {plan.cta}
                    </ConfettiButton>
                  </Link>
                  {plan.name !== "ENTERPRISE" && (
                    <div className="text-[10px] text-center mt-3 text-slate-400 flex justify-center gap-1">
                      <AlertTriangle className="w-3 h-3 inline-block" aria-hidden="true" /> Credit card required for trial
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <div className="mt-12 p-6 bg-blue-50 border border-blue-100 rounded-xl max-w-lg mx-auto text-left">
                <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2 text-lg">
                  <HelpCircle className="w-5 h-5" />
                  When is a credit card required?
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-blue-800">
                      <strong className="block text-blue-900">FREE tier</strong>
                      No credit card ever. Just sign up and start.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-blue-800">
                      <strong className="block text-blue-900">Paid plan trials</strong>
                      Credit card required at signup to verify identity. <br />You won't be charged during the 14-day trial.
                    </span>
                  </div>
                </div>
              </div>
              <Link to="/pricing">
                <Button variant="ghost" className="mt-8 group text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                  See Full Pricing Details
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            {/* ROI Calculator */}
            <MarketingErrorBoundary section="ROICalculator">
              <div className="max-w-2xl mx-auto mt-16">
                <Suspense fallback={<SectionLoader />}>
                  <ROICalculator />
                </Suspense>
              </div>
            </MarketingErrorBoundary>
          </div>
        </section>

        {/* SECTION 10: FINAL CTA */}
        <section className="py-24 bg-white">
          <CTASection
            title="Ready to Create Your First Secure Menu?"
            description="Live in 60 seconds. No demo. No contract."
            primaryCta={{
              text: "Create Menu Free",
              link: "/signup?plan=free&flow=menu",
            }}
            secondaryCta={{
              text: "Watch Demo",
              link: "/demo",
            }}
            variant="default"
          />
        </section>

        {/* SECTION 11: FOOTER */}
        <MarketingFooter />

        {/* Floating Chat Button */}
        <MarketingErrorBoundary section="FloatingChat">
          <Suspense fallback={null}>
            <FloatingChatButton />
          </Suspense>
        </MarketingErrorBoundary>

        {/* Keyboard Navigation Helper */}
        <KeyboardNavigationHelper />

        {/* Live Chat Widget */}
        <LiveChatWidget />

      </div>
    </ForceLightMode>
  );
}
