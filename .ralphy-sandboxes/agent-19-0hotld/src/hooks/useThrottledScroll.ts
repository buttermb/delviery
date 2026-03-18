import { useScroll } from 'framer-motion';
import { useEffect, useState } from 'react';

export function useThrottledScroll(throttleMs = 16) {
  const { scrollY, scrollYProgress } = useScroll();
  const [throttledY, setThrottledY] = useState(0);
  
  useEffect(() => {
    let lastRun = 0;
    const unsubscribe = scrollY.on('change', (latest) => {
      const now = Date.now();
      if (now - lastRun >= throttleMs) {
        setThrottledY(latest);
        lastRun = now;
      }
    });
    return unsubscribe;
  }, [scrollY, throttleMs]);
  
  return { scrollY, scrollYProgress, throttledY };
}
