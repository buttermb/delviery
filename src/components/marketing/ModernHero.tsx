/**
 * ModernHero - Flowhub-style Centered Hero
 * Deep Indigo, Gold Accents, Clean Typography
 * 
 * Mobile: Simplified layout, static demo preview
 * Desktop: Full interactive demo with hover effects
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
        <div className="relative max-w-6xl mx-auto -mb-40 perspective-[1200px] group">
          <div className="relative rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">

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

            {/* Static Dashboard Preview */}
            <div className="aspect-[16/9] bg-slate-50 relative flex items-center justify-center overflow-hidden">
              <div className="w-full h-full p-6 grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-3">
                  <div className="h-8 bg-emerald-100 rounded-lg" />
                  <div className="h-6 bg-slate-200 rounded w-3/4" />
                  <div className="h-6 bg-slate-200 rounded w-2/3" />
                  <div className="h-6 bg-slate-200 rounded w-4/5" />
                  <div className="h-6 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="col-span-3 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-24 bg-white rounded-xl border border-gray-200 p-4">
                      <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
                      <div className="h-8 bg-emerald-100 rounded w-2/3" />
                    </div>
                    <div className="h-24 bg-white rounded-xl border border-gray-200 p-4">
                      <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
                      <div className="h-8 bg-emerald-100 rounded w-2/3" />
                    </div>
                    <div className="h-24 bg-white rounded-xl border border-gray-200 p-4">
                      <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
                      <div className="h-8 bg-emerald-100 rounded w-2/3" />
                    </div>
                  </div>
                  <div className="h-48 bg-white rounded-xl border border-gray-200" />
                </div>
              </div>

              {/* CTA Overlay */}
              <div className="absolute inset-0 flex items-end justify-center pb-6">
                <Link to="/demo">
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 shadow-xl hover:bg-emerald-700 transition-colors">
                    <Play className="w-4 h-4 text-white" />
                    <span className="font-bold text-white text-sm">Watch Demo</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Glow */}
          <div className="absolute -bottom-10 left-0 right-0 h-40 bg-emerald-500 opacity-20 blur-[120px] z-[-1]" />
        </div>
      </div>
    </section>
  );
}
