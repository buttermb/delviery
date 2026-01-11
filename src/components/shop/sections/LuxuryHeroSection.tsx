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

function generateColorPalette(accentColor: string): string[] {
  const base = accentColor || '#10b981';
  return [
    base,
    adjustColor(base, -10),
    adjustColor(base, -20),
    adjustColor(base, -30),
    '#0a0a0a',
    base,
  ];
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function LuxuryHeroSection({ content, styles, storeId }: LuxuryHeroSectionProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { storeSlug } = useParams();

  const accentColor = styles?.accent_color || '#10b981';
  const backgroundStyle = styles?.background_style || 'mesh';
  const colorPalette = generateColorPalette(accentColor);
  const seed = storeSlug ? hashCode(storeSlug) : 12345;

  return (
    <section
      ref={heroRef}
      className="relative min-h-[70vh] flex items-center justify-center overflow-hidden"
    >
      {/* Dynamic Background */}
      <DynamicBackground
        style={backgroundStyle}
        colors={colorPalette}
        seed={seed}
        className="absolute inset-0"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="max-w-4xl mx-auto space-y-6"
        >
          {/* Heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-light text-white tracking-tight">
            {content.heading_line_1 && (
              <span className="block">{content.heading_line_1}</span>
            )}
            {content.heading_line_2 && (
              <span
                className="block mt-2"
                style={{ color: accentColor }}
              >
                {content.heading_line_2}
              </span>
            )}
          </h1>

          {/* Subheading */}
          {content.subheading && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto font-light"
            >
              {content.subheading}
            </motion.p>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
          >
            {content.cta_primary_text && (
              <Link to={content.cta_primary_link || `/shop/${storeSlug}`}>
                <Button
                  size="lg"
                  className="min-w-[200px] h-14 text-lg font-medium rounded-full transition-all duration-300 hover:scale-105"
                  style={{
                    backgroundColor: accentColor,
                    color: '#000',
                  }}
                >
                  {content.cta_primary_text}
                </Button>
              </Link>
            )}
            {content.cta_secondary_text && (
              <Link to={content.cta_secondary_link || `/shop/${storeSlug}/menu`}>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-w-[200px] h-14 text-lg font-medium rounded-full border-white/30 text-white hover:bg-white/10 transition-all duration-300"
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
              className="flex flex-wrap justify-center gap-6 pt-8"
            >
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  ✓
                </div>
                <span>Licensed & Verified</span>
              </div>
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  🚀
                </div>
                <span>Fast Delivery</span>
              </div>
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  ⭐
                </div>
                <span>Premium Quality</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
