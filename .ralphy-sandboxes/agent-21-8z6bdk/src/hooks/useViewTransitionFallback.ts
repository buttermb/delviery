/**
 * View Transition Fallback Hook
 *
 * Provides a smooth transition fallback for browsers that don't support
 * the View Transitions API. Uses CSS animations to create similar effects.
 *
 * Features:
 * - Automatic detection of View Transitions support
 * - CSS-based fallback animations
 * - Respects prefers-reduced-motion
 * - Works with React Router navigation
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useViewTransitionSupport } from './useViewTransitionSupport';

interface ViewTransitionFallbackOptions {
  /** Duration of the fallback animation in milliseconds */
  duration?: number;
  /** Whether to enable the fallback (defaults to true) */
  enabled?: boolean;
  /** CSS class to apply during transition */
  transitionClass?: string;
}

/**
 * Hook that provides smooth route transitions with automatic fallback
 * for browsers without View Transitions API support
 *
 * @param options Configuration options for the fallback behavior
 * @returns Object with transition state and utilities
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isTransitioning, containerRef } = useViewTransitionFallback();
 *
 *   return (
 *     <div ref={containerRef}>
 *       <Routes />
 *     </div>
 *   );
 * }
 * ```
 */
export function useViewTransitionFallback(
  options: ViewTransitionFallbackOptions = {}
) {
  const {
    duration = 200,
    enabled = true,
    transitionClass = 'route-transition-fallback'
  } = options;

  const location = useLocation();
  const supportsViewTransitions = useViewTransitionSupport();
  const containerRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const timeoutRef = useRef<number>();

  // Check if user prefers reduced motion
  const prefersReducedMotion = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Apply fallback animation on route change
  useEffect(() => {
    // Skip if:
    // - View Transitions are supported (browser handles it)
    // - Fallback is disabled
    // - User prefers reduced motion
    // - No container ref
    if (
      supportsViewTransitions ||
      !enabled ||
      prefersReducedMotion() ||
      !containerRef.current
    ) {
      return;
    }

    const container = containerRef.current;
    isTransitioningRef.current = true;

    // Clear any existing timeout
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    // Add transition classes
    container.classList.add(transitionClass);
    container.classList.add('route-transition-enter');

    // Force reflow to ensure animation plays
    void container.offsetHeight;

    // Activate the animation
    container.classList.add('route-transition-enter-active');

    // Clean up after animation completes
    timeoutRef.current = window.setTimeout(() => {
      if (container) {
        container.classList.remove('route-transition-enter');
        container.classList.remove('route-transition-enter-active');
      }
      isTransitioningRef.current = false;
    }, duration);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [location, supportsViewTransitions, enabled, duration, transitionClass, prefersReducedMotion]);

  return {
    /** Whether a transition is currently in progress */
    isTransitioning: isTransitioningRef.current,
    /** Ref to attach to the container element */
    containerRef,
    /** Whether View Transitions API is supported */
    supportsViewTransitions,
    /** Whether reduced motion is preferred */
    prefersReducedMotion: prefersReducedMotion(),
  };
}

/**
 * Wrapper function to execute callbacks with View Transition support
 * and automatic fallback
 *
 * @param callback The function to execute during the transition
 * @param options Optional configuration
 *
 * @example
 * ```tsx
 * const navigate = useNavigate();
 *
 * const handleClick = () => {
 *   withViewTransition(() => {
 *     navigate('/new-route');
 *   });
 * };
 * ```
 */
export function withViewTransition(
  callback: () => void,
  options?: { skipTransition?: boolean }
): void {
  const { skipTransition } = options || {};

  // Check for View Transitions support
  const hasSupport = typeof document !== 'undefined' && 'startViewTransition' in document;

  if (hasSupport && !skipTransition) {
    // Use native View Transitions API
    // Type assertion needed as TypeScript doesn't have full View Transitions API types
    (document as Document & { startViewTransition: (callback: () => void) => void }).startViewTransition(callback);
  } else {
    // Fallback: execute callback immediately
    // CSS animations will be handled by useViewTransitionFallback hook
    callback();
  }
}

export default useViewTransitionFallback;
