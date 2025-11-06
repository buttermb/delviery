import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, X, ExternalLink, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Integration {
  name: string;
  logo: string;
  description: string;
  category: 'ecommerce' | 'accounting' | 'crm' | 'payment' | 'communication';
}

const integrations: Integration[] = [
  {
    name: 'Shopify',
    logo: '🛍️',
    description: 'Sync products & orders',
    category: 'ecommerce',
  },
  {
    name: 'QuickBooks',
    logo: '📊',
    description: 'Financial sync',
    category: 'accounting',
  },
  {
    name: 'HubSpot',
    logo: '🎯',
    description: 'CRM integration',
    category: 'crm',
  },
  {
    name: 'Stripe',
    logo: '💳',
    description: 'Payment processing',
    category: 'payment',
  },
  {
    name: 'Twilio',
    logo: '📱',
    description: 'SMS notifications',
    category: 'communication',
  },
];

export function IntegrationEcosystem() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  return (
    <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Works with Your Tools
            </h2>
            <p className="text-xl text-muted-foreground">
              Seamlessly integrate with your existing workflow
            </p>
          </motion.div>

          {/* Integration Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-12">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                className="glass-card p-6 rounded-xl text-center group cursor-pointer relative overflow-hidden border border-border hover:border-primary/50"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -8, scale: 1.05 }}
                onClick={() => setSelectedIntegration(integration)}
              >
                {/* Glow effect on hover */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={false}
                />
                
                <div className="relative z-10">
                  <motion.div 
                    className="text-4xl mb-3"
                    whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    {integration.logo}
                  </motion.div>
                  <h3 className="font-semibold text-foreground mb-1">{integration.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{integration.description}</p>
                  
                  {/* Connection Status Badge */}
                  <motion.div
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium opacity-0 group-hover:opacity-100"
                    initial={false}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Available
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Connection Diagram */}
          <motion.div
            className="glass-card p-8 rounded-xl relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-foreground mb-2">
                Centralized Integration Hub
              </h3>
              <p className="text-muted-foreground">
                DevPanel connects all your tools in one place
              </p>
            </div>

            {/* Visual Connection Flow */}
            <div className="relative h-32 flex items-center justify-center">
              {/* Center DevPanel */}
              <motion.div 
                className="absolute z-10 w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center text-white font-bold shadow-lg"
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(var(--marketing-primary-rgb), 0.5)',
                    '0 0 40px rgba(var(--marketing-primary-rgb), 0.8)',
                    '0 0 20px rgba(var(--marketing-primary-rgb), 0.5)',
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                DevPanel
              </motion.div>

              {/* Connected Tools */}
              {integrations.slice(0, 4).map((integration, index) => {
                const angle = (index * 90) * (Math.PI / 180);
                const radius = 80;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <motion.div
                    key={integration.name}
                    className="absolute"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.2 }}
                  >
                    <motion.div 
                      className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl shadow-md"
                      whileHover={{ scale: 1.2, rotate: 5 }}
                    >
                      {integration.logo}
                    </motion.div>
                    {/* Animated Connection Line with Pulsing Dots */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ width: radius * 2, height: radius * 2, left: -radius, top: -radius }}
                    >
                      <defs>
                        <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="hsl(var(--marketing-accent))" stopOpacity="0.5" />
                        </linearGradient>
                      </defs>
                      <motion.line
                        x1={radius}
                        y1={radius}
                        x2={radius + x}
                        y2={radius + y}
                        stroke={`url(#gradient-${index})`}
                        strokeWidth="2"
                        initial={{ pathLength: 0, opacity: 0 }}
                        whileInView={{ pathLength: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.2 + 0.5, duration: 0.8 }}
                      />
                      {/* Pulsing dot traveling along line */}
                      <motion.circle
                        cx={radius}
                        cy={radius}
                        r="3"
                        fill="hsl(var(--marketing-accent))"
                        animate={{
                          cx: [radius, radius + x],
                          cy: [radius, radius + y],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: index * 0.5,
                          ease: "linear"
                        }}
                      />
                    </svg>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Request Integration */}
          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p className="text-muted-foreground mb-4">
              Don't see your integration? We can add it.
            </p>
            <button className="text-[hsl(var(--marketing-primary))] hover:underline font-medium">
              Request Integration →
            </button>
          </motion.div>

          {/* Integration Modal */}
          <AnimatePresence>
            {selectedIntegration && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedIntegration(null)}
                />
                
                {/* Modal */}
                <motion.div
                  className="fixed inset-0 flex items-center justify-center z-50 p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="glass-card p-8 rounded-2xl max-w-md w-full border border-border shadow-2xl"
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="text-5xl">{selectedIntegration.logo}</div>
                        <div>
                          <h3 className="text-2xl font-bold text-foreground">{selectedIntegration.name}</h3>
                          <p className="text-sm text-muted-foreground">{selectedIntegration.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedIntegration(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-foreground">Two-way data sync</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-foreground">Real-time updates</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-foreground">Automated workflows</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                        Connect Now
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Learn More
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

