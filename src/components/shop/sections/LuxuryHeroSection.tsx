import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

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
  };
}

export function LuxuryHeroSection({ content, styles }: LuxuryHeroSectionProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { storeSlug } = useParams();

  const {
    heading_line_1 = "Premium",
    heading_line_2 = "Flower",
    subheading = "Curated strains from licensed cultivators. Lab-verified quality.<br/>Same-day delivery throughout NYC.",
    cta_primary_text = "Explore Collection",
    cta_primary_link = `/shop/${storeSlug}/products`,
    cta_secondary_text = "Learn More",
    cta_secondary_link = `/shop/${storeSlug}/about`,
    trust_badges = true
  } = content || {};

  const accentColor = styles?.accent_color || '#10b981'; // emerald-500

  // Subtle parallax mouse movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20;
      const y = (clientY / window.innerHeight - 0.5) * 20;
      heroRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-black">
      {/* Ambient background - ultra subtle */}
      <div className="absolute inset-0">
        {/* Gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-950 to-black" />

        {/* Floating orbs - parallax effect */}
        <div ref={heroRef} className="absolute inset-0 transition-transform duration-1000 ease-out">
          <motion.div
            initial={{ opacity: 0.05 }}
            animate={{
              opacity: [0.05, 0.08, 0.05],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
          <motion.div
            initial={{ opacity: 0.05 }}
            animate={{
              opacity: [0.05, 0.08, 0.05],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
        </div>

        {/* Noise texture for depth */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'3\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")' }}
        />
      </div>

      {/* Content - ultra minimal */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">

          {/* Small overline - subtle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-12 bg-white/[0.02] backdrop-blur-2xl rounded-full border border-white/[0.05]"
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-xs text-white/50 font-light tracking-[0.2em] uppercase">
              NYC Licensed Delivery
            </span>
          </motion.div>

          {/* Main headline - ultra clean */}
          <motion.h1
            className="mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="block text-white font-extralight text-[clamp(3rem,12vw,7rem)] leading-[0.95] tracking-[-0.02em] mb-4">
              {heading_line_1}
            </span>
            <span
              className="block bg-clip-text text-transparent font-light text-[clamp(3rem,12vw,7rem)] leading-[0.95] tracking-[-0.02em]"
              style={{
                backgroundImage: `linear-gradient(to right, ${accentColor}, ${adjustColor(accentColor, 40)})`
              }}
            >
              {heading_line_2}
            </span>
          </motion.h1>

          {/* Subheadline - generous spacing */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-white/50 text-lg md:text-xl font-light leading-relaxed mb-16 max-w-2xl mx-auto"
            dangerouslySetInnerHTML={{ __html: subheading }}
          />

          {/* CTA - minimal but prominent */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to={cta_primary_link}>
              <Button
                className="group relative px-10 py-4 bg-white text-black text-sm font-light tracking-wide rounded-full hover:bg-white/90 transition-all duration-300 overflow-hidden h-auto"
              >
                <span className="relative z-10">{cta_primary_text}</span>
              </Button>
            </Link>

            <Link to={cta_secondary_link}>
              <Button
                variant="outline"
                className="px-10 py-4 text-white text-sm font-light tracking-wide rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all duration-300 h-auto"
              >
                {cta_secondary_text}
              </Button>
            </Link>
          </motion.div>

          {/* Trust indicators - ultra minimal */}
          {trust_badges && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex items-center justify-center gap-8 mt-20 text-white/30 text-xs font-light tracking-wider flex-wrap"
            >
              <span className="flex items-center gap-2">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: accentColor }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Licensed
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: accentColor }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Lab Verified
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: accentColor }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Same-Day
              </span>
            </motion.div>
          )}

        </div>
      </div>

      {/* Scroll indicator - minimal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce"
      >
        <div className="flex flex-col items-center gap-2 text-white/20">
          <span className="text-[10px] font-light tracking-widest uppercase">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </motion.div>

    </section>
  );
}

// Helper to lighten/darken a hex color
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
