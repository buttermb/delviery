import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Zap, Lock, Smartphone, CheckCircle, TrendingUp, ShoppingBag, QrCode, Clock, Users, DollarSign } from "lucide-react";
import { ConfettiButton } from "@/components/marketing/ConfettiButton";
import { AnimatedMeshBackground } from "@/components/marketing/AnimatedMeshBackground";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { CursorSpotlight } from "@/components/marketing/CursorSpotlight";
import { FloatingBadges } from "@/components/marketing/FloatingBadges";
import { TypewriterText } from "@/components/marketing/TypewriterText";
import { useState, useEffect, useRef } from "react";

const HERO_TABS = [
  { id: 'orders', label: 'Active Orders', icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-500' },
  { id: 'revenue', label: 'Revenue', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500' },
  { id: 'menus', label: 'Disposable Menus', icon: QrCode, color: 'text-purple-500', bg: 'bg-purple-500' },
];

export function ModernHero() {
  const containerRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Auto-rotate tabs if not hovering
  useEffect(() => {
    if (isHovering) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % HERO_TABS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isHovering]);

  // Mouse tilt effect optimization
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-300, 300], [5, -5]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-300, 300], [-5, 5]), { stiffness: 150, damping: 20 });

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(event.clientX - centerX);
    y.set(event.clientY - centerY);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
    setIsHovering(false);
  }

  return (
    <section ref={containerRef} className="relative min-h-[90vh] bg-[hsl(var(--marketing-bg))] pt-32 pb-20 overflow-hidden">
      {/* Background Effects - Optimized */}
      <div className="absolute inset-0 z-0">
        <CursorSpotlight containerRef={containerRef} />
        <AnimatedMeshBackground />
      </div>

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
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))/0.1] border border-[hsl(var(--marketing-primary))/0.2] text-[hsl(var(--marketing-primary))] text-sm font-medium mb-6 backdrop-blur-sm"
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

          {/* Right Column: Interactive Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="relative perspective-1000"
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={handleMouseLeave}
          >
            {/* Glow Effect - Optimized with will-change */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[hsl(var(--marketing-primary))] opacity-20 blur-[100px] rounded-full pointer-events-none will-change-transform" />

            {/* Glassmorphic Card Stack */}
            <div className="relative w-full aspect-square max-w-[600px] mx-auto">
              {/* Back Card (Decorative) */}
              <motion.div
                animate={{ rotate: -6, y: -20 }}
                className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-border))] opacity-40 scale-95 origin-bottom-right z-0"
              />

              {/* Middle Card (Decorative) */}
              <motion.div
                animate={{ rotate: 6, y: 20 }}
                className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-border))] opacity-60 scale-95 origin-bottom-left z-10"
              />

              {/* Front Card (Interactive Dashboard) */}
              <motion.div
                style={{
                  rotateX,
                  rotateY,
                  transformStyle: "preserve-3d"
                }}
                className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-primary))/0.3] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] z-20 overflow-hidden backdrop-blur-xl flex flex-col"
              >
                {/* Header Mockup */}
                <div className="h-16 border-b border-[hsl(var(--marketing-border))] flex items-center px-6 gap-4 bg-[hsl(var(--marketing-bg))]/50">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 ml-auto">
                    {HERO_TABS.map((tab, index) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(index)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === index
                            ? "bg-[hsl(var(--marketing-primary))/0.1] text-[hsl(var(--marketing-primary))]"
                            : "text-[hsl(var(--marketing-text-light))] hover:bg-[hsl(var(--marketing-bg-subtle))]"
                          }`}
                      >
                        <tab.icon className="w-3 h-3" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className="h-full flex flex-col"
                    >
                      {activeTab === 0 && (
                        <div className="space-y-6 h-full">
                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-sm text-[hsl(var(--marketing-text-light))] mb-1">Active Orders</div>
                              <div className="text-4xl font-bold text-[hsl(var(--marketing-text))]">24</div>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg text-sm font-medium">
                              <TrendingUp className="w-4 h-4" />
                              +12%
                            </div>
                          </div>

                          {/* Order List Mockup */}
                          <div className="space-y-3 flex-1">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))]">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                  <ShoppingBag className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-[hsl(var(--marketing-text))]">Order #{1000 + i}</div>
                                  <div className="text-xs text-[hsl(var(--marketing-text-light))]">Just now</div>
                                </div>
                                <div className="ml-auto text-sm font-bold text-[hsl(var(--marketing-text))]">$120.00</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === 1 && (
                        <div className="space-y-6 h-full">
                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-sm text-[hsl(var(--marketing-text-light))] mb-1">Total Revenue</div>
                              <div className="text-4xl font-bold text-[hsl(var(--marketing-text))]">$8,450</div>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg text-sm font-medium">
                              <TrendingUp className="w-4 h-4" />
                              +5%
                            </div>
                          </div>

                          {/* Chart Mockup */}
                          <div className="flex-1 rounded-xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))] relative overflow-hidden flex items-end px-4 pb-4 gap-3 pt-8">
                            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                              <motion.div
                                key={i}
                                initial={{ height: 0 }}
                                animate={{ height: `${h}%` }}
                                transition={{ delay: i * 0.05, duration: 0.5 }}
                                className="flex-1 bg-[hsl(var(--marketing-primary))] rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === 2 && (
                        <div className="space-y-6 h-full flex flex-col">
                          <div className="text-center mb-4">
                            <div className="text-sm text-[hsl(var(--marketing-text-light))] mb-1">Disposable Menu Generated</div>
                            <div className="text-xl font-bold text-[hsl(var(--marketing-text))]">Expires in 24 hours</div>
                          </div>

                          <div className="flex-1 flex items-center justify-center">
                            <div className="relative p-6 rounded-2xl bg-white border-2 border-dashed border-gray-200">
                              <QrCode className="w-32 h-32 text-gray-800" />
                              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[hsl(var(--marketing-primary))] text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                                SCAN ME
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-center gap-4 text-xs text-[hsl(var(--marketing-text-light))]">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              12 Views
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              23h remaining
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Progress Bar for Auto-rotation */}
                <div className="h-1 bg-[hsl(var(--marketing-border))] w-full">
                  <motion.div
                    key={activeTab}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 4, ease: "linear" }}
                    className="h-full bg-[hsl(var(--marketing-primary))]"
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
