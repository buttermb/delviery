import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { 
  TrendingUp, 
  Package, 
  Users, 
  DollarSign,
  ArrowRight,
  Play,
  Pause,
} from 'lucide-react';

interface Stat {
  id: string;
  label: string;
  value: string;
  trend: string;
  icon: React.ElementType;
}

const stats: Stat[] = [
  {
    id: 'orders',
    label: 'Orders Today',
    value: '1,247',
    trend: '+23%',
    icon: TrendingUp,
  },
  {
    id: 'inventory',
    label: 'Products',
    value: '2,843',
    trend: 'Active',
    icon: Package,
  },
  {
    id: 'customers',
    label: 'Active Customers',
    value: '456',
    trend: '+12%',
    icon: Users,
  },
  {
    id: 'revenue',
    label: 'Monthly Revenue',
    value: '$124K',
    trend: '+18%',
    icon: DollarSign,
  },
];

interface FeatureSpotlight {
  id: string;
  title: string;
  description: string;
  position: { top: string; left: string };
}

const spotlights: FeatureSpotlight[] = [
  {
    id: 'inventory',
    title: 'Real-Time Inventory',
    description: 'Watch stock levels update instantly across all locations',
    position: { top: '20%', left: '15%' },
  },
  {
    id: 'orders',
    title: 'Order Management',
    description: 'Streamlined workflow for processing orders',
    position: { top: '45%', left: '60%' },
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    description: 'Powerful insights into your business performance',
    position: { top: '70%', left: '25%' },
  },
];

export function InteractiveDashboardShowcase() {
  const [activeSpotlight, setActiveSpotlight] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [animatedStats, setAnimatedStats] = useState<Record<string, number>>({
    orders: 0,
    inventory: 0,
    customers: 0,
    revenue: 0,
  });

  const { ref, inView } = useInView({
    threshold: 0.3,
    triggerOnce: false,
  });

  // Auto-tour through spotlights
  useEffect(() => {
    if (!inView || !isAutoPlaying) return;

    const interval = setInterval(() => {
      setActiveSpotlight((prev) => (prev + 1) % spotlights.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [inView, isAutoPlaying]);

  // Animate stats
  useEffect(() => {
    if (!inView) return;

    const intervals = stats.map((stat) => {
      const targetValue = parseInt(stat.value.replace(/[^0-9]/g, '')) || 0;
      const duration = 2000;
      const steps = 60;
      const increment = targetValue / steps;
      let current = 0;

      return setInterval(() => {
        current += increment;
        if (current >= targetValue) {
          setAnimatedStats((prev) => ({ ...prev, [stat.id]: targetValue }));
        } else {
          setAnimatedStats((prev) => ({ ...prev, [stat.id]: Math.floor(current) }));
        }
      }, duration / steps);
    });

    return () => intervals.forEach(clearInterval);
  }, [inView]);

  const formatStatValue = (stat: Stat, value: number) => {
    if (stat.id === 'revenue') {
      return `$${value.toLocaleString()}K`;
    }
    return value.toLocaleString();
  };

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/30" ref={ref}>
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              See Your Dashboard in Action
            </h2>
            <p className="text-xl text-muted-foreground">
              Real-time insights at your fingertips
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Dashboard Preview */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="glass-card p-6 rounded-xl border border-border relative overflow-hidden">
                {/* Dashboard Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Dashboard Overview</h3>
                    <p className="text-sm text-muted-foreground">Real-time updates</p>
                  </div>
                  <button
                    onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    aria-label={isAutoPlaying ? 'Pause tour' : 'Play tour'}
                  >
                    {isAutoPlaying ? (
                      <Pause className="h-5 w-5 text-foreground" />
                    ) : (
                      <Play className="h-5 w-5 text-foreground" />
                    )}
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {stats.map((stat) => {
                    const Icon = stat.icon;
                    const value = animatedStats[stat.id] || 0;
                    return (
                      <motion.div
                        key={stat.id}
                        className="glass-card p-4 rounded-lg"
                        whileHover={{ scale: 1.05, y: -2 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
                          <span className="text-xs text-emerald-500 font-medium">
                            {stat.trend}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-foreground mb-1">
                          {formatStatValue(stat, value)}
                        </div>
                        <div className="text-sm text-muted-foreground">{stat.label}</div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Dashboard Preview Area */}
                <div className="aspect-video rounded-lg bg-gradient-to-br from-[hsl(var(--marketing-primary))]/10 to-[hsl(var(--marketing-accent))]/10 border border-border relative overflow-hidden">
                  {/* Feature Spotlights */}
                  <AnimatePresence>
                    {spotlights.map((spotlight, index) => (
                      activeSpotlight === index && (
                        <motion.div
                          key={spotlight.id}
                          className="absolute z-10"
                          style={spotlight.position}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="glass-card p-4 rounded-lg border-2 border-[hsl(var(--marketing-primary))] shadow-lg max-w-xs">
                            <h4 className="font-bold text-foreground mb-1">{spotlight.title}</h4>
                            <p className="text-sm text-muted-foreground">{spotlight.description}</p>
                          </div>
                          <motion.div
                            className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-[hsl(var(--marketing-primary))]"
                            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        </motion.div>
                      )
                    ))}
                  </AnimatePresence>

                  {/* Dashboard Content Placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="h-16 w-16 text-[hsl(var(--marketing-primary))]/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">Interactive Dashboard Preview</p>
                    </div>
                  </div>
                </div>

                {/* Spotlight Indicators */}
                <div className="flex justify-center gap-2 mt-6">
                  {spotlights.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setActiveSpotlight(index);
                        setIsAutoPlaying(false);
                      }}
                      className={`h-2 rounded-full transition-all ${
                        activeSpotlight === index
                          ? 'w-8 bg-[hsl(var(--marketing-primary))]'
                          : 'w-2 bg-muted-foreground/30'
                      }`}
                      aria-label={`Go to spotlight ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Feature Highlights */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Everything You Need to Succeed
                </h3>
                <p className="text-muted-foreground mb-6">
                  Our dashboard provides real-time insights, automated workflows, and powerful
                  analytics to help you grow your wholesale business.
                </p>
              </motion.div>

              {spotlights.map((spotlight, index) => (
                <motion.div
                  key={spotlight.id}
                  className={`glass-card p-6 rounded-xl border transition-all cursor-pointer ${
                    activeSpotlight === index
                      ? 'border-[hsl(var(--marketing-primary))] shadow-lg'
                      : 'border-border hover:border-[hsl(var(--marketing-primary))]/50'
                  }`}
                  onClick={() => {
                    setActiveSpotlight(index);
                    setIsAutoPlaying(false);
                  }}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-foreground mb-2">
                        {spotlight.title}
                      </h4>
                      <p className="text-muted-foreground">{spotlight.description}</p>
                    </div>
                    {activeSpotlight === index && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      >
                        <div className="w-3 h-3 rounded-full bg-[hsl(var(--marketing-primary))]" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}

              <motion.div
                className="mt-8"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <button className="flex items-center gap-2 text-[hsl(var(--marketing-primary))] hover:gap-3 transition-all font-medium">
                  Explore Full Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

