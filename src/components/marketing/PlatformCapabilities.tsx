import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { 
  Database, 
  Sparkles, 
  Store, 
  LineChart, 
  Key, 
  Navigation,
  type LucideIcon
} from 'lucide-react';
import { 
  InventoryDemo, 
  OrderAutomationDemo, 
  AnalyticsDemo, 
  CustomerPortalDemo, 
  DisposableMenuDemo, 
  FleetDemo 
} from './CapabilityDemos';

interface Capability {
  id: number;
  title: string;
  description: string;
  icon: LucideIcon;
  metrics: string;
  demo: React.ComponentType;
}

const capabilities: Capability[] = [
  {
    id: 1,
    title: 'Inventory Management',
    description: 'Real-time tracking across multiple locations with automated alerts',
    icon: Database,
    metrics: '99.9% accuracy',
    demo: InventoryDemo,
  },
  {
    id: 2,
    title: 'Order Automation',
    description: 'Streamlined order processing with automated workflows',
    icon: Sparkles,
    metrics: '15hrs/week saved',
    demo: OrderAutomationDemo,
  },
  {
    id: 3,
    title: 'Customer Portal',
    description: 'Self-service portal for customers to browse and order',
    icon: Store,
    metrics: '24/7 access',
    demo: CustomerPortalDemo,
  },
  {
    id: 4,
    title: 'Analytics & Reporting',
    description: 'Powerful insights into your business performance',
    icon: LineChart,
    metrics: 'Real-time data',
    demo: AnalyticsDemo,
  },
  {
    id: 5,
    title: 'Disposable Menus',
    description: 'Secure, encrypted menus for wholesale clients',
    icon: Key,
    metrics: '100% secure',
    demo: DisposableMenuDemo,
  },
  {
    id: 6,
    title: 'Fleet Management',
    description: 'Track deliveries, optimize routes, manage couriers',
    icon: Navigation,
    metrics: 'GPS tracking',
    demo: FleetDemo,
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
                    <div className="flex-shrink-0">
                      <capability.icon className="h-8 w-8 text-primary" />
                    </div>
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

            {/* Feature Preview Card */}
            <motion.div
              style={{ opacity, scale }}
              className="relative"
            >
              <motion.div
                key={activeCapability}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="glass-card p-8 rounded-2xl border border-border/50 relative overflow-hidden bg-gradient-to-br from-card to-card/50"
              >
                {/* Interactive Demo */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {capabilities[activeCapability].title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {capabilities[activeCapability].description}
                  </p>
                  
                  {/* Live Demo Component */}
                  <div className="mt-6 p-4 rounded-xl bg-background/50 border border-border">
                    {(() => {
                      const DemoComponent = capabilities[activeCapability].demo;
                      return <DemoComponent />;
                    })()}
                  </div>
                </div>

                {/* Subtle corner accent */}
                <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

