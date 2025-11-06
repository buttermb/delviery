import { motion } from 'framer-motion';
import { Link2 } from 'lucide-react';

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
                className="glass-card p-6 rounded-xl text-center group cursor-pointer hover:scale-105 transition-all"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className="text-4xl mb-3">{integration.logo}</div>
                <h3 className="font-semibold text-foreground mb-1">{integration.name}</h3>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
                <motion.div
                  className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={false}
                >
                  <Link2 className="h-4 w-4 text-[hsl(var(--marketing-primary))] mx-auto" />
                </motion.div>
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
              <div className="absolute z-10 w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center text-white font-bold shadow-lg">
                DevPanel
              </div>

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
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl shadow-md">
                      {integration.logo}
                    </div>
                    {/* Connection Line */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ width: radius * 2, height: radius * 2, left: -radius, top: -radius }}
                    >
                      <motion.line
                        x1={radius}
                        y1={radius}
                        x2={radius + x}
                        y2={radius + y}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        className="text-muted-foreground/30"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.2 + 0.5, duration: 0.5 }}
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
        </div>
      </div>
    </section>
  );
}

