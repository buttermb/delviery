/**
 * Performance monitoring utilities
 * Tracks Core Web Vitals and custom metrics
 */

interface PerformanceMetrics {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {};
  private static observers: PerformanceObserver[] = [];

  /**
   * Initialize performance monitoring
   */
  static init() {
    if (typeof window === 'undefined') return;

    // First Contentful Paint
    this.observePaint();
    
    // Largest Contentful Paint
    this.observeLCP();
    
    // First Input Delay
    this.observeFID();
    
    // Cumulative Layout Shift
    this.observeCLS();
    
    // Navigation Timing
    this.observeNavigation();
  }

  private static observePaint() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.FCP = entry.startTime;
            this.logMetric('FCP', entry.startTime);
          }
        }
      });
      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (e) {
      console.warn('FCP observation not supported');
    }
  }

  private static observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.LCP = lastEntry.renderTime || lastEntry.loadTime;
        this.logMetric('LCP', this.metrics.LCP);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (e) {
      console.warn('LCP observation not supported');
    }
  }

  private static observeFID() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.metrics.FID = (entry as any).processingStart - entry.startTime;
          this.logMetric('FID', this.metrics.FID);
        }
      });
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (e) {
      console.warn('FID observation not supported');
    }
  }

  private static observeCLS() {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            this.metrics.CLS = clsValue;
          }
        }
      });
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (e) {
      console.warn('CLS observation not supported');
    }
  }

  private static observeNavigation() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          this.metrics.TTFB = navEntry.responseStart - navEntry.requestStart;
          this.logMetric('TTFB', this.metrics.TTFB);
        }
      });
      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (e) {
      console.warn('Navigation timing not supported');
    }
  }

  private static logMetric(name: string, value: number) {
    if (import.meta.env.DEV) {
      console.log(`📊 ${name}:`, Math.round(value), 'ms');
    }
  }

  /**
   * Get current metrics
   */
  static getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Mark a custom timing
   */
  static mark(name: string) {
    if (typeof window !== 'undefined' && window.performance) {
      performance.mark(name);
    }
  }

  /**
   * Measure time between two marks
   */
  static measure(name: string, startMark: string, endMark?: string) {
    if (typeof window !== 'undefined' && window.performance) {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          performance.measure(name, startMark);
        }
        const measure = performance.getEntriesByName(name)[0];
        this.logMetric(name, measure.duration);
        return measure.duration;
      } catch (e) {
        console.warn(`Could not measure ${name}`);
      }
    }
    return 0;
  }

  /**
   * Clean up observers
   */
  static disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  /**
   * Get a performance report
   */
  static getReport(): string {
    const metrics = this.getMetrics();
    return `
Performance Report:
- First Contentful Paint: ${metrics.FCP ? Math.round(metrics.FCP) + 'ms' : 'N/A'}
- Largest Contentful Paint: ${metrics.LCP ? Math.round(metrics.LCP) + 'ms' : 'N/A'}
- First Input Delay: ${metrics.FID ? Math.round(metrics.FID) + 'ms' : 'N/A'}
- Cumulative Layout Shift: ${metrics.CLS ? metrics.CLS.toFixed(3) : 'N/A'}
- Time to First Byte: ${metrics.TTFB ? Math.round(metrics.TTFB) + 'ms' : 'N/A'}
    `.trim();
  }
}

/**
 * Helper to measure component render time
 */
export function measureRender(componentName: string) {
  const startMark = `${componentName}-start`;
  const endMark = `${componentName}-end`;
  
  return {
    start: () => PerformanceMonitor.mark(startMark),
    end: () => {
      PerformanceMonitor.mark(endMark);
      return PerformanceMonitor.measure(
        `${componentName}-render`,
        startMark,
        endMark
      );
    }
  };
}
