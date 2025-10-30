/**
 * Premium Sophisticated Hero Section
 * Fixed spacing, fonts, and animations
 */

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useEffect, useRef } from 'react';

export function PremiumHero() {
  const heroRef = useRef<HTMLDivElement>(null);
  
  const scrollToProducts = (filterType?: string) => {
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
      
      // Set filter in localStorage and trigger filter event
      if (filterType) {
        localStorage.setItem('productFilter', filterType);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('setProductFilter', { 
            detail: { filter: filterType } 
          }));
        }, 500);
      }
    }
  };

  // Subtle parallax mouse movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 10;
      const y = (clientY / window.innerHeight - 0.5) * 10;
      heroRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A0A0A]">
      
      {/* Animated background */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-950 to-emerald-950/10" />
        
        {/* Animated floating orbs with parallax */}
        <div ref={heroRef} className="absolute inset-0 transition-transform duration-1000 ease-out">
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ 
              opacity: [0.3, 0.15, 0.3],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl"
          />
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ 
              opacity: [0.3, 0.15, 0.3],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-400/5 rounded-full blur-3xl"
          />
        </div>
        
        {/* Noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%220%200%20200%20200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22noiseFilter%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%223%22%20numOctaves%3D%224%22%20%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23noiseFilter)%22%20%2F%3E%3C%2Fsvg%3E')]"
        />
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          
          {/* Main headline - FIXED SPACING */}
          <div className="text-center px-4">
            
            {/* Top line - "Premium" */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0 }}
              className="text-white font-extralight text-[clamp(4rem,15vw,9rem)] leading-[0.9] tracking-[-0.03em] mb-0"
            >
              Premium
            </motion.h1>
            
            {/* Middle line - "Flower" with gradient, NOT ITALIC */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className="relative inline-block"
            >
              <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 font-light text-[clamp(4rem,15vw,9rem)] leading-[0.9] tracking-[-0.03em] my-0">
                Flower
              </h1>
              {/* Subtle glow effect */}
              <div className="absolute inset-0 blur-2xl opacity-20 bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 pointer-events-none" />
            </motion.div>
            
            {/* Bottom line - "Delivered" */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
              className="text-white font-extralight text-[clamp(4rem,15vw,9rem)] leading-[0.9] tracking-[-0.03em] mt-0"
            >
              Delivered
            </motion.h1>
            
          </div>
          
          {/* Subheadline - FIXED SPACING */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
            className="text-center text-white/50 text-lg md:text-xl font-light leading-relaxed mt-12 mb-12 max-w-2xl mx-auto"
          >
            Curated strains. Same-day delivery.
            <br />
            <span className="text-white/40">Discreet service throughout Manhattan, Brooklyn, and Queens.</span>
          </motion.p>
          
          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              onClick={() => scrollToProducts('premium')}
              className="group relative px-10 py-4 bg-white text-black text-sm font-light tracking-wide rounded-full hover:bg-emerald-50 transition-all duration-300 shadow-lg hover:shadow-emerald-500/20 hover:scale-105 h-auto"
            >
              <span className="relative z-10">Explore Collection</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => scrollToProducts()}
              className="px-10 py-4 text-white text-sm font-light tracking-wide rounded-full border border-white/10 hover:border-emerald-500/50 hover:bg-white/5 transition-all duration-300 h-auto bg-white/5 backdrop-blur-sm"
            >
              View Menu
            </Button>
          </motion.div>
          
          {/* Trust badges - minimal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 1.0 }}
            className="flex items-center justify-center gap-8 mt-16 text-white/30 text-xs font-light tracking-wider flex-wrap"
          >
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Licensed
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Lab Verified
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Same-Day
            </span>
          </motion.div>
          
        </div>
      </div>
      
      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 cursor-pointer"
        onClick={() => scrollToProducts()}
      >
        <div className="flex flex-col items-center gap-2 text-white/20">
          <span className="text-[10px] font-light tracking-widest uppercase">Scroll</span>
          <div className="relative w-[1px] h-12 overflow-hidden">
            <motion.div
              animate={{ y: [0, 24, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-full h-6 bg-gradient-to-b from-white/20 to-transparent"
            />
          </div>
        </div>
      </motion.div>
      
    </section>
  );
}
