/**
 * Refined "Why Us" Section
 * Elegant, minimalist benefits display
 */

import { motion } from 'framer-motion';
import { Clock, Shield, Lock, Star } from 'lucide-react';

const features = [
  {
    icon: Clock,
    title: 'Same-Day Delivery',
    description: 'Order before 9 PM for delivery within the hour. Real-time tracking included.',
  },
  {
    icon: Shield,
    title: 'Lab Verified',
    description: 'Every strain tested for purity, potency, and quality. Certificates available.',
  },
  {
    icon: Lock,
    title: 'Discreet Service',
    description: 'Unmarked packaging. Professional couriers. Your privacy is our priority.',
  },
  {
    icon: Star,
    title: 'Premium Selection',
    description: 'Hand-picked strains. Indoor cultivation. Top-shelf quality guaranteed.',
  },
];

export function WhyUs() {
  return (
    <section className="py-24 md:py-32 bg-neutral-900">
      <div className="container mx-auto px-6 max-w-7xl">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16 md:mb-20"
        >
          <div className="text-sm text-emerald-400 font-light tracking-widest uppercase mb-4">
            The Difference
          </div>
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-light text-white mb-6 tracking-tight">
            Excellence in Every Detail
          </h2>
        </motion.div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-400/10 flex items-center justify-center">
                  <Icon className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-xl text-white font-light mb-3 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-neutral-400 text-sm font-light leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
        
      </div>
    </section>
  );
}

