/**
 * Elegant Final CTA Section
 * Premium, sophisticated call-to-action
 */

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function ElegantFinalCTA() {
  const navigate = useNavigate();

  return (
    <section className="py-24 md:py-32 bg-neutral-900 relative overflow-hidden">
      
      {/* Subtle background elements */}
      <div className="absolute inset-0 overflow-hidden opacity-5">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="container mx-auto px-6 max-w-4xl text-center relative z-10"
      >
        
        <h2 className="text-4xl sm:text-6xl md:text-7xl font-light text-white mb-6 sm:mb-8 tracking-tight">
          Experience the Difference
        </h2>
        
        <p className="text-base sm:text-lg md:text-xl text-white/60 mb-8 sm:mb-12 font-light leading-relaxed max-w-2xl mx-auto">
          Premium flower delivered with care. Join thousands of satisfied 
          clients across Manhattan, Brooklyn, and Queens.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={() => {
              const productsSection = document.getElementById('products');
              if (productsSection) {
                productsSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="px-10 py-4 bg-neutral-100 text-neutral-900 font-light tracking-wide hover:bg-emerald-500 hover:text-white transition-all duration-300 h-auto shadow-lg hover:shadow-emerald-500/30"
          >
            Browse Collection
          </Button>
          
          <Button
            variant="outline"
            onClick={() => navigate('/user-account')}
            className="px-10 py-4 border border-white/20 text-white font-light tracking-wide hover:border-emerald-400 hover:text-emerald-400 transition-all duration-300 bg-transparent h-auto"
          >
            Contact Us
          </Button>
        </div>
        
        {/* Subtle trust line */}
        <div className="mt-16 text-white/40 text-sm font-light">
          Licensed & Verified • Lab Tested • Discreet Delivery
        </div>
        
      </motion.div>
    </section>
  );
}

