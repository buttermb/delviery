import { lazy, Suspense, useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CTASection } from "@/components/marketing/CTASection";
import { ModernHero } from "@/components/marketing/ModernHero";
import { DetailedFeatureSection } from "@/components/marketing/DetailedFeatureSection";
import { SectionTransition } from "@/components/marketing/SectionTransition";
import { PricingSection } from "@/components/marketing/PricingSection";
import { SectionSkeleton } from "@/components/marketing/SkeletonLoader";
import { MarketingErrorBoundary } from "@/components/marketing/MarketingErrorBoundary";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";
import { analytics } from "@/utils/analytics";
import { MarketingTicker } from "@/components/marketing/MarketingTicker";

// Lazy load heavy components
const ProblemSolutionSection = lazy(() => import("@/components/marketing/ProblemSolutionSection").then(m => ({ default: m.ProblemSolutionSection })));


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

        <MarketingNav />

        {/* SECTION 1: MODERN HERO - WHITE BG */}
        <ModernHero />

        {/* SECTION 1.5: FLOWHUB STYLE RIBBON */}
        <MarketingErrorBoundary section="Ticker">
          <MarketingTicker />
        </MarketingErrorBoundary>

        {/* SECTION 2: PROBLEM/SOLUTION - GRAY BG */}
        <MarketingErrorBoundary section="ProblemSolution">
          <SectionTransition variant="fade" delay={0}>
            <section className="bg-white py-12 md:py-24">
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



        {/* SECTION 9: PRICING PREVIEW - GRAY BG */}
        <section className="py-24 bg-white">
          <PricingSection />
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


      </div>
    </ForceLightMode>
  );
}
