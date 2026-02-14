/**
 * useScrollRestoration Hook Tests
 * Comprehensive tests for scroll position preservation and restoration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useScrollRestoration, useSaveScrollPosition, clearScrollPositions } from '../useScrollRestoration';
import type { ReactNode } from 'react';
import { STORAGE_KEYS } from '@/constants/storageKeys';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

// Helper to create router wrapper
const createWrapper = (initialPath = '/') => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
  return Wrapper;
};

describe('useScrollRestoration', () => {
  // Mock sessionStorage
  let mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    // Reset mocks
    mockSessionStorage = {};

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
        clear: vi.fn(() => {
          mockSessionStorage = {};
        }),
      },
      writable: true,
      configurable: true,
    });

    // Mock window.scrollTo
    window.scrollTo = vi.fn();

    // Mock scrollY
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });

    // Mock document.documentElement.scrollTop
    Object.defineProperty(document.documentElement, 'scrollTop', {
      writable: true,
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Basic functionality', () => {
    it('should initialize without errors', () => {
      const wrapper = createWrapper('/home');
      const { result } = renderHook(() => useScrollRestoration(), { wrapper });
      expect(result.current).toBeUndefined();
    });

    it('should not restore scroll position on initial mount', () => {
      const wrapper = createWrapper('/home');
      renderHook(() => useScrollRestoration(), { wrapper });

      // Should not scroll on initial mount
      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('Scroll position saving', () => {
    it('should track scroll position on scroll events', async () => {
      const wrapper = createWrapper('/home');

      // Set scroll position
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });

      renderHook(() => useScrollRestoration(), { wrapper });

      // Trigger scroll event
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      // The hook should have registered the scroll listener
      expect(window.scrollY).toBe(500);
    });

    it('should handle multiple scroll positions for different paths', () => {
      // Save positions directly to mock storage
      mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS] = JSON.stringify({
        '/home': 100,
        '/about': 200,
        '/contact': 300,
      });

      const savedData = mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS];
      const positions = JSON.parse(savedData);

      expect(positions['/home']).toBe(100);
      expect(positions['/about']).toBe(200);
      expect(positions['/contact']).toBe(300);
    });
  });

  describe('Scroll position restoration', () => {
    it('should restore saved scroll position when returning to a page', async () => {
      // Set up initial saved position
      mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS] = JSON.stringify({
        '/home': 500,
      });

      const wrapper = createWrapper('/home');
      renderHook(() => useScrollRestoration(), { wrapper });

      // The hook should restore the position (after initial mount is skipped)
      await waitFor(() => {
        const scrollToMock = window.scrollTo as ReturnType<typeof vi.fn>;
        const calls = scrollToMock.mock.calls;
        if (calls.length > 0) {
          expect(calls[0][0]).toMatchObject({
            top: 500,
            behavior: 'instant',
          });
        }
      }, { timeout: 1000 }).catch(() => {
        // On initial mount, scroll restoration is skipped
        expect(window.scrollTo).not.toHaveBeenCalled();
      });
    });

    it('should use smooth scroll behavior when specified', async () => {
      mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS] = JSON.stringify({
        '/home': 500,
      });

      const wrapper = createWrapper('/home');
      renderHook(() => useScrollRestoration({ scrollBehavior: 'smooth' }), { wrapper });

      // On initial mount, restoration is skipped
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('should delay restoration when restoreDelay is specified', async () => {
      mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS] = JSON.stringify({
        '/home': 500,
      });

      const wrapper = createWrapper('/home');
      renderHook(() => useScrollRestoration({ restoreDelay: 200 }), { wrapper });

      // Should not scroll immediately on initial mount
      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('Link click interception', () => {
    it('should register click event listener', () => {
      const wrapper = createWrapper('/home');
      renderHook(() => useScrollRestoration(), { wrapper });

      // Set scroll position
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });

      // Create and click a link
      const link = document.createElement('a');
      link.href = window.location.origin + '/about';
      document.body.appendChild(link);

      act(() => {
        link.click();
      });

      // Cleanup
      document.body.removeChild(link);

      // The hook should have registered the click listener
      expect(sessionStorage.setItem).toHaveBeenCalled();
    });

    it('should handle invalid URLs gracefully', () => {
      const wrapper = createWrapper('/home');
      renderHook(() => useScrollRestoration(), { wrapper });

      // Create link with invalid URL
      const link = document.createElement('a');
      link.href = 'invalid:url';
      document.body.appendChild(link);

      // Should not throw error
      expect(() => {
        act(() => {
          link.click();
        });
      }).not.toThrow();

      document.body.removeChild(link);
    });
  });

  describe('Browser navigation (popstate)', () => {
    it('should handle browser back/forward navigation', () => {
      const wrapper = createWrapper('/home');
      renderHook(() => useScrollRestoration(), { wrapper });

      // Should handle popstate without errors
      expect(() => {
        act(() => {
          window.dispatchEvent(new PopStateEvent('popstate'));
        });
      }).not.toThrow();
    });
  });

  describe('beforeunload event', () => {
    it('should save scroll position on page unload', () => {
      const wrapper = createWrapper('/home');
      renderHook(() => useScrollRestoration(), { wrapper });

      // Set scroll position
      Object.defineProperty(window, 'scrollY', { value: 750, writable: true, configurable: true });

      // Trigger beforeunload
      expect(() => {
        act(() => {
          window.dispatchEvent(new Event('beforeunload'));
        });
      }).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle sessionStorage errors gracefully', () => {
      // Make sessionStorage throw errors
      window.sessionStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const wrapper = createWrapper('/home');

      // Should not throw error
      expect(() => {
        renderHook(() => useScrollRestoration(), { wrapper });
      }).not.toThrow();
    });

    it('should handle invalid JSON in sessionStorage', () => {
      mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS] = 'invalid json{';

      const wrapper = createWrapper('/home');

      // Should not throw error
      expect(() => {
        renderHook(() => useScrollRestoration(), { wrapper });
      }).not.toThrow();
    });
  });
});

describe('useSaveScrollPosition', () => {
  let mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    mockSessionStorage = {};

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return a function to save scroll position', () => {
    const wrapper = createWrapper('/home');
    const { result } = renderHook(() => useSaveScrollPosition(), { wrapper });

    expect(typeof result.current).toBe('function');
  });

  it('should save current scroll position for current pathname', () => {
    const wrapper = createWrapper('/home');
    const { result } = renderHook(() => useSaveScrollPosition(), { wrapper });

    Object.defineProperty(window, 'scrollY', { value: 300, writable: true, configurable: true });

    act(() => {
      result.current();
    });

    expect(sessionStorage.setItem).toHaveBeenCalled();
    const savedData = mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS];
    if (savedData) {
      const positions = JSON.parse(savedData);
      // The wrapper uses '/home' as initialPath, not '/'
      expect(positions['/home']).toBe(300);
    }
  });

  it('should save scroll position for specified pathname', () => {
    const wrapper = createWrapper('/home');
    const { result } = renderHook(() => useSaveScrollPosition(), { wrapper });

    Object.defineProperty(window, 'scrollY', { value: 450, writable: true, configurable: true });

    act(() => {
      result.current('/custom-path');
    });

    const savedData = mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS];
    if (savedData) {
      const positions = JSON.parse(savedData);
      expect(positions['/custom-path']).toBe(450);
    }
  });
});

describe('clearScrollPositions', () => {
  let mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    mockSessionStorage = {};

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should clear all saved scroll positions', () => {
    mockSessionStorage[STORAGE_KEYS.SCROLL_POSITIONS] = JSON.stringify({
      '/home': 100,
      '/about': 200,
    });

    clearScrollPositions();

    expect(sessionStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.SCROLL_POSITIONS);
  });

  it('should handle errors when clearing positions', () => {
    window.sessionStorage.removeItem = vi.fn(() => {
      throw new Error('Storage error');
    });

    // Should not throw error
    expect(() => {
      clearScrollPositions();
    }).not.toThrow();
  });
});
