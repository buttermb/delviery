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
import { SectionTransition } from "@/components/marketing/SectionTransition";
import { SectionSkeleton } from "@/components/marketing/SkeletonLoader";
import { MarketingErrorBoundary } from "@/components/marketing/MarketingErrorBoundary";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

import { StickyMobileCTA } from "@/components/marketing/StickyMobileCTA";
import { lazy, Suspense, useEffect } from "react";
import { analytics } from "@/utils/analytics";
// Lazy load heavy components
const ComparisonSection = lazy(() => import("@/components/marketing/ComparisonSection").then(m => ({ default: m.ComparisonSection })));
const IntegrationEcosystem = lazy(() => import("@/components/marketing/IntegrationEcosystem").then(m => ({ default: m.IntegrationEcosystem })));
const ROICalculator = lazy(() => import("@/components/marketing/ROICalculator").then(m => ({ default: m.ROICalculator })));
const VideoShowcase = lazy(() => import("@/components/marketing/VideoShowcaseRemotion").then(m => ({ default: m.VideoShowcaseRemotion })));
const TestimonialsCarousel = lazy(() => import("@/components/marketing/RemotionTestimonials").then(m => ({ default: m.RemotionTestimonials })));
const AnimatedHowItWorks = lazy(() => import("@/components/marketing/RemotionHowItWorks").then(m => ({ default: m.RemotionHowItWorks })));

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
          title="FloraIQ - Wholesale Menus That Disappear After Your Buyers Order"
          description="Create encrypted, disposable catalogs. Accept orders. Sync inventory. All from one dashboard — free to start."
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

        <MarketingNav />

        {/* SECTION 1: MODERN HERO */}
        <ModernHero />

        {/* SECTION 2: WORKFLOW BLOCKS */}
        <DetailedFeatureSection />

        {/* SECTION 3: HOW IT WORKS */}
        <MarketingErrorBoundary section="HowItWorks">
          <Suspense fallback={<SectionLoader />}>
            <AnimatedHowItWorks />
          </Suspense>
        </MarketingErrorBoundary>

        {/* SECTION 4: TESTIMONIALS */}
        <MarketingErrorBoundary section="Testimonials">
          <Suspense fallback={<SectionLoader />}>
            <TestimonialsCarousel />
          </Suspense>
        </MarketingErrorBoundary>

        {/* SECTION 5: VIDEO SHOWCASE */}
        <MarketingErrorBoundary section="VideoShowcase">
          <Suspense fallback={<SectionLoader />}>
            <VideoShowcase />
          </Suspense>
        </MarketingErrorBoundary>

        {/* SECTION 6: INTEGRATION */}
        <MarketingErrorBoundary section="IntegrationEcosystem">
          <SectionTransition variant="fade" delay={0}>
            <section>
              <Suspense fallback={<SectionLoader />}>
                <IntegrationEcosystem />
              </Suspense>
            </section>
          </SectionTransition>
        </MarketingErrorBoundary>

        {/* SECTION 7: COMPARISON */}
        <MarketingErrorBoundary section="Comparison">
          <SectionTransition variant="fade" delay={0}>
            <section>
              <Suspense fallback={<SectionLoader />}>
                <ComparisonSection />
              </Suspense>
            </section>
          </SectionTransition>
        </MarketingErrorBoundary>

        {/* SECTION 8: PRICING */}
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

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* FREE TIER */}
              <div className="p-6 rounded-3xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 relative overflow-hidden">
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
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl shadow-sm">
                      Start Free Now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* PRO TIER */}
              <div className="p-6 md:p-8 rounded-3xl border border-[hsl(var(--marketing-primary))] bg-gradient-to-b from-[hsl(var(--marketing-primary))]/10 to-[hsl(var(--marketing-bg-subtle))] shadow-lg relative overflow-hidden">
                <div className="text-center mb-6">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[hsl(var(--marketing-primary))] text-white text-xs font-bold shadow-lg">
                    MOST POPULAR
                  </span>
                </div>
                <h3 className="text-lg font-bold mb-1 text-center text-[hsl(var(--marketing-text-light))] tracking-wide">PRO</h3>
                <div className="text-center mb-2">
                  <span className="text-5xl font-bold text-[hsl(var(--marketing-text))]">$149</span>
                  <span className="text-lg text-[hsl(var(--marketing-text-light))]">/mo</span>
                </div>
                <p className="text-sm text-center text-[hsl(var(--marketing-text-light))] mb-6">For growing operations</p>
                <ul className="space-y-3 mb-8">
                  {["Unlimited menus & customers", "5 locations", "Advanced CRM", "Priority support", "Built-in payment processing"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-[hsl(var(--marketing-text))]">
                      <div className="w-5 h-5 rounded-full bg-[hsl(var(--marketing-primary))] flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/signup?plan=professional">
                  <Button
                    size="lg"
                    className="w-full rounded-xl min-h-[52px] font-semibold bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white shadow-lg shadow-[hsl(var(--marketing-primary))]/25"
                  >
                    Start 14-Day Trial
                  </Button>
                </Link>
                <div className="text-[10px] text-center mt-2 text-[hsl(var(--marketing-text-light))] flex justify-center gap-1">
                  <AlertTriangle className="w-3 h-3 inline-block mr-1" aria-hidden="true" /> Credit card required for trial
                </div>
              </div>

              {/* ENTERPRISE TIER */}
              <div className="p-6 md:p-8 rounded-3xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))] relative overflow-hidden">
                <h3 className="text-lg font-bold mb-1 text-center text-[hsl(var(--marketing-text-light))] tracking-wide">ENTERPRISE</h3>
                <div className="text-center mb-2">
                  <span className="text-4xl font-bold text-[hsl(var(--marketing-text))]">Contact Sales</span>
                </div>
                <p className="text-sm text-center text-[hsl(var(--marketing-text-light))] mb-6">For large-scale operations</p>
                <ul className="space-y-3 mb-8">
                  {["Unlimited everything", "Fleet management", "API & webhooks", "White-label options", "Dedicated account manager"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-[hsl(var(--marketing-text))]">
                      <div className="w-5 h-5 rounded-full bg-[hsl(var(--marketing-primary))]/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-3 w-3 text-[hsl(var(--marketing-primary))]" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/contact?reason=enterprise">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full rounded-xl min-h-[52px] font-semibold border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-bg))] hover:border-[hsl(var(--marketing-primary))]/50"
                  >
                    Contact Sales
                  </Button>
                </Link>
              </div>
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
                <Button variant="ghost" className="group text-[hsl(var(--marketing-text))] hover:text-[hsl(var(--marketing-primary))]">
                  See Full Pricing Details
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 9: ROI CALCULATOR */}
        <section className="py-12 md:py-16 bg-[hsl(var(--marketing-bg))]">
          <div className="container mx-auto px-4">
            <MarketingErrorBoundary section="ROICalculator">
              <div className="max-w-2xl mx-auto">
                <Suspense fallback={<SectionLoader />}>
                  <ROICalculator />
                </Suspense>
              </div>
            </MarketingErrorBoundary>
          </div>
        </section>

        {/* SECTION 10: FINAL CTA */}
        <CTASection
          title="Ready to simplify your wholesale operation?"
          description="Free to start. No credit card. No sales call."
          primaryCta={{
            text: "Create Your First Menu",
            link: "/signup?plan=free&flow=menu",
          }}
          variant="dark"
        />

        {/* SECTION 11: FOOTER */}
        <MarketingFooter />

        {/* Sticky Mobile CTA */}
        <StickyMobileCTA />

      </div>
    </ForceLightMode>
  );
}
