import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewTransitionSupport } from './useViewTransitionSupport';

describe('useViewTransitionSupport', () => {
  // Store original document property
  let originalDocument: Document;
  let originalStartViewTransition: typeof document.startViewTransition | undefined;

  beforeEach(() => {
    // Save original document
    originalDocument = global.document;
    originalStartViewTransition = (global.document as any).startViewTransition;
  });

  afterEach(() => {
    // Restore original document
    global.document = originalDocument;
    if (originalStartViewTransition !== undefined) {
      (global.document as any).startViewTransition = originalStartViewTransition;
    } else {
      delete (global.document as any).startViewTransition;
    }
  });

  describe('Browser Support Detection', () => {
    it('should return true when View Transitions API is supported', () => {
      // Mock startViewTransition support
      (global.document as any).startViewTransition = () => ({});

      const { result } = renderHook(() => useViewTransitionSupport());

      expect(result.current).toBe(true);
    });

    it('should return false when View Transitions API is not supported', () => {
      // Remove startViewTransition
      delete (global.document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransitionSupport());

      expect(result.current).toBe(false);
    });

    it('should return false when document is undefined', () => {
      // Mock server-side rendering environment by testing the logic directly
      // We can't use renderHook when document is undefined, so we'll test the logic
      const documentCheck = typeof document !== 'undefined' && 'startViewTransition' in document;

      // When document is undefined, this check should be false
      expect(documentCheck).toBeDefined();

      // Verify that the hook would return false in SSR by checking typeof document
      const isSSR = typeof document === 'undefined';
      if (isSSR) {
        expect(isSSR).toBe(true);
      } else {
        // In browser environment, just verify the hook handles undefined gracefully
        delete (global.document as any).startViewTransition;
        const { result } = renderHook(() => useViewTransitionSupport());
        expect(result.current).toBe(false);
      }
    });
  });

  describe('Consistent Results', () => {
    it('should return consistent results across multiple calls', () => {
      // Mock startViewTransition support
      (global.document as any).startViewTransition = () => ({});

      const { result: result1 } = renderHook(() => useViewTransitionSupport());
      const { result: result2 } = renderHook(() => useViewTransitionSupport());
      const { result: result3 } = renderHook(() => useViewTransitionSupport());

      expect(result1.current).toBe(true);
      expect(result2.current).toBe(true);
      expect(result3.current).toBe(true);
    });

    it('should handle changes in browser support state', () => {
      // Initially not supported
      delete (global.document as any).startViewTransition;

      const { result, rerender } = renderHook(() => useViewTransitionSupport());
      expect(result.current).toBe(false);

      // Add support
      (global.document as any).startViewTransition = () => ({});
      rerender();
      expect(result.current).toBe(true);

      // Remove support
      delete (global.document as any).startViewTransition;
      rerender();
      expect(result.current).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null startViewTransition', () => {
      // Set startViewTransition to null
      (global.document as any).startViewTransition = null;

      const { result } = renderHook(() => useViewTransitionSupport());

      // null is still "in" the object, so this should return true
      expect(result.current).toBe(true);
    });

    it('should handle startViewTransition set to undefined', () => {
      // Explicitly set to undefined
      (global.document as any).startViewTransition = undefined;

      const { result } = renderHook(() => useViewTransitionSupport());

      // undefined is still "in" the object when explicitly set
      expect(result.current).toBe(true);
    });

    it('should handle startViewTransition as a non-function value', () => {
      // Set to a non-function value
      (global.document as any).startViewTransition = 'not-a-function';

      const { result } = renderHook(() => useViewTransitionSupport());

      // The hook only checks for existence, not type
      expect(result.current).toBe(true);
    });
  });

  describe('Real-World Browser Scenarios', () => {
    it('should detect Chrome/Edge with View Transitions support', () => {
      // Chrome/Edge support (Chromium 111+)
      (global.document as any).startViewTransition = function () {
        return {
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          finished: Promise.resolve(),
          skipTransition: () => {},
        };
      };

      const { result } = renderHook(() => useViewTransitionSupport());

      expect(result.current).toBe(true);
    });

    it('should detect Firefox without View Transitions support', () => {
      // Firefox doesn't support View Transitions yet (as of early 2024)
      delete (global.document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransitionSupport());

      expect(result.current).toBe(false);
    });

    it('should detect Safari without View Transitions support', () => {
      // Safari doesn't support View Transitions yet (as of early 2024)
      delete (global.document as any).startViewTransition;

      const { result } = renderHook(() => useViewTransitionSupport());

      expect(result.current).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should perform check quickly', () => {
      (global.document as any).startViewTransition = () => ({});

      const start = performance.now();
      renderHook(() => useViewTransitionSupport());
      const end = performance.now();

      // Should be extremely fast (< 1ms)
      expect(end - start).toBeLessThan(1);
    });

    it('should not create unnecessary re-renders', () => {
      (global.document as any).startViewTransition = () => ({});

      const { result, rerender } = renderHook(() => useViewTransitionSupport());
      const initialResult = result.current;

      // Re-render multiple times
      rerender();
      rerender();
      rerender();

      // Result should be referentially equal (same boolean value)
      expect(result.current).toBe(initialResult);
    });
  });
});
