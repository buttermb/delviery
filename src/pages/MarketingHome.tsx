import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Smartphone, 
  Shield, 
  Package, 
  Zap, 
  Users, 
  BarChart3,
  CheckCircle,
  ArrowRight,
  Star,
  Play,
  TrendingUp,
  Lock as LockIcon,
  DollarSign,
  Clock
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import { CTASection } from "@/components/marketing/CTASection";
import { AnimatedHowItWorks } from "@/components/marketing/AnimatedHowItWorks";
import { CountUpStat } from "@/components/marketing/CountUpStat";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { FloatingBadges } from "@/components/marketing/FloatingBadges";
import { useEffect, useState } from "react";
import "@/components/marketing/animations.css";

export default function MarketingHome() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
    {
      quote: "DevPanel transformed our wholesale operations. Orders are up 40%, and our team saves 15 hours per week.",
      author: "Mike Johnson",
      role: "BigMike Wholesale",
      rating: 5,
      photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces",
    },
    {
      quote: "Setup took 10 minutes. We were fully operational the same day. Best decision we made for our business.",
      author: "Sarah Chen",
      role: "Valley Distribution",
      rating: 5,
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    },
    {
      quote: "The disposable menus feature is a game-changer. Our customers love the secure, modern experience.",
      author: "David Rodriguez",
      role: "Green Valley Supplies",
      rating: 5,
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const features = [
    {
      icon: Smartphone,
      title: "DISPOSABLE MENUS",
      description: "Create encrypted product catalogs that burn after viewing or expire. Set expiration times for maximum security.",
      link: "/features",
    },
    {
      icon: Shield,
      title: "ENCRYPTED & SECURE",
      description: "Bank-level encryption for your sensitive business data. GDPR compliant with regular security audits.",
      link: "/features",
    },
    {
      icon: Package,
      title: "INVENTORY TRACKING",
      description: "Real-time stock levels, barcode scanning, multi-location support. Low stock alerts and automated reordering.",
      link: "/features",
    },
    {
      icon: Zap,
      title: "AUTOMATION",
      description: "Automate orders, alerts, reports, and workflows to save time. Focus on growing your business.",
      link: "/features",
    },
    {
      icon: Users,
      title: "CUSTOMER PORTAL",
      description: "White-label portal for customers to browse & order 24/7 without calling you. Self-service ordering.",
      link: "/features",
    },
    {
      icon: BarChart3,
      title: "ANALYTICS",
      description: "Real-time insights into sales, orders, inventory, and customer behavior. Beautiful, actionable dashboards.",
      link: "/features",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
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
      
      <MarketingNav />

      {/* SECTION 1: HERO */}
      <section className="hero-gradient text-white py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              The Modern CRM for<br />
              Wholesale Distributors
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
              Manage customers, products, orders, and inventory in one powerful platform
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm md:text-base">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>Disposable Encrypted Menus</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>Real-time Inventory Tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>Order Management & Automation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>Customer Portal Included</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link to="/signup">
                <MagneticButton className="bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-bg))]/90 h-14 px-8 text-lg font-semibold">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </MagneticButton>
              </Link>
              <Link to="/demo">
                <MagneticButton 
                  variant="outline" 
                  className="border-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-bg))] hover:bg-[hsl(var(--marketing-bg))]/10 h-14 px-8 text-lg"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Schedule Demo
                </MagneticButton>
              </Link>
            </div>

            <p className="text-sm text-white/80 mb-8">
              Trusted by 400+ distributors • $1.4M orders/month
            </p>

            {/* Floating Trust Badges */}
            <div className="mb-12">
              <FloatingBadges />
            </div>

            {/* Dashboard Preview */}
            <div className="mt-12 rounded-2xl overflow-hidden shadow-2xl border-4 border-[hsl(var(--marketing-bg))]/20 bg-gradient-to-br from-white to-gray-100">
              <div className="p-8">
                <div className="space-y-4">
                  {/* Mock Dashboard Header */}
                  <div className="flex items-center justify-between pb-4 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500" />
                      <div>
                        <div className="h-3 w-32 bg-gray-300 rounded mb-2" />
                        <div className="h-2 w-24 bg-gray-200 rounded" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-20 bg-emerald-500 rounded" />
                      <div className="h-8 w-20 bg-gray-200 rounded" />
                    </div>
                  </div>
                  {/* Mock Stats Cards */}
                  <div className="grid grid-cols-4 gap-4 py-4">
                    <div className="p-4 bg-white rounded-lg shadow">
                      <div className="h-2 w-16 bg-gray-200 rounded mb-3" />
                      <div className="h-6 w-20 bg-emerald-500/20 rounded" />
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow">
                      <div className="h-2 w-16 bg-gray-200 rounded mb-3" />
                      <div className="h-6 w-20 bg-blue-500/20 rounded" />
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow">
                      <div className="h-2 w-16 bg-gray-200 rounded mb-3" />
                      <div className="h-6 w-20 bg-purple-500/20 rounded" />
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow">
                      <div className="h-2 w-16 bg-gray-200 rounded mb-3" />
                      <div className="h-6 w-20 bg-orange-500/20 rounded" />
                    </div>
                  </div>
                  {/* Mock Chart */}
                  <div className="p-6 bg-white rounded-lg shadow">
                    <div className="h-3 w-32 bg-gray-300 rounded mb-4" />
                    <div className="flex items-end gap-2 h-32">
                      {[40, 70, 50, 80, 60, 90, 75, 85].map((height, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: SOCIAL PROOF */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-8 text-foreground">
              Trusted by Leading Wholesalers
            </h2>
            
            {/* Customer Logos Placeholder */}
            <div className="flex flex-wrap justify-center items-center gap-8 mb-12 opacity-60 grayscale">
              <div className="text-2xl font-bold text-muted-foreground">BigMike</div>
              <div className="text-2xl font-bold text-muted-foreground">Joe's</div>
              <div className="text-2xl font-bold text-muted-foreground">Valley</div>
              <div className="text-2xl font-bold text-muted-foreground">Green</div>
            </div>

            {/* Rotating Testimonials */}
            <div className="max-w-3xl mx-auto">
              <TestimonialCard {...testimonials[currentTestimonial]} />
              <div className="flex justify-center gap-2 mt-6">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentTestimonial
                        ? "w-8 bg-primary"
                        : "w-2 bg-border"
                    }`}
                    aria-label={`View testimonial ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: KEY FEATURES */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Everything You Need to Run Your Wholesale Business
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/features">
              <Button variant="outline" size="lg">
                See All Features
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 4: HOW IT WORKS - ANIMATED */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              How DevPanel Works
            </h2>
            <p className="text-xl text-muted-foreground mb-12">
              Get started in minutes, not months
            </p>

            <AnimatedHowItWorks />

            <div className="bg-card p-6 rounded-xl border border-border mb-8">
              <p className="text-foreground italic">
                "Setup took 10 minutes. We were fully operational the same day."
              </p>
              <p className="mt-2 font-medium text-foreground">
                - Sarah Chen, Valley Distribution
              </p>
            </div>

            <Link to="/signup">
              <MagneticButton className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white h-12 px-8">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </MagneticButton>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 5: PRICING PREVIEW */}
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
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                        : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.name === "ENTERPRISE" ? "Contact Us" : "Try Free"}
                  </Button>
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
              <Button variant="ghost">
                See Full Pricing Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 6: PRODUCT SHOWCASE */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              See DevPanel in Action
            </h2>

            <div className="rounded-2xl overflow-hidden shadow-2xl border border-border mb-8">
              <div className="aspect-video bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-secondary))] flex items-center justify-center">
                <button className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                  <Play className="h-10 w-10 text-white ml-1" />
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-left mb-8">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <span className="text-foreground">Create disposable menu in 2 clicks</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <span className="text-foreground">Track inventory in real-time</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <span className="text-foreground">Manage orders from one dashboard</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <span className="text-foreground">Customer portal for self-service</span>
              </div>
            </div>

            <Link to="/demo">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8">
                Request Live Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 7: STATS & NUMBERS */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              DevPanel by the Numbers
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <CountUpStat icon={Users} value="400+" label="Distributors" delay={0} />
            <CountUpStat icon={DollarSign} value="$1.4M" label="Orders/Month" delay={0.1} />
            <CountUpStat icon={Clock} value="15" label="Saved/Week" delay={0.2} />
            <CountUpStat icon={TrendingUp} value="99.9%" label="Uptime" delay={0.3} />
            <CountUpStat icon={Star} value="4.8" label="Rating" delay={0.4} />
            <CountUpStat icon={Shield} value="24/7" label="Support" delay={0.5} />
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
    </div>
  );
}
