/**
 * ModernHero - Flowhub-style Centered Hero
 * Deep Indigo, Gold Accents, Clean Typography
 * 
 * Mobile: Simplified layout, static demo preview
 * Desktop: Full interactive demo with hover effects
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, MousePointer2, Smartphone, Play } from "lucide-react";
import { lazy, Suspense } from "react";
// Lazy load the heavy demo component
const BusinessAdminDemo = lazy(() => import("./demos/BusinessAdminDemo").then(module => ({ default: module.BusinessAdminDemo })));
import { useMobileOptimized } from "@/hooks/useMobileOptimized";


import { motion } from "framer-motion";

// Removed ROTATING_FEATURES


export function ModernHero() {
  const { isMobile, isTouchDevice, shouldUseStaticFallback } = useMobileOptimized();



  return (
    <section className="relative min-h-[90vh] md:min-h-[90vh] bg-[hsl(var(--marketing-bg))] pt-24 md:pt-32 pb-16 md:pb-24 overflow-x-hidden">
      <div className="container mx-auto px-4 relative z-10">

        {/* Centered Hero Content */}
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            OPSEC-Grade • No Javascript Required
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] font-bold tracking-tight mb-6 text-[hsl(var(--marketing-text))] leading-[1.1] max-w-4xl mx-auto">
          Secure Disposable Menus <br className="hidden sm:block" />
          <span className="relative inline-block text-[hsl(var(--marketing-primary))]">
            in 30 Seconds
          </span>
        </h1>

        {/* Subheadline - Static & Punchy */}
        <p className="text-lg md:text-xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto leading-relaxed mb-10">
          For operators who need to disappear. Encrypted URLs, auto-burn on screenshot, and zero third-party trackers.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center mb-12 px-4 md:px-0">
          <Link to="/signup?plan=free&flow=menu" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto h-12 px-8 text-base font-bold bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white rounded shadow-sm transition-all"
            >
              Create Menu
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>

          <Link to="/demo" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-12 px-8 text-base font-bold border border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-slate-50 rounded transition-all"
            >
              View Source
            </Button>
          </Link>
        </div>

        {/* Trust Indicators - Specific Numbers */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-xs font-mono text-[hsl(var(--marketing-text-light))] uppercase tracking-wider">
          <span>• 1.2M+ MENUS BURNED</span>
          <span>• ZERO DATA LEAKS</span>
          <span>• 99.99% UPTIME</span>
        </div>
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


      </div>
    </section >
  );
}
