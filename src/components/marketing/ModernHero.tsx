/**
 * ModernHero - Flowhub-style Centered Hero
 * Deep Indigo, Gold Accents, Clean Typography
 * 
 * Mobile: Simplified layout, static demo preview
 * Desktop: Full interactive demo with hover effects
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EnhancedDashboardPreview } from "@/components/marketing/EnhancedDashboardPreview";
import { ArrowRight, ShieldCheck, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const ROTATING_FEATURES = [
  {
    badge: "OPSEC-Grade Security • No Demo Required",
    sub: "Encrypted URLs • Auto-Burn on Screenshot • Device Fingerprinting"
  },
  {
    badge: "Built for Speed • Live in Seconds",
    sub: "Instant Catalog Creation • One-Click Publishing • Real-Time Sync"
  },
  {
    badge: "Complete Anonymity • Zero Footprint",
    sub: "No Tracking • Burner-Friendly • Anti-Forensic Design"
  }
];

export function ModernHero() {
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFeatureIndex((prev) => (prev + 1) % ROTATING_FEATURES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative bg-white pt-8 pb-16 md:pb-24 overflow-x-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full max-w-[1400px]">
        {/* Nested Flowhub-style container */}
        <div className="bg-[hsl(var(--marketing-bg-subtle))] rounded-[40px] md:rounded-[60px] pt-16 md:pt-24 pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 w-full">

          {/* Centered Hero Content */}
          <div className="max-w-5xl mx-auto text-center mb-16 md:mb-20">
            {/* Rotating Badge */}
            <div className="h-12 mb-8 flex items-center justify-center" aria-live="polite" aria-atomic="true">
              <AnimatePresence mode="wait">
                <motion.div
                  key={featureIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--marketing-primary)/0.1)] border border-[hsl(var(--marketing-primary)/0.2)] shadow-sm text-sm font-medium uppercase tracking-wider text-[hsl(var(--marketing-primary))]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {ROTATING_FEATURES[featureIndex].badge}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Headline - Responsive sizing */}
            <h1 className="text-5xl sm:text-6xl md:text-[5.5rem] font-extrabold tracking-tight mb-8 text-[hsl(var(--marketing-primary))] leading-[1.05] max-w-4xl mx-auto">
              Create a Secure Menu <br className="hidden sm:block" />
              <span className="relative inline-block text-[hsl(var(--marketing-primary))]">
                in 30 Seconds
              </span>
            </h1>

            {/* Rotating Subheadline */}
            <div className="h-20 md:h-24 mb-6 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={featureIndex}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                  className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-4 md:px-0"
                >
                  {ROTATING_FEATURES[featureIndex].sub}
                </motion.p>
              </AnimatePresence>
            </div>

            <p className="text-lg text-slate-500 mb-4 max-w-xl mx-auto font-semibold">
              Your operation. One platform.
            </p>
            <p className="text-base text-slate-400 mb-10 max-w-xl mx-auto">
              Manage wholesale orders, inventory, menus, and compliance — all in one place.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 px-4 md:px-0">
              <Link to="/signup?plan=free&flow=menu" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-16 px-10 text-base uppercase tracking-wide font-bold bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary)/0.9)] text-white rounded-lg transition-all duration-200"
                >
                  Create Menu Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>

              <Link to="/demo" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto h-16 px-10 text-base uppercase tracking-wide font-bold border-2 border-gray-200 text-[hsl(var(--marketing-text))] hover:bg-white hover:border-[hsl(var(--marketing-primary)/0.3)] hover:text-[hsl(var(--marketing-primary))] rounded-lg transition-all duration-200 bg-transparent"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-4">
              170+ features • No sales call • Live in 60 seconds
            </p>
          </div>

          {/* Centered Product Visual (Browser Mockup) */}
          <div className="relative z-20 -mt-10 lg:-mt-24 w-full h-[280px] sm:h-[380px] md:h-[520px] lg:h-[680px]">
            <div className="absolute left-1/2 top-0 origin-top transform -translate-x-1/2 scale-[0.40] sm:scale-[0.55] md:scale-[0.75] lg:scale-100 w-[1100px] transition-transform duration-300">
              <div className="relative rounded-xl border border-slate-200/60 bg-white shadow-[0_20px_60px_-15px_rgba(46,22,121,0.2)] overflow-hidden">
                {/* Browser Header */}
                <div className="h-8 bg-white/80 backdrop-blur border-b border-slate-200/60 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5 opacity-50">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                </div>

                {/* Interactive Dashboard Preview */}
                <div className="bg-slate-50 relative w-full overflow-hidden">
                  <EnhancedDashboardPreview />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
