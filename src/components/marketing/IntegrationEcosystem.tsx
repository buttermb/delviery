import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, CheckCircle, ShoppingBag, Wallet, Target, CreditCard, MessageSquare, Zap, ArrowRight, Sparkles, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Integration {
  name: string;
  logo: LucideIcon;
  description: string;
  category: 'ecommerce' | 'accounting' | 'crm' | 'payment' | 'communication';
  color: string;
}

const integrations: Integration[] = [
  {
    name: 'Shopify',
    logo: ShoppingBag,
    description: 'Sync products & orders seamlessly',
    category: 'ecommerce',
    color: 'from-green-500 to-emerald-600',
  },
  {
    name: 'QuickBooks',
    logo: Wallet,
    description: 'Real-time financial sync',
    category: 'accounting',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    name: 'HubSpot',
    logo: Target,
    description: 'CRM & marketing automation',
    category: 'crm',
    color: 'from-orange-500 to-red-600',
  },
  {
    name: 'Stripe',
    logo: CreditCard,
    description: 'Secure payment processing',
    category: 'payment',
    color: 'from-purple-500 to-violet-600',
  },
  {
    name: 'Twilio',
    logo: MessageSquare,
    description: 'SMS & voice notifications',
    category: 'communication',
    color: 'from-red-500 to-pink-600',
  },
];

export function IntegrationEcosystem() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-24 bg-[#050505] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-12 md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-white/60 mb-6 backdrop-blur-sm uppercase tracking-widest"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              One-Click Connect
            </motion.div>

            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Streamlined</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Integration Hub</span>
            </h2>
            <p className="text-base md:text-lg text-white/40 max-w-xl mx-auto font-light">
              Seamlessly integrate with your existing workflow in minutes, not days.
            </p>
          </motion.div>

          {/* Mobile-First Integration Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 mb-12">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                onHoverStart={() => setHoveredIndex(index)}
                onHoverEnd={() => setHoveredIndex(null)}
                onClick={() => setSelectedIntegration(integration)}
                className="relative group cursor-pointer"
              >
                <motion.div
                  className="relative p-4 md:p-6 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden transition-all duration-300 hover:border-white/20"
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${integration.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

                  {/* Pulse ring on hover */}
                  <motion.div
                    className={`absolute inset-0 rounded-2xl border-2 border-transparent ${hoveredIndex === index ? 'border-white/20' : ''}`}
                    animate={hoveredIndex === index ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  />

                  <div className="relative z-10 flex flex-col items-center text-center">
                    {/* Icon Container */}
                    <motion.div
                      className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center mb-3 shadow-lg`}
                      whileHover={{ rotate: [0, -5, 5, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      <integration.logo className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </motion.div>

                    {/* Name */}
                    <h3 className="font-semibold text-white text-sm md:text-base mb-1">{integration.name}</h3>

                    {/* Description - Hidden on mobile, shown on hover for desktop */}
                    <p className="text-[10px] md:text-xs text-white/40 line-clamp-2 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
                      {integration.description}
                    </p>

                    {/* Status Badge */}
                    <motion.div
                      className="mt-2 md:mt-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ready
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Central Hub Visualization */}
          <motion.div
            className="relative py-8 md:py-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none hidden md:block" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(16, 185, 129, 0)" />
                  <stop offset="50%" stopColor="rgba(16, 185, 129, 0.3)" />
                  <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                </linearGradient>
              </defs>
              <motion.line
                x1="0%" y1="50%" x2="100%" y2="50%"
                stroke="url(#lineGradient)"
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                transition={{ duration: 1.5 }}
              />
            </svg>

            {/* Central Hub */}
            <div className="flex justify-center">
              <motion.div
                className="relative"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
              >
                {/* Outer ring pulse */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 blur-xl opacity-30"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />

                {/* Hub circle */}
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                  <div className="absolute inset-1 rounded-full bg-[#0a0a0a] flex items-center justify-center">
                    <div className="text-center">
                      <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-emerald-400 mx-auto mb-1" />
                      <span className="text-[10px] md:text-xs font-bold text-white/80">FloraIQ</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Stats Row */}
            <div className="flex justify-center gap-8 md:gap-16 mt-8">
              {[
                { label: 'Integrations', value: '50+' },
                { label: 'Setup Time', value: '<5 min' },
                { label: 'Uptime', value: '99.9%' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <div className="text-xl md:text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-[10px] md:text-xs text-white/40 uppercase tracking-wider">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Request Integration CTA */}
          <motion.div
            className="text-center mt-8 md:mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p className="text-white/40 text-sm mb-4">
              Don't see your integration?
            </p>
            <Button
              variant="outline"
              className="border-white/10 text-white/80 hover:bg-white/5 hover:text-white hover:border-white/20 group"
            >
              Request Integration
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          {/* Integration Modal */}
          <AnimatePresence>
            {selectedIntegration && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedIntegration(null)}
                />

                {/* Modal */}
                <motion.div
                  className="fixed inset-0 flex items-end md:items-center justify-center z-50 p-0 md:p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="w-full md:max-w-md bg-[#0f1115] rounded-t-3xl md:rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Mobile drag handle */}
                    <div className="md:hidden flex justify-center pt-3 pb-2">
                      <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>

                    <div className="p-6 md:p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br ${selectedIntegration.color} flex items-center justify-center shadow-lg`}>
                            <selectedIntegration.logo className="w-7 h-7 md:w-8 md:h-8 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl md:text-2xl font-bold text-white">{selectedIntegration.name}</h3>
                            <p className="text-sm text-white/50">{selectedIntegration.description}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedIntegration(null)}
                          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="space-y-3 mb-6">
                        {[
                          'Two-way data sync',
                          'Real-time updates',
                          'Automated workflows',
                          'Secure OAuth connection',
                        ].map((feature, i) => (
                          <motion.div
                            key={feature}
                            className="flex items-center gap-3 text-sm"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                          >
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <CheckCircle className="h-3 w-3 text-emerald-400" />
                            </div>
                            <span className="text-white/80">{feature}</span>
                          </motion.div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium h-12">
                          <Zap className="w-4 h-4 mr-2" />
                          Connect Now
                        </Button>
                        <Button variant="outline" className="flex-1 border-white/10 text-white/80 hover:bg-white/5 h-12">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Documentation
                        </Button>
                      </div>
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
