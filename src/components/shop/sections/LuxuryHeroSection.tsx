import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { type BackgroundStyle } from '../DynamicBackground';
import { ChevronRight, ChevronDown } from 'lucide-react';

export interface LuxuryHeroSectionProps {
  content: {
    heading_line_1?: string;
    heading_line_2?: string;
    subheading?: string;
    cta_primary_text?: string;
    cta_primary_link?: string;
    cta_secondary_text?: string;
    cta_secondary_link?: string;
    trust_badges?: boolean;
  };
  styles?: {
    accent_color?: string;
    background_style?: BackgroundStyle;
  };
  storeId?: string;
}

export function LuxuryHeroSection({ content, styles, storeId: _storeId }: LuxuryHeroSectionProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { storeSlug } = useParams<{ storeSlug: string }>();

  const accentColor = styles?.accent_color || 'hsl(174 87% 42%)';

  return (
    <section
      ref={heroRef}
      className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-shop-primary"
    >
      {/* Animated Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-[50%] -left-[20%] w-[140%] h-[200%] opacity-40 blur-[100px]"
          style={{
            background: `radial-gradient(circle at center, ${accentColor}, transparent 70%)`
          }}
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [0, -5, 5, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-[50%] -right-[20%] w-[140%] h-[200%] opacity-20 blur-[120px]"
          style={{
            background: 'radial-gradient(circle at center, #ffffff, transparent 70%)'
          }}
        />

        {/* Pattern Overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="max-w-4xl mx-auto space-y-8"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mx-auto"
          >
            <span className="flex h-2 w-2 rounded-full bg-shop-accent animate-pulse"></span>
            <span className="text-white/90 text-xs font-medium tracking-wide uppercase">Now Delivering</span>
          </motion.div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black text-white tracking-tighter leading-[1.1] drop-shadow-sm">
            {content.heading_line_1 && (
              <span className="block">{content.heading_line_1}</span>
            )}
            {content.heading_line_2 && (
              <span
                className="block text-transparent bg-clip-text bg-gradient-to-r from-shop-accent to-white"
              >
                {content.heading_line_2}
              </span>
            )}
            {!content.heading_line_1 && !content.heading_line_2 && (
              <>
                <span className="block">Premium</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-shop-accent to-white">Cannabis</span>
              </>
            )}
          </h1>

          {/* Subheading */}
          {content.subheading && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-lg md:text-2xl text-white/80 max-w-2xl mx-auto font-medium leading-relaxed"
            >
              {content.subheading}
            </motion.p>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center pt-8 items-center"
          >
            {content.cta_primary_text && (
              <Link to={content.cta_primary_link || `/shop/${storeSlug}/products`}>
                <Button
                  size="lg"
                  className="group relative min-w-[200px] h-14 text-lg font-bold rounded-full transition-all duration-300 hover:scale-105 shadow-[0_0_40px_-10px_rgba(14,199,186,0.5)] overflow-hidden"
                  style={{
                    backgroundColor: 'hsl(var(--shop-accent))',
                    color: 'hsl(var(--shop-primary))',
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {content.cta_primary_text}
                    <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />
                </Button>
              </Link>
            )}
            {content.cta_secondary_text && (
              <Link to={content.cta_secondary_link || `/shop/${storeSlug}/products`}>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-w-[200px] h-14 text-lg font-bold rounded-full border-white/30 text-white hover:bg-white/10 hover:border-white transition-all duration-300 backdrop-blur-sm"
                >
                  {content.cta_secondary_text}
                </Button>
              </Link>
            )}
          </motion.div>

          {/* Trust Badges */}
          {content.trust_badges && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="flex flex-wrap justify-center gap-8 pt-10 border-t border-white/10 max-w-3xl mx-auto"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
                  <svg className="w-5 h-5 text-shop-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-white font-bold text-sm">Verified</div>
                  <div className="text-white/50 text-xs">Licensed Store</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
                  <svg className="w-5 h-5 text-shop-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-white font-bold text-sm">Fast</div>
                  <div className="text-white/50 text-xs">Local Delivery</div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-white/40 text-xs font-medium uppercase tracking-widest">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="w-6 h-6 text-white/60" />
        </motion.div>
      </motion.div>
    </section>
  );
}
