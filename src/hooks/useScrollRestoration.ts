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

interface ScrollPositionCache {
  [pathname: string]: number;
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
 * Hook to preserve scroll position when navigating between pages
 *
 * Saves the current scroll position before navigation and restores it
 * when returning to a previously visited page.
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

  // Save scroll position before navigating away
  const saveCurrentScrollPosition = useCallback(() => {
    if (previousPathnameRef.current) {
      const positions = getScrollPositions();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      positions[previousPathnameRef.current] = scrollTop;
      saveScrollPositions(positions);
    }
  }, []);

  // Handle pathname changes
  useEffect(() => {
    // Skip on initial mount - we want to let the browser handle initial load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousPathnameRef.current = pathname;
      return;
    }

    // Save the scroll position of the previous page
    saveCurrentScrollPosition();

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
      return () => clearTimeout(timeoutId);
    } else {
      restoreScroll();
    }

    // Update previous pathname for next navigation
    previousPathnameRef.current = pathname;
  }, [pathname, scrollBehavior, restoreDelay, saveCurrentScrollPosition]);

  // Save scroll position when leaving the page (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (previousPathnameRef.current) {
        const positions = getScrollPositions();
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
