import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';

/**
 * Storage key for scroll positions in sessionStorage
 * Uses sessionStorage because scroll positions are transient and shouldn't persist
 * across browser sessions
 */
const SCROLL_STORAGE_KEY = STORAGE_KEYS.SCROLL_POSITIONS;

/**
 * Maximum number of scroll positions to cache
 * Prevents unbounded memory growth in sessionStorage
 */
const MAX_CACHED_POSITIONS = 50;

/**
 * Throttle interval for scroll tracking (ms)
 * Balances accuracy with performance
 */
const SCROLL_THROTTLE_MS = 100;

interface ScrollPositionCache {
  [pathname: string]: number;
}

/**
 * Module-level ref to track current scroll position continuously
 * This ensures we always have the latest position available before navigation
 */
let currentScrollTop = 0;
let lastScrollUpdate = 0;

/**
 * Get current scroll position (uses cached value for performance)
 */
function getCurrentScrollTop(): number {
  return currentScrollTop;
}

/**
 * Update the cached scroll position (called on scroll events)
 */
function updateCurrentScrollTop(): void {
  const now = Date.now();
  if (now - lastScrollUpdate >= SCROLL_THROTTLE_MS) {
    currentScrollTop = window.scrollY || document.documentElement.scrollTop;
    lastScrollUpdate = now;
  }
}

/**
 * Safely get scroll positions from sessionStorage
 */
function getScrollPositions(): ScrollPositionCache {
  try {
    const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ScrollPositionCache;
    }
  } catch (error) {
    logger.warn('Error reading scroll positions from sessionStorage:', error);
  }
  return {};
}

/**
 * Safely save scroll positions to sessionStorage
 */
function saveScrollPositions(positions: ScrollPositionCache): void {
  try {
    // Prune old entries if we have too many
    const keys = Object.keys(positions);
    if (keys.length > MAX_CACHED_POSITIONS) {
      // Keep only the most recent entries (simple FIFO-like behavior)
      const toRemove = keys.slice(0, keys.length - MAX_CACHED_POSITIONS);
      toRemove.forEach((key) => delete positions[key]);
    }
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
  } catch (error) {
    logger.warn('Error saving scroll positions to sessionStorage:', error);
  }
}

/**
 * Save scroll position for a specific pathname
 * Can be called before programmatic navigation
 */
export function saveScrollPositionForPath(pathname: string): void {
  // Get the most current scroll position
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const positions = getScrollPositions();
  positions[pathname] = scrollTop;
  saveScrollPositions(positions);
}

/**
 * Hook to preserve scroll position when navigating between pages
 *
 * Saves the current scroll position BEFORE navigation and restores it
 * when returning to a previously visited page.
 *
 * Key improvements:
 * - Continuously tracks scroll position to capture accurate values before navigation
 * - Intercepts link clicks to save position before navigation starts
 * - Handles browser back/forward with popstate events
 * - Supports programmatic navigation via saveScrollPositionForPath export
 *
 * @param options - Configuration options
 * @param options.scrollBehavior - 'auto' for instant scroll, 'smooth' for animated
 * @param options.restoreDelay - Delay in ms before restoring scroll (for async content)
 *
 * @example
 * // In your App or layout component
 * function App() {
 *   useScrollRestoration();
 *   return <Routes>...</Routes>;
 * }
 */
export function useScrollRestoration(options?: {
  scrollBehavior?: ScrollBehavior;
  restoreDelay?: number;
}): void {
  const { scrollBehavior = 'instant', restoreDelay = 0 } = options ?? {};
  const { pathname } = useLocation();
  const previousPathnameRef = useRef<string | null>(null);
  const isInitialMount = useRef(true);
  const lastSavedPathRef = useRef<string | null>(null);

  // Save scroll position for the current/previous page
  const saveCurrentScrollPosition = useCallback((forPath?: string) => {
    const targetPath = forPath ?? previousPathnameRef.current;
    if (targetPath && targetPath !== lastSavedPathRef.current) {
      const positions = getScrollPositions();
      // Use the tracked scroll position for accuracy
      const scrollTop = getCurrentScrollTop();
      positions[targetPath] = scrollTop;
      saveScrollPositions(positions);
      lastSavedPathRef.current = targetPath;
    }
  }, []);

  // Continuously track scroll position
  useEffect(() => {
    const handleScroll = () => {
      updateCurrentScrollTop();
    };

    // Initialize current scroll position
    currentScrollTop = window.scrollY || document.documentElement.scrollTop;

    // Use passive listener for performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intercept link clicks to save scroll position BEFORE navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && anchor.href) {
        // Check if this is an internal navigation (same origin)
        try {
          const url = new URL(anchor.href);
          if (url.origin === window.location.origin && url.pathname !== pathname) {
            // Force update scroll position before navigation
            currentScrollTop = window.scrollY || document.documentElement.scrollTop;
            saveCurrentScrollPosition(pathname);
          }
        } catch {
          // Invalid URL, ignore
        }
      }
    };

    // Use capture phase to ensure we run before React Router
    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [pathname, saveCurrentScrollPosition]);

  // Handle browser back/forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      // On popstate, the browser handles scroll restoration by default
      // We just need to ensure our saved position is available
      // The pathname effect below will handle restoration
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle pathname changes - restore scroll position
  useEffect(() => {
    // Skip on initial mount - let the browser handle initial load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousPathnameRef.current = pathname;
      // Reset the last saved path on initial mount
      lastSavedPathRef.current = null;
      return;
    }

    // Save scroll position of the page we're leaving (fallback if click handler missed it)
    // Use the current window scroll position as final save
    if (previousPathnameRef.current && previousPathnameRef.current !== lastSavedPathRef.current) {
      const positions = getScrollPositions();
      const scrollTop = getCurrentScrollTop();
      positions[previousPathnameRef.current] = scrollTop;
      saveScrollPositions(positions);
    }

    // Restore scroll position for the new page, or scroll to top
    const positions = getScrollPositions();
    const savedPosition = positions[pathname];

    const restoreScroll = () => {
      if (savedPosition !== undefined && savedPosition > 0) {
        // Restore previous scroll position
        window.scrollTo({
          top: savedPosition,
          behavior: scrollBehavior,
        });
      } else {
        // No saved position, scroll to top
        window.scrollTo({
          top: 0,
          behavior: 'instant',
        });
      }
    };

    if (restoreDelay > 0) {
      // Delay restoration for pages with async content
      const timeoutId = setTimeout(restoreScroll, restoreDelay);
      // Update previous pathname after scheduling restore
      previousPathnameRef.current = pathname;
      lastSavedPathRef.current = null;
      return () => clearTimeout(timeoutId);
    } else {
      restoreScroll();
    }

    // Update previous pathname for next navigation
    previousPathnameRef.current = pathname;
    lastSavedPathRef.current = null;
  }, [pathname, scrollBehavior, restoreDelay, saveCurrentScrollPosition]);

  // Save scroll position when leaving the page (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (previousPathnameRef.current) {
        const positions = getScrollPositions();
        // Get fresh scroll position for final save
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        positions[previousPathnameRef.current] = scrollTop;
        saveScrollPositions(positions);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}

/**
 * Hook to manually save the current scroll position
 * Useful for programmatic navigation where you want to preserve scroll
 *
 * @returns Function to save current scroll position for a given path
 */
export function useSaveScrollPosition(): (pathname?: string) => void {
  const { pathname: currentPathname } = useLocation();

  return useCallback(
    (pathname?: string) => {
      const targetPath = pathname ?? currentPathname;
      const positions = getScrollPositions();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      positions[targetPath] = scrollTop;
      saveScrollPositions(positions);
    },
    [currentPathname]
  );
}

/**
 * Clear all saved scroll positions
 * Useful when logging out or resetting app state
 */
export function clearScrollPositions(): void {
  try {
    sessionStorage.removeItem(SCROLL_STORAGE_KEY);
  } catch (error) {
    logger.warn('Error clearing scroll positions:', error);
  }
}
