/**
 * ModernHero - Flowhub-style Centered Hero
 * Deep Indigo, Gold Accents, Clean Typography
 * 
 * Mobile: Simplified layout, static demo preview
 * Desktop: Full interactive demo with hover effects
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import MousePointer2 from "lucide-react/dist/esm/icons/mouse-pointer-2";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Play from "lucide-react/dist/esm/icons/play";
import { lazy, Suspense } from "react";
// Lazy load the heavy demo component
const BusinessAdminDemo = lazy(() => import("./demos/BusinessAdminDemo").then(module => ({ default: module.BusinessAdminDemo })));
import { useMobileOptimized } from "@/hooks/useMobileOptimized";

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
  const { isMobile, isTouchDevice, shouldUseStaticFallback } = useMobileOptimized();
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFeatureIndex((prev) => (prev + 1) % ROTATING_FEATURES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-[90vh] md:min-h-[90vh] bg-[hsl(var(--marketing-bg))] pt-24 md:pt-32 pb-16 md:pb-24 overflow-x-hidden">
      <div className="container mx-auto px-4 relative z-10">

        {/* Centered Hero Content */}
        <div className="max-w-5xl mx-auto text-center mb-10 md:mb-16">
          {/* Rotating Badge */}
          <div className="h-12 mb-6 md:mb-8 flex items-center justify-center" aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="wait">
              <motion.div
                key={featureIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm text-xs md:text-sm font-semibold text-emerald-700"
              >
                <ShieldCheck className="w-4 h-4" />
                {ROTATING_FEATURES[featureIndex].badge}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Headline - Responsive sizing */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] font-bold tracking-tight mb-6 md:mb-8 text-[hsl(var(--marketing-text))] leading-[1.1] max-w-4xl mx-auto">
            Create a Secure Menu <br className="hidden sm:block" />
            <span className="relative inline-block">
              in 30 Seconds
              {/* Emerald underline accent */}
              <svg className="absolute w-full h-2 md:h-3 -bottom-1 left-0 text-emerald-500" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" opacity="0.4" />
              </svg>
            </span>
          </h1>

          {/* Rotating Subheadline */}
          <div className="h-16 md:h-12 mb-4 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={featureIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4 }}
                className="text-lg md:text-xl lg:text-2xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto leading-relaxed px-4 md:px-0 bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--marketing-text))] via-[hsl(var(--marketing-text-light))] to-[hsl(var(--marketing-text))]"
              >
                {ROTATING_FEATURES[featureIndex].sub}
              </motion.p>
            </AnimatePresence>
          </div>

          <p className="text-base md:text-lg text-[hsl(var(--marketing-text-light))]/70 mb-8 md:mb-10 max-w-xl mx-auto">
            The only menu system built for operators who need to disappear.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center mb-10 md:mb-16 px-4 md:px-0">
            <Link to="/signup?plan=free&flow=menu" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                Create Menu Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Link to="/demo" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg font-bold border-2 border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-white hover:border-emerald-500 rounded-lg transition-all duration-300"
              >
                Watch Demo
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <p className="text-xs md:text-sm font-semibold text-[hsl(var(--marketing-text-light))] uppercase tracking-widest mb-4">
            170+ features • No sales call • Live in 60 seconds
          </p>
        </div>

        {/* Centered Product Visual (Browser Mockup) */}
        <div className={`relative max-w-6xl mx-auto ${isMobile ? '-mb-20' : '-mb-40'} perspective-[1200px] group`}>
          <div className={`relative rounded-lg border border-[hsl(var(--marketing-border))] bg-white shadow-2xl overflow-hidden ${!isMobile ? 'transform group-hover:rotate-x-2 transition-transform duration-700 ease-out' : ''}`}>

            {/* Browser Header */}
            <div className="h-8 md:h-10 bg-[hsl(var(--marketing-bg-subtle))] border-b border-[hsl(var(--marketing-border))] flex items-center px-3 md:px-4 gap-2">
              <div className="flex gap-1.5 opacity-50">
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-red-400" />
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <div className="inline-block px-2 md:px-3 py-0.5 rounded-md bg-white border border-[hsl(var(--marketing-border))] text-[9px] md:text-[10px] text-[hsl(var(--marketing-text-light))] font-medium">
                  app.floraiq.com
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className={`${isMobile ? 'aspect-[4/3]' : 'aspect-[16/9]'} bg-[hsl(var(--marketing-bg))] relative flex items-center justify-center overflow-hidden group/demo`}>

              {/* Live Demo Component */}
              <div className="absolute inset-0 z-0">
                <Suspense fallback={
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                      <div className="h-8 w-32 bg-slate-200 rounded"></div>
                      <div className="h-64 w-96 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                }>
                  <BusinessAdminDemo />
                </Suspense>
              </div>

              {/* Interaction Overlay */}
              {!shouldUseStaticFallback && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--marketing-bg))]/60 backdrop-blur-[2px] transition-all duration-500 group-hover/demo:opacity-0 group-hover/demo:pointer-events-none group-hover/demo:backdrop-blur-none">
                  <div className="text-center transform transition-transform duration-500 group-hover/demo:scale-110">
                    <div className="w-16 md:w-20 h-16 md:h-20 bg-[hsl(var(--marketing-primary))]/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 border border-[hsl(var(--marketing-primary))]/20 shadow-[0_0_30px_hsl(var(--marketing-primary))_inset] animate-pulse">
                      <MousePointer2 className="w-6 md:w-8 h-6 md:h-8 text-[hsl(var(--marketing-primary))]" />
                    </div>
                    <div className="px-4 md:px-6 py-2 md:py-3 rounded-full bg-[hsl(var(--marketing-primary))] shadow-xl animate-bounce">
                      <p className="font-bold text-white tracking-wide text-sm md:text-base">
                        Hover to Interact
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Touch device overlay */}
              {shouldUseStaticFallback && (
                <div className="absolute inset-0 z-10 flex items-end justify-center pb-4">
                  <Link to="/demo">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--marketing-primary))] shadow-xl">
                      <Play className="w-4 h-4 text-white" />
                      <span className="font-bold text-white text-sm">Watch Demo</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Glow */}
          <div className="absolute -bottom-10 left-0 right-0 h-20 bg-[hsl(var(--marketing-primary))] opacity-20 blur-[100px] z-[-1]" />
        </div>
      </div>
    </section>
  );
}
