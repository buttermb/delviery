/**
 * ModernHero - Optimized hero section
 * Reduced animations for better scroll performance
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Zap, Lock, Smartphone, CheckCircle, TrendingUp, ShoppingBag, QrCode, Clock, Users, DollarSign } from "lucide-react";
import { ConfettiButton } from "@/components/marketing/ConfettiButton";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { FloatingBadges } from "@/components/marketing/FloatingBadges";
import { TypewriterText } from "@/components/marketing/TypewriterText";
import { LiveUserCount } from "@/components/marketing/LiveSocialProof";
import { useState, useEffect } from "react";

const HERO_TABS = [
  { id: 'orders', label: 'Active Orders', icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-500' },
  { id: 'revenue', label: 'Revenue', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500' },
  { id: 'menus', label: 'Disposable Menus', icon: QrCode, color: 'text-purple-500', bg: 'bg-purple-500' },
];

export function ModernHero() {
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

  return (
    <section className="relative min-h-[70vh] bg-[hsl(var(--marketing-bg))] pt-32 pb-20 overflow-visible">
      {/* Static background glow - using relative positioning */}
      <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div 
          className="absolute top-[20%] left-[10%] w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
          style={{ background: 'hsl(var(--marketing-primary))' }}
        />
        <div 
          className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] rounded-full opacity-10 blur-[100px]"
          style={{ background: 'hsl(var(--marketing-accent))' }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10 py-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full">

          {/* Left Column: Text */}
          <div className="text-left animate-fade-in">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))/0.1] border border-[hsl(var(--marketing-primary))/0.2] text-[hsl(var(--marketing-primary))] text-sm font-medium backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Bank-Level Security</span>
              </div>
              <LiveUserCount />
            </div>

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
          </div>

          {/* Right Column: Interactive Visual - Simplified */}
          <div 
            className="relative animate-fade-in-up"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            {/* Glow Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] bg-[hsl(var(--marketing-primary))] opacity-15 blur-[80px] rounded-full pointer-events-none" />

            {/* Card Stack - Static transforms */}
            <div className="relative w-full aspect-square max-w-[600px] mx-auto">
              {/* Back Card */}
              <div 
                className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-border))] opacity-40 scale-95 z-0"
                style={{ transform: 'rotate(-6deg) translateY(-20px)' }}
              />

              {/* Middle Card */}
              <div 
                className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-border))] opacity-60 scale-95 z-10"
                style={{ transform: 'rotate(6deg) translateY(20px)' }}
              />

              {/* Front Card (Interactive Dashboard) */}
              <div className="absolute inset-0 bg-[hsl(var(--marketing-bg-subtle))] rounded-3xl border border-[hsl(var(--marketing-primary))/0.3] shadow-2xl z-20 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="h-14 border-b border-[hsl(var(--marketing-border))] flex items-center px-6 gap-4 bg-[hsl(var(--marketing-bg))]/50">
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 flex items-center gap-2 ${activeTab === index
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

                {/* Content Area - CSS transitions only */}
                <div className="flex-1 p-6 relative overflow-hidden">
                  {/* Tab 0: Orders */}
                  <div className={`absolute inset-6 transition-all duration-300 ${activeTab === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    <div className="space-y-4 h-full">
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
                      <div className="space-y-2">
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
                  </div>

                  {/* Tab 1: Revenue */}
                  <div className={`absolute inset-6 transition-all duration-300 ${activeTab === 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    <div className="space-y-4 h-full">
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
                      <div className="flex-1 rounded-xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))] flex items-end px-4 pb-4 gap-2 pt-8 h-40">
                        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-[hsl(var(--marketing-primary))] rounded-t-sm opacity-70"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Tab 2: Menus */}
                  <div className={`absolute inset-6 transition-all duration-300 ${activeTab === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    <div className="space-y-4 h-full flex flex-col">
                      <div className="text-center">
                        <div className="text-sm text-[hsl(var(--marketing-text-light))] mb-1">Disposable Menu Generated</div>
                        <div className="text-lg font-bold text-[hsl(var(--marketing-text))]">Expires in 24 hours</div>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <div className="relative p-6 rounded-2xl bg-white border-2 border-dashed border-gray-200">
                          <QrCode className="w-28 h-28 text-gray-800" />
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
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-[hsl(var(--marketing-border))] w-full">
                  <div 
                    className="h-full bg-[hsl(var(--marketing-primary))] transition-all duration-300"
                    style={{ 
                      width: '100%',
                      animation: 'progress 4s linear infinite',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* CSS animations */}
      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out 0.2s forwards;
          opacity: 0;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
