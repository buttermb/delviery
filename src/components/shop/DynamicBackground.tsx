/**
 * DynamicBackground - WebGL animated background using color4bg.js
 * Provides premium animated backgrounds for storefronts
 */

import { useEffect, useRef, useId, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  AestheticFluidBg,
  AmbientLightBg,
  BlurGradientBg,
  ChaosWavesBg,
  BigBlobBg,
  SwirlingCurvesBg,
} from 'color4bg';

export type BackgroundStyle = 
  | 'aesthetic-fluid' 
  | 'ambient-light' 
  | 'blur-gradient' 
  | 'chaos-waves'
  | 'big-blob'
  | 'swirling-curves'
  | 'static'; // Fallback to CSS gradient

interface DynamicBackgroundProps {
  /** Background animation style */
  style?: BackgroundStyle;
  /** Array of up to 6 hex colors */
  colors?: string[];
  /** Seed for consistent pattern generation */
  seed?: number;
  /** Whether to animate continuously */
  loop?: boolean;
  /** Fallback gradient for non-WebGL browsers */
  fallbackGradient?: string;
  /** Additional className */
  className?: string;
  /** Pause animation when not visible */
  pauseWhenHidden?: boolean;
}

// Map style names to color4bg classes
const BG_CLASSES = {
  'aesthetic-fluid': AestheticFluidBg,
  'ambient-light': AmbientLightBg,
  'blur-gradient': BlurGradientBg,
  'chaos-waves': ChaosWavesBg,
  'big-blob': BigBlobBg,
  'swirling-curves': SwirlingCurvesBg,
} as const;

// Default luxury colors
const DEFAULT_COLORS = ['#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#10b981'];

// Check WebGL support
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// Check for reduced motion preference
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DynamicBackground({
  style = 'aesthetic-fluid',
  colors = DEFAULT_COLORS,
  seed = 1000,
  loop = true,
  fallbackGradient,
  className = '',
  pauseWhenHidden = true,
}: DynamicBackgroundProps) {
  const uniqueId = useId().replace(/:/g, '');
  const containerId = `dynamic-bg-${uniqueId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const bgInstanceRef = useRef<any>(null);
  const [useFallback, setUseFallback] = useState(false);

  // Generate fallback gradient from colors
  const computedFallback = fallbackGradient || 
    `linear-gradient(135deg, ${colors[0]}20 0%, ${colors[2] || colors[0]}10 50%, ${colors[4] || colors[0]}05 100%)`;

  useEffect(() => {
    // Check if we should use fallback
    if (style === 'static' || !supportsWebGL() || prefersReducedMotion()) {
      setUseFallback(true);
      return;
    }

    const BgClass = BG_CLASSES[style];
    if (!BgClass) {
      setUseFallback(true);
      return;
    }

    // Wait for container to be in DOM
    const initTimeout = setTimeout(() => {
      try {
        // Ensure colors array has 6 items
        const normalizedColors = [...colors];
        while (normalizedColors.length < 6) {
          normalizedColors.push(normalizedColors[normalizedColors.length - 1] || '#000000');
        }

        bgInstanceRef.current = new BgClass({
          dom: containerId,
          colors: normalizedColors.slice(0, 6),
          seed,
          loop,
        });

        bgInstanceRef.current.start();
      } catch (error) {
        logger.warn('DynamicBackground: Failed to initialize WebGL background', error);
        setUseFallback(true);
      }
    }, 100);

    return () => {
      clearTimeout(initTimeout);
      if (bgInstanceRef.current) {
        try {
          bgInstanceRef.current.stop?.();
          bgInstanceRef.current.destroy?.();
        } catch {
          // Cleanup failed, not critical
        }
        bgInstanceRef.current = null;
      }
    };
  }, [style, containerId, seed, loop, colors]);

  // Visibility observer for performance
  useEffect(() => {
    if (!pauseWhenHidden || !bgInstanceRef.current || useFallback) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (bgInstanceRef.current) {
            if (entry.isIntersecting) {
              bgInstanceRef.current.start?.();
            } else {
              bgInstanceRef.current.stop?.();
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [pauseWhenHidden, useFallback]);

  if (useFallback) {
    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 ${className}`}
        style={{ background: computedFallback }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      id={containerId}
      className={`absolute inset-0 ${className}`}
      style={{ 
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
      }}
    />
  );
}

// Export style options for UI selectors
export const BACKGROUND_STYLE_OPTIONS: { value: BackgroundStyle; label: string; description: string }[] = [
  { value: 'static', label: 'Static Gradient', description: 'Simple CSS gradient (best performance)' },
  { value: 'aesthetic-fluid', label: 'Aesthetic Fluid', description: 'Smooth flowing animation' },
  { value: 'ambient-light', label: 'Ambient Light', description: 'Soft glowing effect' },
  { value: 'blur-gradient', label: 'Blur Gradient', description: 'Blurred color transitions' },
  { value: 'chaos-waves', label: 'Chaos Waves', description: 'Dynamic wave patterns' },
  { value: 'big-blob', label: 'Big Blob', description: 'Large organic shapes' },
  { value: 'swirling-curves', label: 'Swirling Curves', description: 'Elegant curved lines' },
];
