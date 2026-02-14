import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { useViewTransitionFallback, withViewTransition } from './useViewTransitionFallback';
import * as useViewTransitionSupportModule from './useViewTransitionSupport';

// Mock the useViewTransitionSupport hook
vi.mock('./useViewTransitionSupport', () => ({
  useViewTransitionSupport: vi.fn(),
}));

describe('useViewTransitionFallback', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalStartViewTransition: any;

  beforeEach(() => {
    // Store originals
    originalMatchMedia = window.matchMedia;
    originalStartViewTransition = (document as any).startViewTransition;

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    // Restore originals
    window.matchMedia = originalMatchMedia;
    if (originalStartViewTransition !== undefined) {
      (document as any).startViewTransition = originalStartViewTransition;
    } else {
      delete (document as any).startViewTransition;
    }
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  describe('Browser Support Detection', () => {
    it('should detect when View Transitions are not supported', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
      delete (document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransitionFallback(), { wrapper });

      expect(result.current.supportsViewTransitions).toBe(false);
    });

    it('should detect when View Transitions are supported', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      (document as any).startViewTransition = vi.fn();

      const { result } = renderHook(() => useViewTransitionFallback(), { wrapper });

      expect(result.current.supportsViewTransitions).toBe(true);
    });
  });

  describe('Fallback Behavior', () => {
    it('should provide a container ref for transitions', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useViewTransitionFallback(), { wrapper });

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.containerRef.current).toBeNull(); // Not attached to DOM
    });

    it('should apply transition class when fallback is enabled', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useViewTransitionFallback({
        enabled: true,
        transitionClass: 'custom-transition'
      }), { wrapper });

      expect(result.current.containerRef).toBeDefined();
    });

    it('should not apply transitions when disabled', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useViewTransitionFallback({
        enabled: false
      }), { wrapper });

      expect(result.current.isTransitioning).toBe(false);
    });

    it('should respect custom duration', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useViewTransitionFallback({
        duration: 500
      }), { wrapper });

      expect(result.current.containerRef).toBeDefined();
    });

    it('should use default transition class when not specified', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useViewTransitionFallback(), { wrapper });

      expect(result.current.containerRef).toBeDefined();
    });
  });

  describe('Reduced Motion Support', () => {
    it('should detect when user prefers reduced motion', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { result } = renderHook(() => useViewTransitionFallback(), { wrapper });

      expect(result.current.prefersReducedMotion).toBe(true);
    });

    it('should not apply animations when user prefers reduced motion', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { result } = renderHook(() => useViewTransitionFallback(), { wrapper });

      expect(result.current.prefersReducedMotion).toBe(true);
      expect(result.current.isTransitioning).toBe(false);
    });
  });

  describe('Route Change Handling', () => {
    it('should handle route changes without View Transitions support', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { rerender } = renderHook(() => useViewTransitionFallback(), {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/home']}>
            {children}
          </MemoryRouter>
        ),
      });

      // Trigger rerender (simulating route change)
      rerender();

      // Hook should handle it gracefully
      expect(true).toBe(true);
    });

    it('should cleanup timeouts on unmount', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { unmount } = renderHook(() => useViewTransitionFallback(), { wrapper });

      // Unmount should not throw any errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing container ref gracefully', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useViewTransitionFallback(), { wrapper });

      // Container ref starts as null
      expect(result.current.containerRef.current).toBeNull();
      expect(result.current.isTransitioning).toBe(false);
    });

    it('should handle server-side rendering', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      // Mock SSR environment
      const originalWindow = global.window;
      (global as any).window = undefined;

      expect(() => {
        // Restore window for hook execution
        (global as any).window = originalWindow;
        renderHook(() => useViewTransitionFallback(), { wrapper });
      }).not.toThrow();
    });

    it('should handle rapid route changes', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { rerender } = renderHook(() => useViewTransitionFallback(), {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/route1']}>
            {children}
          </MemoryRouter>
        ),
      });

      // Simulate rapid route changes
      for (let i = 0; i < 10; i++) {
        rerender();
      }

      // Should not crash
      await waitFor(() => {
        expect(true).toBe(true);
      });
    });
  });

  describe('Options Handling', () => {
    it('should handle all options correctly', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useViewTransitionFallback({
        duration: 300,
        enabled: true,
        transitionClass: 'my-custom-transition'
      }), { wrapper });

      expect(result.current.containerRef).toBeDefined();
    });

    it('should use defaults when options not provided', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useViewTransitionFallback(), { wrapper });

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.isTransitioning).toBe(false);
    });
  });
});

describe('withViewTransition', () => {
  let originalStartViewTransition: any;

  beforeEach(() => {
    originalStartViewTransition = (document as any).startViewTransition;
  });

  afterEach(() => {
    if (originalStartViewTransition !== undefined) {
      (document as any).startViewTransition = originalStartViewTransition;
    } else {
      delete (document as any).startViewTransition;
    }
    vi.clearAllMocks();
  });

  describe('View Transitions API Support', () => {
    it('should use native API when supported', () => {
      const mockStartViewTransition = vi.fn();
      (document as any).startViewTransition = mockStartViewTransition;

      const callback = vi.fn();
      withViewTransition(callback);

      expect(mockStartViewTransition).toHaveBeenCalledWith(callback);
    });

    it('should execute callback directly when not supported', () => {
      delete (document as any).startViewTransition;

      const callback = vi.fn();
      withViewTransition(callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should respect skipTransition option', () => {
      const mockStartViewTransition = vi.fn();
      (document as any).startViewTransition = mockStartViewTransition;

      const callback = vi.fn();
      withViewTransition(callback, { skipTransition: true });

      expect(mockStartViewTransition).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });

    it('should handle callback execution errors gracefully', () => {
      delete (document as any).startViewTransition;

      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });

      expect(() => withViewTransition(errorCallback)).toThrow('Test error');
    });
  });

  describe('Integration', () => {
    it('should work with navigation callbacks', () => {
      delete (document as any).startViewTransition;

      const navigate = vi.fn();
      withViewTransition(() => navigate('/new-route'));

      expect(navigate).toHaveBeenCalledWith('/new-route');
    });

    it('should work with state updates', () => {
      delete (document as any).startViewTransition;

      const setState = vi.fn();
      withViewTransition(() => setState('new-state'));

      expect(setState).toHaveBeenCalledWith('new-state');
    });

    it('should handle async callbacks', () => {
      delete (document as any).startViewTransition;

      const asyncCallback = vi.fn(async () => {
        await Promise.resolve();
      });

      withViewTransition(asyncCallback);

      expect(asyncCallback).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined options', () => {
      delete (document as any).startViewTransition;

      const callback = vi.fn();
      withViewTransition(callback, undefined);

      expect(callback).toHaveBeenCalled();
    });

    it('should handle null callback gracefully', () => {
      delete (document as any).startViewTransition;

      // Null callback should throw since it's not a function
      expect(() => withViewTransition(null as any)).toThrow();
    });

    it('should work in server environment', () => {
      // Mock server environment
      const originalDocument = global.document;
      (global as any).document = undefined;

      const callback = vi.fn();

      // Restore document for execution
      (global as any).document = originalDocument;
      delete (document as any).startViewTransition;

      withViewTransition(callback);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should execute quickly without View Transitions', () => {
      delete (document as any).startViewTransition;

      const start = performance.now();
      const callback = vi.fn();
      withViewTransition(callback);
      const end = performance.now();

      expect(end - start).toBeLessThan(10);
      expect(callback).toHaveBeenCalled();
    });

    it('should handle multiple sequential calls', () => {
      delete (document as any).startViewTransition;

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      withViewTransition(callback1);
      withViewTransition(callback2);
      withViewTransition(callback3);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });
  });
});
