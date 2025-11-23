import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Zap, Lock, Smartphone, CheckCircle } from "lucide-react";
import { ConfettiButton } from "@/components/marketing/ConfettiButton";
import { AnimatedMeshBackground } from "@/components/marketing/AnimatedMeshBackground";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { CursorSpotlight } from "@/components/marketing/CursorSpotlight";
import { FloatingBadges } from "@/components/marketing/FloatingBadges";
import { TypewriterText } from "@/components/marketing/TypewriterText";

import { useRef } from "react";

export function ModernHero() {
  const containerRef = useRef<HTMLElement>(null);

  return (
    <section ref={containerRef} className="relative min-h-[90vh] bg-[hsl(var(--marketing-bg))] pt-32 pb-20">
      {/* Background Effects */}
      <CursorSpotlight containerRef={containerRef} />
      <AnimatedMeshBackground />

      <div className="container mx-auto px-4 relative z-10 h-full flex items-center">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full">

          {/* Left Column: Text */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))/0.1] border border-[hsl(var(--marketing-primary))/0.2] text-[hsl(var(--marketing-primary))] text-sm font-medium mb-6"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Bank-Level Security for Cannabis</span>
            </motion.div>

            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 text-[hsl(var(--marketing-text))] leading-[1.1]">
              The Operating System for <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-secondary))]">
                <TypewriterText text="Cannabis Distribution" delay={0.5} />
              </span>
            </h1>

            <ul className="space-y-3 mb-8 text-lg text-[hsl(var(--marketing-text-light))]">
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[hsl(var(--marketing-primary))]" />
                <span>Real-time Inventory & Automated Logistics</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[hsl(var(--marketing-primary))]" />
                <span>Secure Auto-Expiring Catalogs</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[hsl(var(--marketing-primary))]" />
                <span>Bank-Level Compliance & Security</span>
              </li>
            </ul>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup">
                  <MagneticButton strength={0.3}>
                    <ConfettiButton
                      size="lg"
                      className="w-full sm:w-auto bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white font-bold h-14 px-8 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-300"
                    >
                      Start Free Trial
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </ConfettiButton>
                  </MagneticButton>
                </Link>

                <Link to="/demo">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto h-14 px-8 rounded-xl border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-bg-subtle))] hover:text-[hsl(var(--marketing-primary))]"
                  >
                    View Demo
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-[hsl(var(--marketing-text-light))] ml-1">
                No credit card required. 14-day free trial.
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-8">
              <div className="flex items-center gap-6 text-[hsl(var(--marketing-text-light))] text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[hsl(var(--marketing-accent))]" />
                  <span>Setup in 2 mins</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[hsl(var(--marketing-accent))]" />
                  <span>End-to-end Encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[hsl(var(--marketing-accent))]" />
                  <span>Mobile First</span>
                </div>
              </div>

              <FloatingBadges />
            </div>
          </motion.div>

          {/* Right Column: Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="relative perspective-1000"
          >
            {/* Glow Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[hsl(var(--marketing-primary))] opacity-20 blur-[100px] rounded-full pointer-events-none" />

            {/* Glassmorphic Card Stack */}
            <div className="relative w-full aspect-square max-w-[600px] mx-auto">
              {/* Back Card (Inventory) */}
              <motion.div
                animate={{ rotate: -6, y: -20 }}
                className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-border))] opacity-40 scale-95 origin-bottom-right z-0"
              />

              {/* Middle Card (Orders) */}
              <motion.div
                animate={{ rotate: 6, y: 20 }}
                className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-border))] opacity-60 scale-95 origin-bottom-left z-10"
              />

              {/* Front Card (Dashboard UI Mockup) */}
              <motion.div
                whileHover={{
                  rotateX: 5,
                  rotateY: -5,
                  scale: 1.02,
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{ transformStyle: "preserve-3d" }}
                className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-primary))/0.3] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] z-20 overflow-hidden backdrop-blur-xl"
              >
                {/* Header Mockup */}
                <div className="h-14 border-b border-[hsl(var(--marketing-border))] flex items-center px-6 gap-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="h-2 w-32 bg-[hsl(var(--marketing-border))] rounded-full ml-auto opacity-30" />
                </div>

                {/* Content Mockup */}
                <div className="p-6 space-y-6">
                  {/* Stat Cards Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))] transform transition-transform hover:scale-105">
                      <div className="text-[hsl(var(--marketing-text-light))] text-xs mb-1">Active Orders</div>
                      <div className="text-2xl font-bold text-[hsl(var(--marketing-text))]">24</div>
                      <div className="text-xs text-[hsl(var(--marketing-accent))] mt-1">+12% vs yesterday</div>
                    </div>
                    <div className="p-4 rounded-xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))] transform transition-transform hover:scale-105">
                      <div className="text-[hsl(var(--marketing-text-light))] text-xs mb-1">Revenue</div>
                      <div className="text-2xl font-bold text-[hsl(var(--marketing-text))]">$8,450</div>
                      <div className="text-xs text-[hsl(var(--marketing-accent))] mt-1">+5% vs yesterday</div>
                    </div>
                  </div>

                  {/* Chart Mockup */}
                  <div className="h-32 rounded-xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))] relative overflow-hidden flex items-end px-2 pb-2 gap-2">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 0.5 + (i * 0.05), duration: 0.5 }}
                        className="flex-1 bg-[hsl(var(--marketing-primary))] rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                      />
                    ))}
                  </div>

                  {/* Menu Item Mockup */}
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-[hsl(var(--marketing-primary))/0.1] border border-[hsl(var(--marketing-primary))/0.2]">
                    <div className="w-10 h-10 rounded-lg bg-[hsl(var(--marketing-primary))] flex items-center justify-center text-white">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[hsl(var(--marketing-text))]">Disposable Menu Generated</div>
                      <div className="text-xs text-[hsl(var(--marketing-text-light))]">Expires in 24 hours • 12 views</div>
                    </div>
                    <div className="ml-auto text-xs font-mono bg-[hsl(var(--marketing-bg))] px-2 py-1 rounded text-[hsl(var(--marketing-primary))]">
                      #A7X-99
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

