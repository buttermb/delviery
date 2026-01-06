/**
 * ModernHero - Flowhub-style Centered Hero
 * Deep Indigo, Gold Accents, Clean Typography
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, MousePointer2 } from "lucide-react";
import { BusinessAdminDemo } from "./demos/BusinessAdminDemo";

export function ModernHero() {
  return (
    <section className="relative min-h-[90vh] bg-[hsl(var(--marketing-bg))] pt-32 pb-24 overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">

        {/* Centered Hero Content */}
        <div className="max-w-5xl mx-auto text-center mb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[hsl(var(--marketing-border))] shadow-sm mb-8 animate-fade-in text-sm font-semibold text-[hsl(var(--marketing-primary))]">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-accent))]"></span>
            The #1 Platform for Cannabis Distribution
          </div>

          {/* Headline - Matches Flowhub's large geometric style */}
          <h1 className="text-6xl md:text-7xl lg:text-[5rem] font-bold tracking-tight mb-8 text-[hsl(var(--marketing-text))] leading-[1.1] max-w-4xl mx-auto">
            Simplify your <br />
            <span className="relative inline-block">
              cannabis operations
              {/* Gold underline accent */}
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-[hsl(var(--marketing-accent))]" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" opacity="0.3" />
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-[hsl(var(--marketing-text-light))] mb-10 max-w-2xl mx-auto leading-relaxed">
            Manage inventory, compliance, and delivery logistics from a single, secure operating system.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link to="/demo">
              <Button
                size="lg"
                className="h-16 px-10 text-lg font-bold bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                Book a Demo
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Link to="/signup?plan=free">
              <Button
                variant="outline"
                size="lg"
                className="h-16 px-10 text-lg font-bold border-2 border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-white hover:border-[hsl(var(--marketing-primary))] rounded-lg transition-all duration-300"
              >
                Start Free Trial
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <p className="text-sm font-semibold text-[hsl(var(--marketing-text-light))] uppercase tracking-widest mb-4">
            Trusted by active distributors
          </p>
        </div>

        {/* Centered Product Visual (Browser Mockup) */}
        <div className="relative max-w-6xl mx-auto -mb-40 perspective-[1200px] group">
          <div className="relative rounded-lg border border-[hsl(var(--marketing-border))] bg-white shadow-2xl overflow-hidden transform group-hover:rotate-x-2 transition-transform duration-700 ease-out">

            {/* Browser Header */}
            <div className="h-10 bg-[hsl(var(--marketing-bg-subtle))] border-b border-[hsl(var(--marketing-border))] flex items-center px-4 gap-2">
              <div className="flex gap-1.5 opacity-50">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <div className="inline-block px-3 py-0.5 rounded-md bg-white border border-[hsl(var(--marketing-border))] text-[10px] text-[hsl(var(--marketing-text-light))] font-medium">
                  app.floraiq.com
                </div>
              </div>
            </div>

            {/* Dashboard Content Placeholder */}
            <div className="aspect-[16/9] bg-[hsl(var(--marketing-bg))] relative flex items-center justify-center overflow-hidden group/demo">

              {/* Live Demo Component */}
              <div className="absolute inset-0 z-0">
                <BusinessAdminDemo />
              </div>

              {/* Interaction Overlay - Fades out on hover to reveal interactivity */}
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--marketing-bg))]/60 backdrop-blur-[2px] transition-all duration-500 group-hover/demo:opacity-0 group-hover/demo:pointer-events-none group-hover/demo:backdrop-blur-none">
                <div className="text-center transform transition-transform duration-500 group-hover/demo:scale-110">
                  <div className="w-20 h-20 bg-[hsl(var(--marketing-primary))]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[hsl(var(--marketing-primary))]/20 shadow-[0_0_30px_hsl(var(--marketing-primary))_inset] animate-pulse">
                    <MousePointer2 className="w-8 h-8 text-[hsl(var(--marketing-primary))]" />
                  </div>
                  <div className="px-6 py-3 rounded-full bg-[hsl(var(--marketing-primary))] shadow-xl animate-bounce">
                    <p className="font-bold text-white tracking-wide">Hover to Interact</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Glow */}
          <div className="absolute -bottom-10 left-0 right-0 h-20 bg-[hsl(var(--marketing-primary))] opacity-20 blur-[100px] z-[-1]" />
        </div>
      </div>
    </section>
  );
}
