import { ReactNode, useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface LazyAnimationProps {
  children: ReactNode;
  className?: string;
  threshold?: number;
}

/**
 * Wrapper that only enables animations when component is in viewport
 * Pauses animations when off-screen for better performance
 */
export function LazyAnimation({ 
  children, 
  className = '',
  threshold = 0.1 
}: LazyAnimationProps) {
  const { ref, inView } = useInView({
    threshold,
    triggerOnce: false, // Re-trigger when scrolling back
  });
  const prefersReducedMotion = useReducedMotion();
  const [shouldRender, setShouldRender] = useState(false);

  // Delay rendering until in view
  useEffect(() => {
    if (inView && !prefersReducedMotion) {
      setShouldRender(true);
    }
  }, [inView, prefersReducedMotion]);

  return (
    <div ref={ref} className={className}>
      {shouldRender && !prefersReducedMotion ? children : null}
    </div>
  );
}
