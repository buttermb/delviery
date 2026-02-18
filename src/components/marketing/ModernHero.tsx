/**
 * ModernHero - Flowhub-style Centered Hero
 * Deep Indigo, Gold Accents, Clean Typography
 * 
 * Mobile: Simplified layout, static demo preview
 * Desktop: Full interactive demo with hover effects
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, MousePointer2, Play } from "lucide-react";
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
  const { isMobile, shouldUseStaticFallback } = useMobileOptimized();
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFeatureIndex((prev) => (prev + 1) % ROTATING_FEATURES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-[90vh] md:min-h-[90vh] bg-white pt-24 md:pt-32 pb-16 md:pb-24 overflow-x-hidden">
      <div className="container mx-auto px-4 relative z-10">

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
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm text-sm font-medium uppercase tracking-wider text-emerald-700"
              >
                <ShieldCheck className="w-4 h-4" />
                {ROTATING_FEATURES[featureIndex].badge}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Headline - Responsive sizing */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-8 text-slate-900 leading-[1.1] max-w-4xl mx-auto">
            Create a Secure Menu <br className="hidden sm:block" />
            <span className="relative inline-block text-emerald-600">
              in 30 Seconds
              {/* Emerald underline accent */}
              <svg className="absolute w-full h-3 -bottom-2 left-0 text-emerald-200" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" opacity="0.6" />
              </svg>
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

          <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto">
            The only menu system built for operators who need to disappear.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 px-4 md:px-0">
            <Link to="/signup?plan=free&flow=menu" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
              >
                Create Menu Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Link to="/demo" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-lg font-bold border-2 border-gray-200 text-slate-700 hover:bg-gray-50 hover:border-emerald-200 hover:text-emerald-700 rounded-xl transition-all duration-200"
              >
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
        <div className={`relative max-w-6xl mx-auto ${isMobile ? '-mb-20' : '-mb-40'} perspective-[1200px] group`}>
          <div className={`relative rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden ${!isMobile ? 'transform group-hover:rotate-x-2 transition-transform duration-700 ease-out' : ''}`}>

            {/* Browser Header */}
            <div className="h-10 bg-gray-50 border-b border-gray-200 flex items-center px-4 gap-2">
              <div className="flex gap-1.5 opacity-50">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <div className="inline-block px-3 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] text-slate-400 font-medium">
                  app.floraiq.com
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className={`${isMobile ? 'aspect-[4/3]' : 'aspect-[16/9]'} bg-white relative flex items-center justify-center overflow-hidden group/demo`}>

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
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-all duration-500 group-hover/demo:opacity-0 group-hover/demo:pointer-events-none group-hover/demo:backdrop-blur-none">
                  <div className="text-center transform transition-transform duration-500 group-hover/demo:scale-110">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)_inset] animate-pulse">
                      <MousePointer2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div className="px-6 py-3 rounded-full bg-emerald-600 shadow-xl animate-bounce">
                      <p className="font-bold text-white tracking-wide text-base">
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
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 shadow-xl">
                      <Play className="w-4 h-4 text-white" />
                      <span className="font-bold text-white text-sm">Watch Demo</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Glow */}
          <div className="absolute -bottom-10 left-0 right-0 h-40 bg-emerald-500 opacity-20 blur-[120px] z-[-1]" />
        </div>
      </div>
    </section>
  );
}
