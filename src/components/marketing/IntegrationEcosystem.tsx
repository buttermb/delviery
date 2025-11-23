import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, CheckCircle, ShoppingBag, Wallet, Target, CreditCard, MessageSquare, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreamlinedIntegrationHub } from './StreamlinedIntegrationHub';
import { FloatingUIElements } from './FloatingUIElements';

interface Integration {
  name: string;
  logo: LucideIcon;
  description: string;
  category: 'ecommerce' | 'accounting' | 'crm' | 'payment' | 'communication';
}

const integrations: Integration[] = [
  {
    name: 'Shopify',
    logo: ShoppingBag,
    description: 'Sync products & orders',
    category: 'ecommerce',
  },
  {
    name: 'QuickBooks',
    logo: Wallet,
    description: 'Financial sync',
    category: 'accounting',
  },
  {
    name: 'HubSpot',
    logo: Target,
    description: 'CRM integration',
    category: 'crm',
  },
  {
    name: 'Stripe',
    logo: CreditCard,
    description: 'Payment processing',
    category: 'payment',
  },
  {
    name: 'Twilio',
    logo: MessageSquare,
    description: 'SMS notifications',
    category: 'communication',
  },
];

export function IntegrationEcosystem() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  return (
    <section className="py-24 bg-gradient-to-b from-[hsl(var(--marketing-bg))] via-[hsl(var(--marketing-bg-subtle))] to-[hsl(var(--marketing-bg))] relative overflow-hidden">
      {/* Floating background elements */}
      <FloatingUIElements />
      
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--marketing-bg))] via-transparent to-[hsl(var(--marketing-bg))] opacity-30" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Streamlined Integration Hub
            </h2>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              Seamlessly integrate with your existing workflow
            </p>
          </motion.div>

          {/* Integration Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-12">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                className="glass-card p-6 rounded-xl text-center group cursor-pointer relative overflow-hidden bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-primary))]/50"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 20,
                  delay: index * 0.03,
                }}
                whileHover={{ y: -8, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedIntegration(integration)}
              >
                {/* Glow effect on hover */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--marketing-primary))]/20 to-[hsl(var(--marketing-accent))]/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={false}
                />

                <div className="relative z-10">
                  <motion.div
                    className="mb-3 flex justify-center"
                    whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="w-16 h-16 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center">
                      <integration.logo className="h-8 w-8 text-[hsl(var(--marketing-primary))]" />
                    </div>
                  </motion.div>
                  <h3 className="font-semibold text-[hsl(var(--marketing-text))] mb-1">{integration.name}</h3>
                  <p className="text-xs text-[hsl(var(--marketing-text-light))] mb-3">{integration.description}</p>

                  {/* Connection Status Badge */}
                  <motion.div
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] text-xs font-medium opacity-0 group-hover:opacity-100"
                    initial={false}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-primary))] animate-pulse" />
                    Available
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Enhanced Integration Hub */}
          <motion.div
            className="glass-card p-8 rounded-xl relative overflow-hidden bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-[hsl(var(--marketing-text))] mb-2">
                Unified Integration Network
              </h3>
              <p className="text-[hsl(var(--marketing-text-light))]">
                Connect your tools with FloraIQ's powerful integration hub
              </p>
            </div>

            <StreamlinedIntegrationHub integrations={integrations} />
          </motion.div>

          {/* Request Integration */}
          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p className="text-[hsl(var(--marketing-text-light))] mb-4">
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
                  className="fixed inset-0 bg-[hsl(var(--marketing-bg))]/80 backdrop-blur-sm z-50"
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
                    className="glass-card p-8 rounded-2xl max-w-md w-full border border-[hsl(var(--marketing-border))] shadow-2xl bg-[hsl(var(--marketing-bg-subtle))]"
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center">
                          <selectedIntegration.logo className="h-8 w-8 text-[hsl(var(--marketing-primary))]" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-[hsl(var(--marketing-text))]">{selectedIntegration.name}</h3>
                          <p className="text-sm text-[hsl(var(--marketing-text-light))]">{selectedIntegration.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedIntegration(null)}
                        className="text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))]"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                        <span className="text-[hsl(var(--marketing-text))]">Two-way data sync</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                        <span className="text-[hsl(var(--marketing-text))]">Real-time updates</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                        <span className="text-[hsl(var(--marketing-text))]">Automated workflows</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button className="flex-1 bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white">
                        Connect Now
                      </Button>
                      <Button variant="outline" className="flex-1 border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-bg))]">
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

