import { logger } from '@/lib/logger';
import { useEffect } from 'react';

export function usePerformanceMonitor(componentName: string) {
  useEffect(() => {
    if (import.meta.env.DEV) {
      const startTime = performance.now();
      
      return () => {
        const endTime = performance.now();
        logger.debug(`[Perf] ${componentName} render time: ${(endTime - startTime).toFixed(2)}ms`);
      };
    }
  }, [componentName]);
}
