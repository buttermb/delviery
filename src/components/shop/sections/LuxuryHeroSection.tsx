import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useRef, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DynamicBackground, type BackgroundStyle } from '../DynamicBackground';

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

// Generate color palette from accent color
function generateColorPalette(accentColor: string): string[] {
  // Create variations of the accent color
  const base = accentColor || '#10b981';
  return [
    base,
    adjustColor(base, -10),
    adjustColor(base, -20),
    adjustColor(base, -30),
    '#0a0a0a', // Dark accent
    base,
  ];
}

// Helper to lighten/darken a hex color
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// Simple hash function for consistent seed generation
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function LuxuryHeroSection({ content, styles, storeId }: LuxuryHeroSectionProps) {
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

  const accentColor = styles?.accent_color || '#10b981';
  const backgroundStyle = styles?.background_style || 'aesthetic-fluid';
  
  // Generate seed from storeId for consistent patterns per store
  const seed = storeId ? hashCode(storeId) : 1000;
  const colorPalette = generateColorPalette(accentColor);

  // Mouse spotlight effect state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Text reveal variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const letterVariants = {
    hidden: { y: 20, opacity: 0, filter: 'blur(10px)' },
    visible: {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] as any }
    }
  };

  return (
    <section ref={heroRef} className="relative min-h-[95vh] flex items-center justify-center overflow-hidden bg-black selection:bg-white/20">
      {/* Dynamic WebGL Background */}
      <div className="absolute inset-0 z-0">
        {/* Base dark layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-black to-neutral-950" />
        
        {/* WebGL Animated Background */}
        <DynamicBackground
          style={backgroundStyle}
          colors={colorPalette}
          seed={seed}
          loop={true}
          pauseWhenHidden={true}
          className="opacity-60"
        />

        {/* Spotlight Effect - overlays the WebGL background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none transition-opacity duration-500 z-10"
          style={{
            background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, ${accentColor}20, transparent 40%)`
          }}
        />

        {/* Grain Texture */}
        <div className="absolute inset-0 opacity-[0.02] z-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1 }}
            className="inline-flex items-center gap-3 px-5 py-2.5 mb-16 bg-white/[0.03] backdrop-blur-xl rounded-full border border-white/[0.08] hover:border-white/[0.15] transition-colors cursor-default"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accentColor }}></span>
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: accentColor }}></span>
            </span>
            <span className="text-xs text-white/70 font-medium tracking-[0.2em] uppercase font-sans">
              NYC Licensed Delivery
            </span>
          </motion.div>

          {/* Headline - Split for reveal effect */}
          <motion.div
            className="mb-10 relative"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <h1 className="flex flex-col items-center justify-center leading-[0.9]">
              <div className="overflow-hidden mb-2">
                <span className="block text-white font-serif italic text-[clamp(4rem,13vw,8.5rem)] tracking-[-0.03em]">
                  {heading_line_1.split("").map((char, i) => (
                    <motion.span key={i} variants={letterVariants} className="inline-block relative">
                      {char === " " ? "\u00A0" : char}
                    </motion.span>
                  ))}
                </span>
              </div>

              <div className="overflow-hidden">
                <span
                  className="block font-serif text-[clamp(4rem,13vw,8.5rem)] tracking-[-0.03em]"
                  style={{ color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.7)' }}
                >
                  <motion.span variants={letterVariants} className="inline-block">
                    {/* Gradient Text Overlay */}
                    <span className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent fill-mode-forwards" style={{ WebkitTextStroke: '0px' }}>
                      {heading_line_2}
                    </span>
                    {heading_line_2}
                  </motion.span>
                </span>
              </div>
            </h1>
          </motion.div>

          {/* Subheading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1 }}
            className="text-white/60 text-lg md:text-xl font-light leading-relaxed mb-16 max-w-2xl mx-auto font-sans"
          >
            <p dangerouslySetInnerHTML={{ __html: subheading }} />
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link to={cta_primary_link}>
              <Button
                className="group relative px-12 py-7 bg-white text-black text-sm font-medium tracking-widest uppercase rounded-none hover:bg-neutral-200 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-black/5 transition-colors" />
                <span className="relative z-10 flex items-center gap-3">
                  {cta_primary_text}
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Button>
            </Link>

            <Link to={cta_secondary_link}>
              <Button
                variant="outline"
                className="px-12 py-7 text-white text-sm font-medium tracking-widest uppercase rounded-none border border-white/20 hover:border-white hover:bg-white/5 transition-all duration-300 backdrop-blur-sm"
              >
                {cta_secondary_text}
              </Button>
            </Link>
          </motion.div>

        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
      >
        <span className="text-[10px] text-white/30 tracking-[0.3em] uppercase writing-vertical-rl">Scroll</span>
        <div className="w-[1px] h-16 bg-gradient-to-b from-white/0 via-white/20 to-white/0" />
      </motion.div>
    </section>
  );
}

