/**
 * View Transitions Fallback Tests for Performance Utilities
 *
 * Comprehensive test suite for View Transitions API integration
 * with proper fallback handling for unsupported browsers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  batchUpdates,
  withViewTransition,
  supportsViewTransitions,
  prefersReducedMotion,
} from '../performance';

describe('View Transitions Fallback', () => {
  let originalDocument: Document;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalDocument = global.document;
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    global.document = originalDocument;
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  describe('supportsViewTransitions', () => {
    it('should return true when View Transitions API is supported', () => {
      // Mock View Transitions support
      Object.defineProperty(document, 'startViewTransition', {
        value: vi.fn(),
        configurable: true,
      });

      expect(supportsViewTransitions()).toBe(true);
    });

    it('should return false when View Transitions API is not supported', () => {
      // Remove View Transitions support
      const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
      if (descriptor?.configurable) {
        delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
      }

      expect(supportsViewTransitions()).toBe(false);
    });

    it('should return false in non-browser environment', () => {
      const originalDoc = global.document;
      (global as unknown as { document: undefined }).document = undefined;

      expect(supportsViewTransitions()).toBe(false);

      global.document = originalDoc;
    });
  });

  describe('prefersReducedMotion', () => {
    it('should return true when user prefers reduced motion', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(prefersReducedMotion()).toBe(true);
    });

    it('should return false when user does not prefer reduced motion', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(prefersReducedMotion()).toBe(false);
    });
  });

  describe('batchUpdates', () => {
    describe('with View Transitions API support', () => {
      it('should use View Transitions API when supported', async () => {
        const callback = vi.fn();
        const mockTransition = {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        };

        const startViewTransition = vi.fn().mockReturnValue(mockTransition);
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await batchUpdates(callback);

        expect(startViewTransition).toHaveBeenCalledWith(callback);
        expect(callback).not.toHaveBeenCalled(); // Called by View Transitions API
      });

      it('should handle transition failures gracefully', async () => {
        const callback = vi.fn();
        const mockTransition = {
          finished: Promise.reject(new Error('Transition failed')),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        };

        const startViewTransition = vi.fn().mockReturnValue(mockTransition);
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        // Should not throw
        await expect(batchUpdates(callback)).resolves.toBeUndefined();
      });

      it('should skip transition when skipTransition option is true', async () => {
        const callback = vi.fn();
        const startViewTransition = vi.fn();

        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await batchUpdates(callback, { skipTransition: true });

        expect(startViewTransition).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
      });

      it('should respect prefers-reduced-motion', async () => {
        const callback = vi.fn();
        const startViewTransition = vi.fn();

        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await batchUpdates(callback);

        expect(startViewTransition).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
      });
    });

    describe('fallback behavior (no View Transitions support)', () => {
      it('should execute callback immediately when not supported', async () => {
        const callback = vi.fn();

        // Remove View Transitions support
        const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
        if (descriptor?.configurable) {
          delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
        }

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await batchUpdates(callback);

        expect(callback).toHaveBeenCalled();
      });

      it('should return resolved promise in fallback mode', async () => {
        const callback = vi.fn();

        // Remove View Transitions support
        const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
        if (descriptor?.configurable) {
          delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
        }

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        const result = batchUpdates(callback);

        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBeUndefined();
      });
    });
  });

  describe('withViewTransition', () => {
    describe('with View Transitions API support', () => {
      it('should use View Transitions API when supported', async () => {
        const callback = vi.fn();
        const mockTransition = {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        };

        const startViewTransition = vi.fn().mockReturnValue(mockTransition);
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await withViewTransition(callback);

        expect(startViewTransition).toHaveBeenCalledWith(callback);
      });

      it('should call onReady when transition is ready', async () => {
        const callback = vi.fn();
        const onReady = vi.fn();
        const mockTransition = {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        };

        const startViewTransition = vi.fn().mockReturnValue(mockTransition);
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await withViewTransition(callback, { onReady });

        expect(onReady).toHaveBeenCalled();
      });

      it('should call onError when transition fails', async () => {
        const callback = vi.fn();
        const onError = vi.fn();
        const error = new Error('Transition failed');
        const mockTransition = {
          finished: Promise.reject(error),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        };

        const startViewTransition = vi.fn().mockReturnValue(mockTransition);
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await withViewTransition(callback, { onError });

        expect(onError).toHaveBeenCalledWith(error);
      });

      it('should handle async callbacks', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        const mockTransition = {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        };

        const startViewTransition = vi.fn().mockReturnValue(mockTransition);
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await withViewTransition(callback);

        expect(startViewTransition).toHaveBeenCalled();
      });

      it('should skip transition when skipTransition is true', async () => {
        const callback = vi.fn();
        const startViewTransition = vi.fn();

        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await withViewTransition(callback, { skipTransition: true });

        expect(startViewTransition).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
      });

      it('should respect prefers-reduced-motion', async () => {
        const callback = vi.fn();
        const startViewTransition = vi.fn();

        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await withViewTransition(callback);

        expect(startViewTransition).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
      });
    });

    describe('fallback behavior (no View Transitions support)', () => {
      it('should execute callback immediately when not supported', async () => {
        const callback = vi.fn();

        // Remove View Transitions support
        const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
        if (descriptor?.configurable) {
          delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
        }

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await withViewTransition(callback);

        expect(callback).toHaveBeenCalled();
      });

      it('should handle async callbacks in fallback mode', async () => {
        const callback = vi.fn().mockResolvedValue('result');

        // Remove View Transitions support
        const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
        if (descriptor?.configurable) {
          delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
        }

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await withViewTransition(callback);

        expect(callback).toHaveBeenCalled();
      });

      it('should handle errors in fallback mode', async () => {
        const error = new Error('Callback error');
        const callback = vi.fn().mockRejectedValue(error);
        const onError = vi.fn();

        // Remove View Transitions support
        const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
        if (descriptor?.configurable) {
          delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
        }

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await expect(withViewTransition(callback, { onError })).rejects.toThrow(error);
        expect(onError).toHaveBeenCalledWith(error);
      });

      it('should handle synchronous errors in fallback mode', async () => {
        const error = new Error('Sync error');
        const callback = vi.fn().mockImplementation(() => {
          throw error;
        });
        const onError = vi.fn();

        // Remove View Transitions support
        const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
        if (descriptor?.configurable) {
          delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
        }

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await expect(withViewTransition(callback, { onError })).rejects.toThrow(error);
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    describe('edge cases', () => {
      it('should handle ready promise rejection gracefully', async () => {
        const callback = vi.fn();
        const mockTransition = {
          finished: Promise.resolve(),
          ready: Promise.reject(new Error('Ready failed')),
          updateCallbackDone: Promise.resolve(),
        };

        const startViewTransition = vi.fn().mockReturnValue(mockTransition);
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          configurable: true,
        });

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        // Should not throw even if ready fails
        await expect(withViewTransition(callback, { onReady: vi.fn() })).resolves.toBeUndefined();
      });

      it('should convert non-Error objects to Error in fallback', async () => {
        const callback = vi.fn().mockRejectedValue('string error');
        const onError = vi.fn();

        // Remove View Transitions support
        const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
        if (descriptor?.configurable) {
          delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
        }

        window.matchMedia = vi.fn().mockImplementation(() => ({
          matches: false,
          media: '',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }));

        await expect(withViewTransition(callback, { onError })).rejects.toThrow();
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('Integration tests', () => {
    it('should work seamlessly across different browser environments', async () => {
      const callback = vi.fn();

      // Test with View Transitions support
      const mockTransition = {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };

      const startViewTransition = vi.fn().mockReturnValue(mockTransition);
      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        configurable: true,
      });

      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      await withViewTransition(callback);
      expect(startViewTransition).toHaveBeenCalled();

      // Reset and test without support
      const descriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
      if (descriptor?.configurable) {
        delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
      }

      const fallbackCallback = vi.fn();
      await withViewTransition(fallbackCallback);
      expect(fallbackCallback).toHaveBeenCalled();
    });

    it('should handle rapid successive calls', async () => {
      const callbacks = [vi.fn(), vi.fn(), vi.fn()];
      const mockTransition = {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };

      const startViewTransition = vi.fn().mockReturnValue(mockTransition);
      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        configurable: true,
      });

      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Call all transitions in parallel
      await Promise.all(callbacks.map((cb) => withViewTransition(cb)));

      expect(startViewTransition).toHaveBeenCalledTimes(3);
    });
  });
});
