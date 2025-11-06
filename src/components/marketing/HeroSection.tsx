import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Play } from "lucide-react";
import { CheckCircle as CheckCircleIcon } from "@phosphor-icons/react";
import { AnimatedIcon } from "./AnimatedIcon";
import { BackgroundMesh } from "./BackgroundMesh";
import { FloatingUIElements } from "./FloatingUIElements";
import { TypewriterHeadline } from "./TypewriterHeadline";
import { ScrollIndicator } from "./ScrollIndicator";
import { FancyButton } from "./FancyButton";
import { TrustBadgesCluster } from "./TrustBadgesCluster";

export function HeroSection() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 100]);
  const y2 = useTransform(scrollY, [0, 500], [0, 70]);
  const y3 = useTransform(scrollY, [0, 500], [0, 40]);
  const opacity = useTransform(scrollY, [200, 600], [1, 0.3]);

  const benefits = [
    "Manage orders.",
    "Track inventory.",
    "Automate reports.",
    "Encrypt your data.",
  ];

  return (
    <section className="hero-gradient text-white py-20 md:py-32 relative overflow-hidden min-h-screen flex items-center">
      {/* Animated Background Mesh */}
      <BackgroundMesh />
      
      {/* Floating UI Elements */}
      <FloatingUIElements />

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
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              The Modern CRM for<br />
              <span className="gradient-text-primary bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/70">
                Wholesale Distributors
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
              <span>Disposable Encrypted Menus</span>
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
          </motion.div>

          <motion.div
            style={{ opacity }}
            className="mb-8"
          >
            <p className="text-sm text-white/80 mb-8">
              Trusted by 400+ distributors • $1.4M orders/month
            </p>

            {/* Trust Badges */}
            <div className="mb-12">
              <TrustBadgesCluster />
            </div>
          </motion.div>

          {/* Dashboard Preview with 3D Parallax */}
          <motion.div
            style={{ y: y2, opacity }}
            className="mt-12 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-gradient-to-br from-white to-gray-100"
          >
            <div className="p-8">
              <div className="space-y-4">
                {/* Mock Dashboard Header */}
                <div className="flex items-center justify-between pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500" />
                    <div>
                      <div className="h-3 w-32 bg-gray-300 rounded mb-2" />
                      <div className="h-2 w-24 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-20 bg-emerald-500 rounded" />
                    <div className="h-8 w-20 bg-gray-200 rounded" />
                  </div>
                </div>
                {/* Mock Stats Cards */}
                <div className="grid grid-cols-4 gap-4 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 bg-white rounded-lg shadow">
                      <div className="h-2 w-16 bg-gray-200 rounded mb-3" />
                      <div className="h-6 w-20 bg-emerald-500/20 rounded" />
                    </div>
                  ))}
                </div>
                {/* Mock Chart */}
                <div className="p-6 bg-white rounded-lg shadow">
                  <div className="h-3 w-32 bg-gray-300 rounded mb-4" />
                  <div className="flex items-end gap-2 h-32">
                    {[40, 70, 50, 80, 60, 90, 75, 85].map((height, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t"
                        style={{ height: `${height}%` }}
                        animate={{
                          height: [`${height}%`, `${height + 10}%`, `${height}%`],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <ScrollIndicator />
    </section>
  );
}

