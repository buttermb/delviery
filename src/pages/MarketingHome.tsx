import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Layers, 
  Workflow, 
  Crown, 
  TrendingUp,
  ArrowRight,
  CheckCircle,
  ShieldCheck,
  Play,
  FileKey2,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { FlippableFeatureCard } from "@/components/marketing/FlippableFeatureCard";
import { StatCard } from "@/components/marketing/StatCard";
import { CTASection } from "@/components/marketing/CTASection";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ScrollProgressIndicator } from "@/components/marketing/ScrollProgressIndicator";
import { SectionTransition } from "@/components/marketing/SectionTransition";
import { ParallaxBackground } from "@/components/marketing/ParallaxBackground";
import { ConfettiButton } from "@/components/marketing/ConfettiButton";
import { ScrollReveal, StaggerContainer } from "@/components/marketing/ScrollReveal";
import { SectionSkeleton } from "@/components/marketing/SkeletonLoader";
import { KeyboardNavigationHelper } from "@/components/marketing/KeyboardNavigationHelper";
import { SocialProof } from "@/components/marketing/SocialProof";
import { LiveChatWidget } from "@/components/LiveChatWidget";
import { lazy, Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import { analytics } from "@/utils/analytics";

// Lazy load heavy components for better performance
const ProblemSolutionSection = lazy(() => import("@/components/marketing/ProblemSolutionSection").then(m => ({ default: m.ProblemSolutionSection })));
const CustomerSuccessTimeline = lazy(() => import("@/components/marketing/CustomerSuccessTimeline").then(m => ({ default: m.CustomerSuccessTimeline })));
const ComparisonSection = lazy(() => import("@/components/marketing/ComparisonSection").then(m => ({ default: m.ComparisonSection })));
const IntegrationEcosystem = lazy(() => import("@/components/marketing/IntegrationEcosystem").then(m => ({ default: m.IntegrationEcosystem })));
const ROICalculator = lazy(() => import("@/components/marketing/ROICalculator").then(m => ({ default: m.ROICalculator })));
const FloatingChatButton = lazy(() => import("@/components/marketing/FloatingChatButton").then(m => ({ default: m.FloatingChatButton })));
const AnimatedHowItWorks = lazy(() => import("@/components/marketing/AnimatedHowItWorks").then(m => ({ default: m.AnimatedHowItWorks })));
const PlatformCapabilities = lazy(() => import("@/components/marketing/PlatformCapabilities").then(m => ({ default: m.PlatformCapabilities })));
const FeatureExplorer = lazy(() => import("@/components/marketing/FeatureExplorer").then(m => ({ default: m.FeatureExplorer })));
const InteractiveDashboardShowcase = lazy(() => import("@/components/marketing/InteractiveDashboardShowcase").then(m => ({ default: m.InteractiveDashboardShowcase })));
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

  const features = [
    {
      icon: FileKey2,
      title: "DISPOSABLE MENUS",
      description: "Create encrypted product catalogs that burn after viewing or expire. Set expiration times for maximum security.",
      link: "/features",
    },
    {
      icon: ShieldCheck,
      title: "ENCRYPTED & SECURE",
      description: "Bank-level encryption for your sensitive business data. GDPR compliant with regular security audits.",
      link: "/features",
    },
    {
      icon: Layers,
      title: "INVENTORY TRACKING",
      description: "Real-time stock levels, barcode scanning, multi-location support. Low stock alerts and automated reordering.",
      link: "/features",
    },
    {
      icon: Workflow,
      title: "AUTOMATION",
      description: "Automate orders, alerts, reports, and workflows to save time. Focus on growing your business.",
      link: "/features",
    },
    {
      icon: Crown,
      title: "CUSTOMER PORTAL",
      description: "White-label portal for customers to browse & order 24/7 without calling you. Self-service ordering.",
      link: "/features",
    },
    {
      icon: TrendingUp,
      title: "ANALYTICS",
      description: "Real-time insights into sales, orders, inventory, and customer behavior. Beautiful, actionable dashboards.",
      link: "/features",
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Parallax Background Effects */}
      <ParallaxBackground />
      
      <SEOHead
        title="DevPanel - Modern CRM for Wholesale Distributors"
        description="Manage customers, products, orders, and inventory in one powerful platform. Disposable menus, real-time tracking, customer portal. Start free trial."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "DevPanel",
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

      {/* SECTION 1: HERO */}
      <HeroSection />

      {/* SECTION 2: PROBLEM/SOLUTION */}
      <SectionTransition variant="fade" delay={0}>
        <Suspense fallback={<SectionLoader />}>
          <ProblemSolutionSection />
        </Suspense>
      </SectionTransition>


      {/* SECTION 5: PLATFORM CAPABILITIES */}
      <SectionTransition variant="fade">
        <Suspense fallback={<SectionLoader />}>
          <PlatformCapabilities />
        </Suspense>
      </SectionTransition>

      {/* SECTION 5B: FEATURE EXPLORER */}
      <SectionTransition variant="fade">
        <Suspense fallback={<SectionLoader />}>
          <FeatureExplorer />
        </Suspense>
      </SectionTransition>

      {/* SECTION 5C: KEY FEATURES GRID */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal direction="up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                Everything You Need to Run Your Wholesale Business
              </h2>
            </div>
          </ScrollReveal>

          <StaggerContainer staggerDelay={0.15}>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {features.map((feature, index) => (
                <FlippableFeatureCard 
                  key={index} 
                  {...feature}
                  benefits={
                    feature.title === 'DISPOSABLE MENUS' ? ['256-bit encryption', 'Auto-expiration', 'One-time view', 'QR code sharing'] :
                    feature.title === 'ENCRYPTED & SECURE' ? ['Bank-level security', 'GDPR compliant', 'Regular audits', 'Data protection'] :
                    feature.title === 'INVENTORY TRACKING' ? ['Multi-location', 'Real-time sync', 'Low stock alerts', 'Barcode scanning'] :
                    feature.title === 'AUTOMATION' ? ['Save 15hrs/week', 'Auto-confirmations', 'Smart workflows', 'Email notifications'] :
                    feature.title === 'CUSTOMER PORTAL' ? ['24/7 availability', 'Mobile friendly', 'Self-service', 'Order history'] :
                    ['Real-time data', 'Custom reports', 'Sales insights', 'Export options']
                  }
                  metric={
                    feature.title === 'AUTOMATION' ? { label: 'Time Saved', value: '15hrs/wk' } :
                    feature.title === 'DISPOSABLE MENUS' ? { label: 'Security', value: '256-bit' } :
                    feature.title === 'ENCRYPTED & SECURE' ? { label: 'Compliance', value: '100%' } :
                    feature.title === 'INVENTORY TRACKING' ? { label: 'Accuracy', value: '99.9%' } :
                    feature.title === 'CUSTOMER PORTAL' ? { label: 'Uptime', value: '24/7' } :
                    { label: 'Data Quality', value: 'Real-time' }
                  }
                />
              ))}
            </div>
          </StaggerContainer>

          <ScrollReveal direction="up" delay={0.4}>
            <div className="text-center mt-16">
              <Link to="/features">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button variant="outline" size="lg" className="mx-auto group">
                    Discover More Features
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
          </ScrollReveal>
        </div>
      </section>

      {/* SECTION 6: CUSTOMER SUCCESS */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <Suspense fallback={<SectionLoader />}>
            <CustomerSuccessTimeline />
          </Suspense>
        </div>
      </section>

      {/* SECTION 7: HOW IT WORKS */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <Suspense fallback={<SectionLoader />}>
            <AnimatedHowItWorks />
          </Suspense>
        </div>
      </section>

      {/* SECTION 8: COMPARISON */}
      <SectionTransition variant="fade" delay={0}>
        <Suspense fallback={<SectionLoader />}>
          <ComparisonSection />
        </Suspense>
      </SectionTransition>

      {/* SECTION 9: INTEGRATION */}
      <SectionTransition variant="fade" delay={0}>
        <Suspense fallback={<SectionLoader />}>
          <IntegrationEcosystem />
        </Suspense>
      </SectionTransition>

      {/* SECTION 10: PRICING PREVIEW */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground">
              Start free, upgrade as you grow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "STARTER",
                price: "$99/mo",
                features: ["50 customers", "3 menus", "Basic feat."],
              },
              {
                name: "PROFESSIONAL",
                price: "$299/mo",
                popular: true,
                features: ["500 customers", "Unlimited", "All features", "API access"],
              },
              {
                name: "ENTERPRISE",
                price: "$799/mo",
                features: ["Unlimited", "Everything", "White-label", "Dedicated"],
              },
            ].map((plan, index) => (
              <div
                key={index}
                className={`p-6 rounded-2xl border ${
                  plan.popular
                    ? "border-primary bg-primary/5 shadow-xl scale-105"
                    : "border-border bg-card"
                }`}
              >
                {plan.popular && (
                  <div className="text-center mb-4">
                    <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      ⭐ POPULAR
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2 text-center text-foreground">{plan.name}</h3>
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/signup">
                  <ConfettiButton
                    variant={plan.popular ? "default" : "outline"}
                    size="default"
                    className={`w-full ${
                      plan.popular
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                        : ""
                    }`}
                    confettiConfig={{
                      particleCount: plan.popular ? 150 : 100,
                      colors: ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe'],
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
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" />
                14-day free trial
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" />
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" />
                Cancel anytime
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" />
                Money-back guarantee
              </span>
            </div>
            <Link to="/pricing">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button variant="ghost" className="group">
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

      {/* SECTION 6: PRODUCT SHOWCASE - INTERACTIVE DASHBOARD */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                See DevPanel in Action
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Explore our interactive dashboard - click around and see all the features
              </p>
            </div>

            {/* Full Interactive Dashboard */}
            <Suspense fallback={<SectionLoader />}>
              <EnhancedDashboardPreview />
            </Suspense>

            {/* Feature Highlights Below Dashboard */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-card/50 border border-border/50">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <span className="text-sm text-foreground">Create disposable menu in 2 clicks</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-card/50 border border-border/50">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <span className="text-sm text-foreground">Track deliveries in real-time</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-card/50 border border-border/50">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <span className="text-sm text-foreground">Manage orders from one dashboard</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-card/50 border border-border/50">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <span className="text-sm text-foreground">Customer portal for self-service</span>
              </div>
            </div>

            <div className="text-center mt-8">
              <Link to="/demo">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8">
                  Request Live Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: STATS & NUMBERS */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="stats-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="2" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#stats-grid)" />
          </svg>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-primary))] bg-clip-text text-transparent">
              DevPanel by the Numbers
            </h2>
            <p className="text-xl text-muted-foreground">
              Trusted by wholesale distributors worldwide
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <StatCard value="400+" label="Distributors" index={0} icon="Distributors" />
            <StatCard value="$1.4M" label="Orders/Month" index={1} icon="Orders/Month" />
            <StatCard value="15hrs" label="Saved/Week" index={2} icon="Saved/Week" />
            <StatCard value="99.9%" label="Uptime" index={3} icon="Uptime" />
            <StatCard value="4.8" label="Rating" index={4} icon="Rating" />
            <StatCard value="24/7" label="Support" index={5} icon="Support" />
          </div>
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <CTASection
        title="Ready to Transform Your Wholesale Business?"
        description="Start your 14-day free trial today. No credit card required."
        primaryCta={{
          text: "Start Free Trial →",
          link: "/signup",
        }}
        secondaryCta={{
          text: "Schedule a Demo",
          link: "/demo",
        }}
        variant="gradient"
      />

      {/* SECTION 9: FOOTER */}
      <MarketingFooter />

      {/* Floating Chat Button */}
      <Suspense fallback={null}>
        <FloatingChatButton />
      </Suspense>

      {/* Keyboard Navigation Helper */}
      <KeyboardNavigationHelper />
      
      {/* Social Proof Notifications */}
      <SocialProof />
      
      {/* Live Chat Widget */}
      <LiveChatWidget />
    </div>
  );
}
