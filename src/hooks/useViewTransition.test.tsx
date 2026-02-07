import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { useViewTransition } from './useViewTransition';

describe('useViewTransition', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalStartViewTransition: any;

  beforeEach(() => {
    // Store originals only if they exist
    originalMatchMedia = window.matchMedia;
    originalStartViewTransition = typeof document !== 'undefined' ? (document as any).startViewTransition : undefined;

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
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
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });

    if (typeof document !== 'undefined') {
      if (originalStartViewTransition !== undefined) {
        (document as any).startViewTransition = originalStartViewTransition;
      } else if ('startViewTransition' in document) {
        delete (document as any).startViewTransition;
      }
    }
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  describe('Browser Support Detection', () => {
    it('should detect when View Transitions API is supported', () => {
      (document as any).startViewTransition = vi.fn();

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(result.current.supportsViewTransitions).toBe(true);
    });

    it('should detect when View Transitions API is not supported', () => {
      delete (document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(result.current.supportsViewTransitions).toBe(false);
    });

    it('should detect when user prefers reduced motion', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
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

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(result.current.prefersReducedMotion).toBe(true);
    });

    it('should detect when user does not prefer reduced motion', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
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

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(result.current.prefersReducedMotion).toBe(false);
    });
  });

  describe('Navigation with Native View Transitions API', () => {
    it('should use native API when supported', () => {
      const mockStartViewTransition = vi.fn((callback) => {
        callback();
        return { finished: Promise.resolve() };
      });
      (document as any).startViewTransition = mockStartViewTransition;

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      act(() => {
        result.current.navigateWithTransition('/test-route');
      });

      expect(mockStartViewTransition).toHaveBeenCalled();
    });

    it('should pass navigate options when using native API', () => {
      const mockStartViewTransition = vi.fn((callback) => {
        callback();
        return { finished: Promise.resolve() };
      });
      (document as any).startViewTransition = mockStartViewTransition;

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      act(() => {
        result.current.navigateWithTransition('/test-route', {
          replace: true,
          state: { from: 'test' }
        });
      });

      expect(mockStartViewTransition).toHaveBeenCalled();
    });

    it('should skip transition when skipTransition is true', () => {
      const mockStartViewTransition = vi.fn();
      (document as any).startViewTransition = mockStartViewTransition;

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      act(() => {
        result.current.navigateWithTransition('/test-route', {
          skipTransition: true
        });
      });

      expect(mockStartViewTransition).not.toHaveBeenCalled();
    });
  });

  describe('Fallback CSS Animation', () => {
    beforeEach(() => {
      // Remove View Transitions API support
      delete (document as any).startViewTransition;

      // Create a mock main element
      const mainElement = document.createElement('main');
      mainElement.setAttribute('role', 'main');
      document.body.appendChild(mainElement);

      // Mock setTimeout
      vi.useFakeTimers();
    });

    afterEach(() => {
      // Clean up DOM
      const mainElement = document.querySelector('main[role="main"]');
      if (mainElement) {
        mainElement.remove();
      }

      vi.useRealTimers();
    });

    it('should apply CSS fallback classes when API not supported', () => {
      const { result } = renderHook(() => useViewTransition(), { wrapper });
      const mainElement = document.querySelector('main[role="main"]') as HTMLElement;

      act(() => {
        result.current.navigateWithTransition('/test-route');
      });

      expect(mainElement.classList.contains('route-transition-fallback')).toBe(true);
      expect(mainElement.classList.contains('route-transition-enter')).toBe(true);
      expect(mainElement.classList.contains('route-transition-enter-active')).toBe(true);
    });

    it('should remove fallback classes after animation duration', () => {
      const { result } = renderHook(() => useViewTransition(), { wrapper });
      const mainElement = document.querySelector('main[role="main"]') as HTMLElement;

      act(() => {
        result.current.navigateWithTransition('/test-route', {
          fallbackDuration: 300
        });
      });

      expect(mainElement.classList.contains('route-transition-enter')).toBe(true);

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mainElement.classList.contains('route-transition-enter')).toBe(false);
      expect(mainElement.classList.contains('route-transition-enter-active')).toBe(false);
    });

    it('should use default duration when not specified', () => {
      const { result } = renderHook(() => useViewTransition(), { wrapper });
      const mainElement = document.querySelector('main[role="main"]') as HTMLElement;

      act(() => {
        result.current.navigateWithTransition('/test-route');
      });

      expect(mainElement.classList.contains('route-transition-enter')).toBe(true);

      // Default duration is 200ms
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mainElement.classList.contains('route-transition-enter')).toBe(false);
    });

    it('should respect custom fallback duration', () => {
      const { result } = renderHook(() => useViewTransition(), { wrapper });
      const mainElement = document.querySelector('main[role="main"]') as HTMLElement;

      act(() => {
        result.current.navigateWithTransition('/test-route', {
          fallbackDuration: 500
        });
      });

      // Should still have classes before duration
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(mainElement.classList.contains('route-transition-enter')).toBe(true);

      // Should remove classes after duration
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(mainElement.classList.contains('route-transition-enter')).toBe(false);
    });

    it('should find alternative element with data-route-content attribute', () => {
      // Remove main element
      const mainElement = document.querySelector('main[role="main"]');
      mainElement?.remove();

      // Create alternative element
      const routeContent = document.createElement('div');
      routeContent.setAttribute('data-route-content', 'true');
      document.body.appendChild(routeContent);

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      act(() => {
        result.current.navigateWithTransition('/test-route');
      });

      expect(routeContent.classList.contains('route-transition-fallback')).toBe(true);

      // Clean up
      routeContent.remove();
    });

    it('should fallback to body element when no suitable element found', () => {
      // Remove main element
      const mainElement = document.querySelector('main[role="main"]');
      mainElement?.remove();

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      act(() => {
        result.current.navigateWithTransition('/test-route');
      });

      expect(document.body.classList.contains('route-transition-fallback')).toBe(true);

      // Clean up
      document.body.classList.remove('route-transition-fallback', 'route-transition-enter', 'route-transition-enter-active');
    });

    it('should skip animation when user prefers reduced motion', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
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

      const { result } = renderHook(() => useViewTransition(), { wrapper });
      const mainElement = document.querySelector('main[role="main"]') as HTMLElement;

      act(() => {
        result.current.navigateWithTransition('/test-route');
      });

      // Should not apply animation classes when reduced motion is preferred
      expect(mainElement.classList.contains('route-transition-enter')).toBe(false);
    });

    it('should clear existing timeout on new navigation', () => {
      const { result } = renderHook(() => useViewTransition(), { wrapper });
      const mainElement = document.querySelector('main[role="main"]') as HTMLElement;

      // First navigation
      act(() => {
        result.current.navigateWithTransition('/route1');
      });

      expect(mainElement.classList.contains('route-transition-enter')).toBe(true);

      // Second navigation before first completes
      act(() => {
        result.current.navigateWithTransition('/route2');
      });

      // Should still have transition classes
      expect(mainElement.classList.contains('route-transition-enter')).toBe(true);

      // Advance time to complete second animation
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mainElement.classList.contains('route-transition-enter')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle navigation without options', () => {
      delete (document as any).startViewTransition;
      const mainElement = document.createElement('main');
      mainElement.setAttribute('role', 'main');
      document.body.appendChild(mainElement);

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(() => {
        act(() => {
          result.current.navigateWithTransition('/test-route');
        });
      }).not.toThrow();

      mainElement.remove();
    });

    it('should handle skipTransition with fallback', () => {
      delete (document as any).startViewTransition;
      const mainElement = document.createElement('main');
      mainElement.setAttribute('role', 'main');
      document.body.appendChild(mainElement);

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      act(() => {
        result.current.navigateWithTransition('/test-route', {
          skipTransition: true
        });
      });

      expect(mainElement.classList.contains('route-transition-enter')).toBe(false);

      mainElement.remove();
    });

    it('should handle server-side rendering', () => {
      // Simply delete startViewTransition to simulate SSR environment
      delete (document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(result.current.supportsViewTransitions).toBe(false);

      // During normal rendering, prefersReducedMotion will check window.matchMedia
      // which is mocked to return false by default
      expect(typeof result.current.prefersReducedMotion).toBe('boolean');
    });

    it('should handle rapid navigation calls', () => {
      vi.useFakeTimers();
      delete (document as any).startViewTransition;
      const mainElement = document.createElement('main');
      mainElement.setAttribute('role', 'main');
      document.body.appendChild(mainElement);

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      // Rapid navigation calls
      act(() => {
        result.current.navigateWithTransition('/route1');
        result.current.navigateWithTransition('/route2');
        result.current.navigateWithTransition('/route3');
      });

      // Should handle without errors
      expect(mainElement.classList.contains('route-transition-enter')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      mainElement.remove();
      vi.useRealTimers();
    });
  });

  describe('Return Values', () => {
    it('should return navigateWithTransition function', () => {
      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(typeof result.current.navigateWithTransition).toBe('function');
    });

    it('should return supportsViewTransitions boolean', () => {
      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(typeof result.current.supportsViewTransitions).toBe('boolean');
    });

    it('should return prefersReducedMotion boolean', () => {
      const { result } = renderHook(() => useViewTransition(), { wrapper });

      expect(typeof result.current.prefersReducedMotion).toBe('boolean');
    });
  });

  describe('Integration', () => {
    it('should work with React Router navigation options', () => {
      const mockStartViewTransition = vi.fn((callback) => {
        callback();
        return { finished: Promise.resolve() };
      });
      (document as any).startViewTransition = mockStartViewTransition;

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      act(() => {
        result.current.navigateWithTransition('/test-route', {
          replace: true,
          state: { from: 'home' },
          preventScrollReset: true
        });
      });

      expect(mockStartViewTransition).toHaveBeenCalled();
    });

    it('should maintain navigation state with fallback', () => {
      vi.useFakeTimers();
      delete (document as any).startViewTransition;
      const mainElement = document.createElement('main');
      mainElement.setAttribute('role', 'main');
      document.body.appendChild(mainElement);

      const { result } = renderHook(() => useViewTransition(), { wrapper });

      act(() => {
        result.current.navigateWithTransition('/test-route', {
          state: { test: 'data' }
        });
      });

      // Animation should not affect navigation state
      act(() => {
        vi.advanceTimersByTime(200);
      });

      mainElement.remove();
      vi.useRealTimers();
    });
  });
});
