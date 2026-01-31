/**
 * ModernHero - Enhanced with Cycling Features & Animations
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, MousePointer2, Play, Zap, Lock, Flame, Eye } from "lucide-react";
import { lazy, Suspense, useState, useEffect } from "react";
const BusinessAdminDemo = lazy(() => import("./demos/BusinessAdminDemo").then(module => ({ default: module.BusinessAdminDemo })));
import { useMobileOptimized } from "@/hooks/useMobileOptimized";
import { motion, AnimatePresence } from "framer-motion";

// Cycling features that describe what the website does
const CYCLE_FEATURES = [
  {
    icon: Lock,
    title: "Encrypted URLs",
    description: "Every link is uniquely hashed. No two menus share the same signature.",
    color: "text-emerald-500"
  },
  {
    icon: Flame,
    title: "Auto-Burn on Screenshot",
    description: "Detect screenshots and self-destruct. Your data stays yours.",
    color: "text-orange-500"
  },
  {
    icon: Eye,
    title: "Zero Third-Party Trackers",
    description: "No analytics. No cookies. No fingerprinting. Pure privacy.",
    color: "text-blue-500"
  },
  {
    icon: Zap,
    title: "Live in 30 Seconds",
    description: "Create, customize, and deploy a secure menu instantly.",
    color: "text-purple-500"
  }
];

export function ModernHero() {
  const { isMobile, shouldUseStaticFallback } = useMobileOptimized();
  const [featureIndex, setFeatureIndex] = useState(0);

  // Cycle through features
  useEffect(() => {
    const interval = setInterval(() => {
      setFeatureIndex((prev) => (prev + 1) % CYCLE_FEATURES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const currentFeature = CYCLE_FEATURES[featureIndex];
  const FeatureIcon = currentFeature.icon;

  return (
    <section className="relative min-h-[90vh] bg-[hsl(var(--marketing-bg))] pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden flex flex-col justify-center">
      {/* Technical Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Ambient Gradient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">

          {/* Badge: OPSEC-Grade */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 text-xs font-mono font-bold tracking-widest uppercase shadow-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              OPSEC-Grade • No Javascript Required
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 text-[hsl(var(--marketing-text))] leading-[1]"
          >
            Secure Disposable Menus
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
              in 30 Seconds
            </span>
          </motion.h1>

          {/* Cycling Terminal Output - The "Cool Animation" */}
          <div className="h-12 mb-8 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={featureIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="font-mono text-sm md:text-base text-slate-500 bg-slate-100/50 px-4 py-2 rounded border border-slate-200 inline-flex items-center gap-2"
              >
                <span className="text-emerald-500">root@floraiq:~#</span>
                <span className="text-slate-700 font-semibold typing-cursor">
                  {CYCLE_FEATURES[featureIndex].title}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Subheadline - User's exact text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-lg md:text-xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto leading-relaxed mb-10 font-medium"
          >
            For operators who need to disappear. Encrypted URLs, auto-burn on screenshot, and zero third-party trackers.
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <Link to="/signup?plan=free&flow=menu">
              <Button
                size="lg"
                className="h-14 px-10 text-lg font-bold bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white rounded-lg shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
              >
                Create Menu
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Browser Mockup - Slanted 3D Perspective */}
      <motion.div
        initial={{ opacity: 0, rotateX: 20, y: 100 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ duration: 1, delay: 0.2, type: "spring" }}
        className={`relative max-w-5xl mx-auto w-full px-4 ${isMobile ? '-mb-20' : '-mb-32'} perspective-[2000px]`}
      >
        <div className="relative rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden transform transition-transform hover:scale-[1.01] duration-500">
          {/* Browser Header */}
          <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="w-3 h-3 rounded-full bg-slate-300" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-400 font-mono">
                <Lock className="w-3 h-3" />
                floraiq.com/menu/x89s-shield
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="aspect-[16/9] bg-slate-100 relative group overflow-hidden">
            <Suspense fallback={<div className="w-full h-full bg-slate-100 animate-pulse" />}>
              <BusinessAdminDemo />
            </Suspense>

            {/* Hover Overlay */}
            {!shouldUseStaticFallback && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                <div className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform">
                  Click to Interact
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
