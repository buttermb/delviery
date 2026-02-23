/**
 * Sophisticated "How It Works" Section
 * Elegant, minimal process display
 */

import { motion } from 'framer-motion';

const steps = [
  {
    number: '1',
    title: 'Browse Collection',
    description: 'Explore our curated selection of premium flower. Each strain includes detailed information and lab certificates.',
  },
  {
    number: '2',
    title: 'Secure Checkout',
    description: 'Complete your order through our secure platform. Multiple payment options available for your convenience.',
  },
  {
    number: '3',
    title: 'Discreet Delivery',
    description: 'Track your delivery in real-time. Professional courier arrives with unmarked packaging within the hour.',
  },
];

export function SophisticatedHowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-black" data-dark-panel>
      <div className="container mx-auto px-6 max-w-5xl">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16 md:mb-20"
        >
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-light text-white mb-6 tracking-tight">
            Simple. Secure. Swift.
          </h2>
        </motion.div>
        
        <div className="space-y-8 md:space-y-16">
          {steps.map((step, index) => (
            <div key={index}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12"
              >
                <div className={`flex-shrink-0 w-16 md:w-24 h-16 md:h-24 rounded-full ${
                  index === steps.length - 1 ? 'bg-emerald-600' : 'bg-neutral-900'
                } flex items-center justify-center`}>
                  <span className="text-2xl md:text-4xl text-white font-light">{step.number}</span>
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl md:text-3xl text-white font-light mb-3 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-neutral-400 text-base md:text-lg font-light leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
              
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: (index + 1) * 0.1 }}
                  className="hidden md:block w-px h-8 md:h-12 bg-neutral-700 ml-12"
                />
              )}
            </div>
          ))}
        </div>
        
      </div>
    </section>
  );
}

