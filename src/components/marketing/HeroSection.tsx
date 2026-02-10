import { Link } from "react-router-dom";
import { motion, useTransform } from "framer-motion";
import { Play } from "lucide-react";
import { CheckCircle as CheckCircleIcon } from "@phosphor-icons/react";
import { useInView } from "react-intersection-observer";
import { AnimatedIcon } from "./AnimatedIcon";
import { TypewriterHeadline } from "./TypewriterHeadline";
import { ScrollIndicator } from "./ScrollIndicator";
import { FancyButton } from "./FancyButton";
import { TrustBadgesCluster } from "./TrustBadgesCluster";
import { useThrottledScroll } from "@/hooks/useThrottledScroll";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { lazy, Suspense, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

// Lazy load heavy animation components
const BackgroundMesh = lazy(() => import('./BackgroundMesh').then(m => ({ default: m.BackgroundMesh })));
const FloatingUIElements = lazy(() => import('./FloatingUIElements').then(m => ({ default: m.FloatingUIElements })));
const ParallaxBackground = lazy(() => import('./ParallaxBackground').then(m => ({ default: m.ParallaxBackground })));

export function HeroSection() {
  usePerformanceMonitor('HeroSection');
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = inView && !prefersReducedMotion;
  const [_shouldAnimateChart, setShouldAnimateChart] = useState(false);

  // Auth state for conditional CTAs
  const { user } = useAuth();
  const { isTrial } = useSubscriptionStatus();

  // Use throttled scroll for better performance
  const { scrollY } = useThrottledScroll(32);
  const y1 = useTransform(scrollY, [0, 500], [0, 100]);
  const y2 = useTransform(scrollY, [0, 500], [0, 70]);
  const y3 = useTransform(scrollY, [0, 500], [0, 40]);
  const opacity = useTransform(scrollY, [200, 600], [1, 0.3]);

  // Defer chart animation
  useEffect(() => {
    const timer = setTimeout(() => setShouldAnimateChart(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const benefits = [
    "Manage orders.",
    "Track inventory.",
    "Automate reports.",
    "Encrypt your data.",
  ];

  return (
    <section ref={ref} className="hero-gradient text-white py-20 md:py-32 relative overflow-x-hidden min-h-dvh flex items-center">
      {/* Conditionally render heavy animations - desktop only when in view */}
      {!isMobile && shouldAnimate && (
        <Suspense fallback={null}>
          <BackgroundMesh />
          <FloatingUIElements />
        </Suspense>
      )}

      {/* Parallax background - desktop only, respect motion preferences */}
      {!isMobile && !prefersReducedMotion && (
        <Suspense fallback={null}>
          <ParallaxBackground />
        </Suspense>
      )}

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* 3D Parallax Layers */}
          <motion.div
            style={{ y: y1, opacity }}
            className="mb-6"
          >
            <h1 className="text-4xl md:text-7xl font-bold leading-tight">
              The Modern CRM for<br />
              <span className="text-white">
                Cannabis Distributors
              </span>
            </h1>
          </motion.div>

          <motion.div
            style={{ y: y2, opacity }}
            className="mb-8"
          >
            <p className="text-xl md:text-2xl mb-4 text-white/90 max-w-3xl mx-auto">
              Manage customers, products, orders, and inventory in one powerful platform
            </p>

            {/* Typewriter Effect */}
            <div className="text-xl md:text-2xl font-semibold text-white min-h-[2rem] mb-4">
              <TypewriterHeadline benefits={benefits} />
            </div>
          </motion.div>

          <motion.div
            style={{ y: y3, opacity }}
            className="flex flex-wrap justify-center gap-4 mb-8 text-sm md:text-base"
          >
            <div className="flex items-center gap-2">
              <AnimatedIcon animation="glow" hover size={20} color="currentColor">
                <CheckCircleIcon weight="fill" className="h-5 w-5" />
              </AnimatedIcon>
              <span>AES-256 Encrypted Menus</span>
            </div>
            <div className="flex items-center gap-2">
              <AnimatedIcon animation="glow" hover size={20} color="currentColor">
                <CheckCircleIcon weight="fill" className="h-5 w-5" />
              </AnimatedIcon>
              <span>Real-time Inventory Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <AnimatedIcon animation="glow" hover size={20} color="currentColor">
                <CheckCircleIcon weight="fill" className="h-5 w-5" />
              </AnimatedIcon>
              <span>Order Management & Automation</span>
            </div>
            <div className="flex items-center gap-2">
              <AnimatedIcon animation="glow" hover size={20} color="currentColor">
                <CheckCircleIcon weight="fill" className="h-5 w-5" />
              </AnimatedIcon>
              <span>Customer Portal Included</span>
            </div>
          </motion.div>

          <motion.div
            style={{ y: y3, opacity }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
          >
            {!user ? (
              // Not logged in - show signup CTA
              <>
                <div className="flex flex-col items-center">
                  <Link to="/signup">
                    <FancyButton
                      variant="primary"
                      size="lg"
                      magnetic
                      glow
                      className="w-full sm:w-auto"
                    >
                      Start Free Trial
                    </FancyButton>
                  </Link>
                  <p className="text-xs text-white/70 mt-2">No credit card required • Cancel anytime</p>
                </div>
                <Link to="/demo">
                  <FancyButton
                    variant="outline"
                    size="lg"
                    magnetic
                    className="w-full sm:w-auto"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Schedule Demo
                  </FancyButton>
                </Link>
              </>
            ) : isTrial ? (
              // On trial - show complete setup
              <div className="flex flex-col items-center">
                <Link to="/saas/select-plan">
                  <FancyButton
                    variant="primary"
                    size="lg"
                    magnetic
                    glow
                    className="w-full sm:w-auto"
                  >
                    Complete Trial Setup
                  </FancyButton>
                </Link>
                <p className="text-xs text-white/70 mt-2">Add payment method to continue after trial</p>
              </div>
            ) : (
              // Active subscription - show dashboard link
              <Link to="/saas/dashboard">
                <FancyButton
                  variant="primary"
                  size="lg"
                  magnetic
                  glow
                  className="w-full sm:w-auto"
                >
                  Go to Dashboard
                </FancyButton>
              </Link>
            )}
          </motion.div>

          <motion.div
            style={{ opacity }}
            className="mb-8"
          >
            <p className="text-sm text-white/80 mb-4">
              Trusted by 400+ cannabis distributors • $1.4M orders/month
            </p>

            {/* Client Logos Placeholder - Add actual logos here */}
            <div className="flex flex-wrap justify-center items-center gap-6 mb-8 opacity-60">
              <div className="text-xs text-white/60">Client Logos Coming Soon</div>
            </div>

            {/* Trust Badges */}
            <div className="mb-12">
              <TrustBadgesCluster />
            </div>
          </motion.div>

        </div>
      </div>

      {/* Scroll Indicator */}
      <ScrollIndicator />
    </section>
  );
}

