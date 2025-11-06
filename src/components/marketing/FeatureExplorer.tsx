import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package,
  Zap,
  Users,
  BarChart3,
  Lock,
  Truck,
} from 'lucide-react';
import { AnimatedIcon } from './AnimatedIcon';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  benefits: string[];
  metrics: {
    label: string;
    value: string;
  }[];
}

const features: Feature[] = [
  {
    id: 'inventory',
    title: 'Inventory Management',
    description: 'Real-time tracking across multiple locations with automated alerts and movements',
    icon: Package,
    benefits: [
      'Multi-location support',
      'Automated low-stock alerts',
      'Real-time updates',
      'Movement tracking',
    ],
    metrics: [
      { label: 'Accuracy', value: '99.9%' },
      { label: 'Time Saved', value: '10hrs/week' },
    ],
  },
  {
    id: 'automation',
    title: 'Order Automation',
    description: 'Streamlined workflows that save hours every week with automated order processing',
    icon: Zap,
    benefits: [
      'Auto-confirmations',
      'Email notifications',
      'Status updates',
      'Workflow automation',
    ],
    metrics: [
      { label: 'Efficiency', value: '+75%' },
      { label: 'Time Saved', value: '15hrs/week' },
    ],
  },
  {
    id: 'portal',
    title: 'Customer Portal',
    description: 'Self-service portal where customers can browse products and place orders 24/7',
    icon: Users,
    benefits: [
      '24/7 availability',
      'Mobile responsive',
      'Order history',
      'Account management',
    ],
    metrics: [
      { label: 'Uptime', value: '99.99%' },
      { label: 'Satisfaction', value: '4.9/5' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Reporting',
    description: 'Powerful insights into sales, inventory, and customer behavior with real-time dashboards',
    icon: BarChart3,
    benefits: [
      'Real-time dashboards',
      'Custom reports',
      'Sales analytics',
      'Inventory insights',
    ],
    metrics: [
      { label: 'Data Points', value: '1000+' },
      { label: 'Update Rate', value: 'Real-time' },
    ],
  },
  {
    id: 'menus',
    title: 'Disposable Menus',
    description: 'Secure, encrypted menus for wholesale clients with expiration and access controls',
    icon: Lock,
    benefits: [
      'End-to-end encryption',
      'Auto-expiration',
      'Access tracking',
      'QR code sharing',
    ],
    metrics: [
      { label: 'Security', value: '256-bit' },
      { label: 'Menus Created', value: '10K+' },
    ],
  },
  {
    id: 'fleet',
    title: 'Fleet Management',
    description: 'Track deliveries, optimize routes, and manage your courier fleet with GPS integration',
    icon: Truck,
    benefits: [
      'GPS tracking',
      'Route optimization',
      'Delivery updates',
      'Earnings tracking',
    ],
    metrics: [
      { label: 'On-Time', value: '98%' },
      { label: 'Routes Optimized', value: 'Daily' },
    ],
  },
];

export function FeatureExplorer() {
  const [activeTab, setActiveTab] = useState('inventory');

  const activeFeature = features.find((f) => f.id === activeTab) || features[0];

  return (
    <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Explore Our Features
            </h2>
            <p className="text-xl text-muted-foreground">
              Powerful tools designed for wholesale distributors
            </p>
          </motion.div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.id}
                  onClick={() => setActiveTab(feature.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    activeTab === feature.id
                      ? 'bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] text-white shadow-lg'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{feature.title}</span>
                </button>
              );
            })}
          </div>

          {/* Feature Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="glass-card p-8 rounded-xl border border-border">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left: Details */}
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center">
                        <AnimatedIcon animation="morph" hover size={32} color="white">
                          <activeFeature.icon className="h-8 w-8 text-white" />
                        </AnimatedIcon>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-foreground mb-1">
                          {activeFeature.title}
                        </h3>
                        <p className="text-muted-foreground">{activeFeature.description}</p>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-3 mb-6">
                      <h4 className="font-semibold text-foreground">Key Benefits:</h4>
                      {activeFeature.benefits.map((benefit, index) => (
                        <motion.div
                          key={index}
                          className="flex items-center gap-3"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-primary))]" />
                          <span className="text-foreground">{benefit}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Metrics & Preview */}
                  <div>
                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {activeFeature.metrics.map((metric, index) => (
                        <motion.div
                          key={index}
                          className="glass-card p-4 rounded-lg text-center"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="text-2xl font-bold text-[hsl(var(--marketing-primary))] mb-1">
                            {metric.value}
                          </div>
                          <div className="text-sm text-muted-foreground">{metric.label}</div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Preview Placeholder */}
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-[hsl(var(--marketing-primary))]/10 to-[hsl(var(--marketing-accent))]/10 border border-border flex items-center justify-center">
                      <div className="text-center">
                        <AnimatedIcon animation="glow" size={48} color="hsl(var(--marketing-primary))">
                          <activeFeature.icon className="h-12 w-12 text-[hsl(var(--marketing-primary))]" />
                        </AnimatedIcon>
                        <p className="text-sm text-muted-foreground mt-2">Feature Preview</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

