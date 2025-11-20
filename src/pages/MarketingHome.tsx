import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CTASection } from "@/components/marketing/CTASection";
import { ModernHero } from "@/components/marketing/ModernHero";
import { BentoFeatureGrid } from "@/components/marketing/BentoFeatureGrid";
import { LiveActivityTicker } from "@/components/marketing/LiveActivityTicker";
import { ScrollProgressIndicator } from "@/components/marketing/ScrollProgressIndicator";
import { SectionTransition } from "@/components/marketing/SectionTransition";
import { ParallaxBackground } from "@/components/marketing/ParallaxBackground";
import { ConfettiButton } from "@/components/marketing/ConfettiButton";
import { SectionSkeleton } from "@/components/marketing/SkeletonLoader";
import { KeyboardNavigationHelper } from "@/components/marketing/KeyboardNavigationHelper";
import { LiveChatWidget } from "@/components/LiveChatWidget";
import { PerformanceMonitor } from "@/components/marketing/PerformanceMonitor";

import { StatsSection } from "@/components/marketing/StatsSection";
import { StickyMobileCTA } from "@/components/marketing/StickyMobileCTA";
import { lazy, Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import { analytics } from "@/utils/analytics";

// Lazy load heavy components
const ProblemSolutionSection = lazy(() => import("@/components/marketing/ProblemSolutionSection").then(m => ({ default: m.ProblemSolutionSection })));
const CustomerSuccessTimeline = lazy(() => import("@/components/marketing/CustomerSuccessTimeline").then(m => ({ default: m.CustomerSuccessTimeline })));
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
  // Track page view on mount
  useEffect(() => {
    analytics.track('marketing_page_view', {
      page: 'home',
      referrer: document.referrer,
    });
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))] relative font-sans">
      {/* Performance Monitor - Dev mode only */}
      <PerformanceMonitor />

      {/* Parallax Background Effects */}
      <ParallaxBackground />

      <SEOHead
        title="FloraIQ - Modern Operating System for Cannabis Distribution"
        description="Secure disposable menus, real-time inventory, and automated logistics. The all-in-one platform for modern wholesale."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "FloraIQ",
          "applicationCategory": "BusinessApplication",
          "offers": {
            "@type": "Offer",
            "price": "99",
            "priceCurrency": "USD"
          }
        }}
      />

      <ScrollProgressIndicator />
      <MarketingNav />

      {/* SECTION 1: MODERN HERO */}
      <ModernHero />

      {/* LIVE ACTIVITY TICKER */}
      <LiveActivityTicker />

      {/* SECTION 2: PROBLEM/SOLUTION */}
      <SectionTransition variant="fade" delay={0}>
        <section style={{ contentVisibility: 'auto' }}>
          <Suspense fallback={<SectionLoader />}>
            <ProblemSolutionSection />
          </Suspense>
        </section>
      </SectionTransition>

      {/* SECTION 3: BENTO FEATURES */}
      <BentoFeatureGrid />

      {/* STATS SECTION */}
      <StatsSection />

      {/* SECTION 4: PLATFORM CAPABILITIES */}
      <SectionTransition variant="fade">
        <section style={{ contentVisibility: 'auto' }}>
          <Suspense fallback={<SectionLoader />}>
            <PlatformCapabilities />
          </Suspense>
        </section>
      </SectionTransition>


      {/* SECTION 5: CUSTOMER SUCCESS */}
      <section className="py-12 md:py-16 bg-[hsl(var(--marketing-bg-subtle))]/30 relative" style={{ contentVisibility: 'auto' }}>
        <div className="container mx-auto px-4">
          <Suspense fallback={<SectionLoader />}>
            <CustomerSuccessTimeline />
          </Suspense>
        </div>
      </section>

      {/* SECTION 6: PRODUCT SHOWCASE - INTERACTIVE DASHBOARD */}
      <section className="py-12 md:py-16 relative" style={{ contentVisibility: 'auto' }}>
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
            <Suspense fallback={<SectionLoader />}>
              <EnhancedDashboardPreview />
            </Suspense>

            {/* Feature Highlights */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto">
              {[
                "Create disposable menu in 2 clicks",
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
      <SectionTransition variant="fade" delay={0}>
        <section style={{ contentVisibility: 'auto' }}>
          <Suspense fallback={<SectionLoader />}>
            <IntegrationEcosystem />
          </Suspense>
        </section>
      </SectionTransition>

      {/* SECTION 8: COMPARISON */}
      <SectionTransition variant="fade" delay={0}>
        <section style={{ contentVisibility: 'auto' }}>
          <Suspense fallback={<SectionLoader />}>
            <ComparisonSection />
          </Suspense>
        </section>
      </SectionTransition>

      {/* SECTION 9: PRICING PREVIEW */}
      <section className="py-12 md:py-16 bg-[hsl(var(--marketing-bg))]" style={{ contentVisibility: 'auto' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              Start free, upgrade as you grow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "BASIC",
                price: "$79/mo",
                features: ["28 Core Features", "50 customers", "100 products", "2 locations", "3 team members"],
              },
              {
                name: "PROFESSIONAL",
                price: "$150/mo",
                popular: true,
                features: ["55 Total Features", "500 customers", "1,000 products", "5 locations", "Advanced CRM"],
              },
              {
                name: "ENTERPRISE",
                price: "$499/mo",
                features: ["All 87 Features", "Unlimited everything", "Fleet management", "API & webhooks", "White-label"],
              },
            ].map((plan, index) => (
              <div
                key={index}
                className={`p-6 rounded-2xl border transition-transform duration-300 hover:scale-105 ${plan.popular
                  ? "border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))/0.05] shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                  : "border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))]"
                  }`}
              >
                {plan.popular && (
                  <div className="text-center mb-4">
                    <span className="inline-block px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))] text-white text-xs font-bold">
                      ⭐ POPULAR
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2 text-center text-[hsl(var(--marketing-text))]">{plan.name}</h3>
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-[hsl(var(--marketing-text))]">{plan.price}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-[hsl(var(--marketing-text-light))]">
                      <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))] flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/signup">
                  <ConfettiButton
                    variant={plan.popular ? "default" : "outline"}
                    size="default"
                    className={`w-full rounded-xl ${plan.popular
                      ? "bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white"
                      : "border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-bg))]"
                      }`}
                    confettiConfig={{
                      particleCount: plan.popular ? 150 : 100,
                      colors: ['#10B981', '#34D399', '#059669'],
                    }}
                    onClick={() => window.location.href = '/signup'}
                  >
                    {plan.name === "ENTERPRISE" ? "Contact Us" : "Try Free"}
                  </ConfettiButton>
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <div className="flex flex-wrap justify-center gap-4 text-sm text-[hsl(var(--marketing-text-light))] mb-4">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                14-day free trial
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                Cancel anytime
              </span>
            </div>
            <Link to="/pricing">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button variant="ghost" className="group text-[hsl(var(--marketing-text))] hover:text-[hsl(var(--marketing-primary))]">
                  See Full Pricing Details
                  <motion.div
                    className="inline-block ml-2"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.div>
                </Button>
              </motion.div>
            </Link>
          </div>

          {/* ROI Calculator */}
          <div className="max-w-2xl mx-auto mt-12">
            <Suspense fallback={<SectionLoader />}>
              <ROICalculator />
            </Suspense>
          </div>
        </div>
      </section>

      {/* SECTION 10: FINAL CTA */}
      <CTASection
        title="Ready to Transform Your Cannabis Distribution?"
        description="Start your 14-day free trial today. No credit card required."
        primaryCta={{
          text: "Start Free Trial",
          link: "/signup",
        }}
        secondaryCta={{
          text: "Schedule a Demo",
          link: "/demo",
        }}
        variant="gradient"
      />

      {/* SECTION 11: FOOTER */}
      <MarketingFooter />

      {/* Floating Chat Button */}
      <Suspense fallback={null}>
        <FloatingChatButton />
      </Suspense>

      {/* Keyboard Navigation Helper */}
      <KeyboardNavigationHelper />

      {/* Live Chat Widget */}
      <LiveChatWidget />

      {/* Sticky Mobile CTA */}
      <StickyMobileCTA />
    </div>
  );
}
