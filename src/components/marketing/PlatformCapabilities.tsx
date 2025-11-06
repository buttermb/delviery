import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Rotatable3DCard } from './Rotatable3DCard';

interface Capability {
  id: number;
  title: string;
  description: string;
  icon: string;
  metrics: string;
}

const capabilities: Capability[] = [
  {
    id: 1,
    title: 'Inventory Management',
    description: 'Real-time tracking across multiple locations with automated alerts',
    icon: '📦',
    metrics: '99.9% accuracy',
  },
  {
    id: 2,
    title: 'Order Automation',
    description: 'Streamlined order processing with automated workflows',
    icon: '⚡',
    metrics: '15hrs/week saved',
  },
  {
    id: 3,
    title: 'Customer Portal',
    description: 'Self-service portal for customers to browse and order',
    icon: '🛒',
    metrics: '24/7 access',
  },
  {
    id: 4,
    title: 'Analytics & Reporting',
    description: 'Powerful insights into your business performance',
    icon: '📊',
    metrics: 'Real-time data',
  },
  {
    id: 5,
    title: 'Disposable Menus',
    description: 'Secure, encrypted menus for wholesale clients',
    icon: '🔒',
    metrics: '100% secure',
  },
  {
    id: 6,
    title: 'Fleet Management',
    description: 'Track deliveries, optimize routes, manage couriers',
    icon: '🚚',
    metrics: 'GPS tracking',
  },
];

export function PlatformCapabilities() {
  const [activeCapability, setActiveCapability] = useState(0);
  const scrollRef = useRef<HTMLElement>(null);
  const { ref, inView } = useInView({
    threshold: 0.3,
    triggerOnce: false,
  });

  useEffect(() => {
    if (!inView) return;

    const interval = setInterval(() => {
      setActiveCapability((prev) => (prev + 1) % capabilities.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [inView]);

  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ['start end', 'end start'],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 0.3]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.9]);

  return (
    <section 
      className="py-20 bg-gradient-to-b from-background to-muted/30" 
      ref={(node) => {
        ref(node);
        (scrollRef as any).current = node;
      }}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Platform Capabilities
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to run your wholesale business
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Feature List */}
            <div className="space-y-4">
              {capabilities.map((capability, index) => (
                <motion.div
                  key={capability.id}
                  className={`glass-card p-6 rounded-xl cursor-pointer transition-all ${
                    activeCapability === index
                      ? 'border-2 border-[hsl(var(--marketing-primary))] shadow-lg'
                      : 'border border-border hover:border-[hsl(var(--marketing-primary))]/50'
                  }`}
                  onClick={() => setActiveCapability(index)}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl flex-shrink-0">{capability.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-foreground">{capability.title}</h3>
                        {activeCapability === index && (
                          <motion.div
                            className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-primary))]"
                            animate={{ scale: [1, 1.5, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                      </div>
                      <p className="text-muted-foreground mb-2">{capability.description}</p>
                      <span className="inline-block px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))]/10 text-sm font-medium text-[hsl(var(--marketing-primary))]">
                        {capability.metrics}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* 3D Rotatable Preview Card */}
            <Rotatable3DCard 
              activeCapability={activeCapability}
              capability={capabilities[activeCapability]}
              opacity={opacity}
              scale={scale}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

