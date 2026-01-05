/**
 * useReducedMotion - Performance optimization hooks
 * Detects user preference for reduced motion and mobile devices
 */

import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * Returns true if animations should be reduced for performance
 * - User prefers reduced motion
 * - Mobile device detected (for battery/performance)
 */
export function useShouldReduceAnimations(): boolean {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  return prefersReducedMotion || isMobile;
}

