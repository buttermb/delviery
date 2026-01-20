import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle,
  HelpCircle,
  AlertCircle,
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
import { TestimonialsCarousel } from "@/components/marketing/TestimonialsCarousel";
import { VideoShowcase } from "@/components/marketing/VideoShowcase";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

import { StatsSection } from "@/components/marketing/StatsSection";
import { StickyMobileCTA } from "@/components/marketing/StickyMobileCTA";
import { TrustedBy } from "@/components/marketing/TrustedBy";
import { lazy, Suspense, useEffect } from "react";
import { analytics } from "@/utils/analytics";

// Lazy load heavy components
const ProblemSolutionSection = lazy(() => import("@/components/marketing/ProblemSolutionSection").then(m => ({ default: m.ProblemSolutionSection })));
const ComparisonSection = lazy(() => import("@/components/marketing/ComparisonSection").then(m => ({ default: m.ComparisonSection })));
const IntegrationEcosystem = lazy(() => import("@/components/marketing/IntegrationEcosystem").then(m => ({ default: m.IntegrationEcosystem })));
const ROICalculator = lazy(() => import("@/components/marketing/ROICalculator").then(m => ({ default: m.ROICalculator })));
const FloatingChatButton = lazy(() => import("@/components/marketing/FloatingChatButton").then(m => ({ default: m.FloatingChatButton })));
const PlatformCapabilities = lazy(() => import("@/components/marketing/PlatformCapabilities").then(m => ({ default: m.PlatformCapabilities })));
const EnhancedDashboardPreview = lazy(() => import("@/components/marketing/EnhancedDashboardPreview").then(m => ({ default: m.EnhancedDashboardPreview })));


// Loading fallback component
const SectionLoader = () => (
  <SectionSkeleton />
);

export default function MarketingHome() {
  const navigate = useNavigate();

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
      <div className="min-h-dvh bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))] font-sans overflow-x-hidden">

        <SEOHead
          title="FloraIQ - Secure Disposable Menus for Cannabis Operators"
          description="Create encrypted, disposable menus in 30 seconds. Auto-burn on screenshot, device fingerprinting, OPSEC-grade security. No demo required."
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

        {/* SECTION 1: MODERN HERO */}
        <ModernHero />

        {/* TRUSTED BY SECTION */}
        <TrustedBy />

        {/* SECTION 2: PROBLEM/SOLUTION */}
        <MarketingErrorBoundary section="ProblemSolution">
          <SectionTransition variant="fade" delay={0}>
            <section>
              <Suspense fallback={<SectionLoader />}>
                <ProblemSolutionSection />
              </Suspense>
            </section>
          </SectionTransition>
        </MarketingErrorBoundary>

        {/* SECTION 3: DETAILED FEATURES */}
        <DetailedFeatureSection />

        {/* STATS SECTION */}
        <StatsSection />




        {/* SECTION 5: TESTIMONIALS CAROUSEL */}
        <MarketingErrorBoundary section="Testimonials">
          <TestimonialsCarousel />
        </MarketingErrorBoundary>

        {/* SECTION 5.5: VIDEO SHOWCASE */}
        <MarketingErrorBoundary section="VideoShowcase">
          <VideoShowcase />
        </MarketingErrorBoundary>

        {/* SECTION 6: PRODUCT SHOWCASE - INTERACTIVE DASHBOARD */}
        <section className="py-12 md:py-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--marketing-bg))] to-[hsl(var(--marketing-bg-subtle))]/50 pointer-events-none" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
                  See FloraIQ in Action
                </h2>
                <p className="text-xl text-[hsl(var(--marketing-text-light))] mb-8">
                  Explore our interactive dashboard - click around and see all the features
                </p>
              </div>

              {/* Full Interactive Dashboard */}
              <MarketingErrorBoundary section="DashboardPreview">
                <Suspense fallback={<SectionLoader />}>
                  <EnhancedDashboardPreview />
                </Suspense>
              </MarketingErrorBoundary>

              {/* Feature Highlights */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto">
                {[
                  "Create secure catalog in 2 clicks",
                  "Track deliveries in real-time",
                  "Manage orders from one dashboard",
                  "Customer portal for self-service"
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))]">
                    <CheckCircle className="h-5 w-5 text-[hsl(var(--marketing-primary))] flex-shrink-0 mt-1" />
                    <span className="text-sm text-[hsl(var(--marketing-text))]">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="text-center mt-8">
                <Link to="/demo">
                  <Button size="lg" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white h-12 px-8 rounded-xl">
                    Request Live Demo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: INTEGRATION */}
        <MarketingErrorBoundary section="IntegrationEcosystem">
          <SectionTransition variant="fade" delay={0}>
            <section>
              <Suspense fallback={<SectionLoader />}>
                <IntegrationEcosystem />
              </Suspense>
            </section>
          </SectionTransition>
        </MarketingErrorBoundary>

        {/* SECTION 8: COMPARISON */}
        <MarketingErrorBoundary section="Comparison">
          <SectionTransition variant="fade" delay={0}>
            <section>
              <Suspense fallback={<SectionLoader />}>
                <ComparisonSection />
              </Suspense>
            </section>
          </SectionTransition>
        </MarketingErrorBoundary>


        {/* SECTION 9: PRICING PREVIEW */}
        <section className="py-12 md:py-16 bg-[hsl(var(--marketing-bg))]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
                Simple, Transparent Pricing
              </h2>
              <p className="text-xl text-[hsl(var(--marketing-text-light))]">
                Start free, upgrade as you grow
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
              {/* FREE TIER - With Premium Glow Animation */}
              <div className="p-6 rounded-3xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 relative overflow-hidden transition-all hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.2)]">

                <div className="absolute top-0 right-0 px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-bl-2xl shadow-sm">
                  NO CC REQUIRED
                </div>

                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-1 text-center text-emerald-700 dark:text-emerald-400 tracking-wide">FREE FOREVER</h3>
                  <div className="text-center mb-2">
                    <span className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">$0</span>
                    <span className="text-lg text-[hsl(var(--marketing-text-light))]">/mo</span>
                  </div>
                  <p className="text-sm text-center text-[hsl(var(--marketing-text-light))] mb-4">Perfect for getting started</p>
                  <div className="text-center mb-6 py-2 px-4 bg-emerald-100 dark:bg-emerald-900/40 rounded-full inline-flex items-center gap-2 mx-auto w-full justify-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">500 FREE credits/month</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {["All core features", "50 customers", "3 menus", "1 location", "No credit card ever"].map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-[hsl(var(--marketing-text))]">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup?plan=free">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl shadow-sm transition-all hover:scale-[1.02]">
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
                  className={`p-6 md:p-8 rounded-3xl border transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 relative overflow-hidden ${plan.popular
                    ? "border-[hsl(var(--marketing-primary))] bg-gradient-to-b from-[hsl(var(--marketing-primary))]/10 to-[hsl(var(--marketing-bg-subtle))] shadow-[0_0_40px_rgba(16,185,129,0.15)] md:scale-105"
                    : "border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))]"
                    }`}
                >
                  {plan.popular && (
                    <>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(var(--marketing-primary))]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                      <div className="text-center mb-6">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[hsl(var(--marketing-primary))] text-white text-xs font-bold shadow-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          MOST POPULAR
                        </span>
                      </div>
                    </>
                  )}
                  <h3 className="text-lg font-bold mb-1 text-center text-[hsl(var(--marketing-text-light))] tracking-wide">{plan.name}</h3>
                  <div className="text-center mb-2">
                    <span className="text-5xl font-bold text-[hsl(var(--marketing-text))]">{plan.price}</span>
                    <span className="text-lg text-[hsl(var(--marketing-text-light))]">{plan.period}</span>
                  </div>
                  <p className="text-sm text-center text-[hsl(var(--marketing-text-light))] mb-6">{plan.description}</p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-[hsl(var(--marketing-text))]">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${plan.popular ? 'bg-[hsl(var(--marketing-primary))]' : 'bg-[hsl(var(--marketing-primary))]/20'}`}>
                          <CheckCircle className={`h-3 w-3 ${plan.popular ? 'text-white' : 'text-[hsl(var(--marketing-primary))]'}`} />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to={plan.id === "enterprise" ? "/contact?reason=enterprise" : `/signup?plan=${plan.id}`}>
                    <ConfettiButton
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                      className={`w-full rounded-xl min-h-[52px] font-semibold touch-manipulation active:scale-[0.98] transition-transform ${plan.popular
                        ? "bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white shadow-lg shadow-[hsl(var(--marketing-primary))]/25"
                        : "border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-bg))] hover:border-[hsl(var(--marketing-primary))]/50"
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
                    <div className="text-[10px] text-center mt-2 text-[hsl(var(--marketing-text-light))] flex justify-center gap-1">
                      ⚠️ Credit card required for trial
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl max-w-lg mx-auto text-left">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2 text-lg">
                  <HelpCircle className="w-5 h-5" />
                  When is a credit card required?
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-blue-800 dark:text-blue-200">
                      <strong className="block text-blue-900 dark:text-blue-100">FREE tier</strong>
                      No credit card ever. Just sign up and start.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-blue-800 dark:text-blue-200">
                      <strong className="block text-blue-900 dark:text-blue-100">Paid plan trials</strong>
                      Credit card required at signup to verify identity. <br />You won't be charged during the 14-day trial.
                    </span>
                  </div>
                </div>
              </div>
              <Link to="/pricing">
                <Button variant="ghost" className="group text-[hsl(var(--marketing-text))] hover:text-[hsl(var(--marketing-primary))] hover:scale-105 active:scale-95 transition-transform">
                  See Full Pricing Details
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            {/* ROI Calculator */}
            <MarketingErrorBoundary section="ROICalculator">
              <div className="max-w-2xl mx-auto mt-12">
                <Suspense fallback={<SectionLoader />}>
                  <ROICalculator />
                </Suspense>
              </div>
            </MarketingErrorBoundary>
          </div>
        </section>

        {/* SECTION 10: FINAL CTA */}
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

        {/* Sticky Mobile CTA */}
        <StickyMobileCTA />

      </div>
    </ForceLightMode>
  );
}
