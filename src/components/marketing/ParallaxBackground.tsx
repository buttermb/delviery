import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useInView } from 'react-intersection-observer';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function ParallaxBackground() {
  usePerformanceMonitor('ParallaxBackground');
  const ref = useRef<HTMLDivElement>(null);
  const { ref: inViewRef, inView } = useInView({ threshold: 0.1, triggerOnce: true });
  const prefersReducedMotion = useReducedMotion();
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Pause animations when off-screen or reduced motion preferred
  const shouldAnimate = inView && !prefersReducedMotion;

  const y1 = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const y2 = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.4, 0.2, 0]);

  if (!shouldAnimate) {
    return <div ref={ref} className="fixed inset-0 overflow-hidden pointer-events-none -z-10" />;
  }

  return (
    <div ref={ref} className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div ref={inViewRef} className="absolute inset-0" />
      
      {/* Gradient orbs - reduced to 2 */}
      <motion.div
        className="absolute top-[15%] left-[15%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))]/15 to-transparent blur-3xl"
        style={{ y: y1, opacity }}
      />
      
      <motion.div
        className="absolute bottom-[20%] right-[20%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[hsl(var(--marketing-accent))]/15 to-transparent blur-3xl"
        style={{ y: y2, opacity }}
      />

      {/* Grid pattern - static for performance */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="parallax-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <circle cx="25" cy="25" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#parallax-grid)" />
        </svg>
      </div>
    </div>
  );
}
