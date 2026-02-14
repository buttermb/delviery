/**
 * useViewTransition Hook
 *
 * Wraps navigation with the View Transitions API for smooth panel switching.
 * Falls back gracefully on browsers without support using CSS animations.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
 */

import { useCallback, useRef } from 'react';
import { useNavigate, NavigateOptions } from 'react-router-dom';

interface ViewTransitionOptions extends NavigateOptions {
    /** Skip view transition even if supported */
    skipTransition?: boolean;
    /** Duration of fallback animation in milliseconds */
    fallbackDuration?: number;
}

/**
 * Check if View Transitions API is supported
 */
const supportsViewTransitions = (): boolean => {
    return typeof document !== 'undefined' &&
        'startViewTransition' in document;
};

/**
 * Check if user prefers reduced motion
 */
const prefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Apply CSS-based fallback animation for browsers without View Transitions API
 */
const applyFallbackAnimation = (
    element: HTMLElement,
    duration: number,
    callback: () => void
): void => {
    // Skip if user prefers reduced motion
    if (prefersReducedMotion()) {
        callback();
        return;
    }

    // Add transition classes
    element.classList.add('route-transition-fallback');
    element.classList.add('route-transition-enter');

    // Force reflow to ensure animation plays
    void element.offsetHeight;

    // Activate the animation
    element.classList.add('route-transition-enter-active');

    // Execute callback immediately (navigation happens during animation)
    callback();

    // Clean up after animation completes
    setTimeout(() => {
        element.classList.remove('route-transition-enter');
        element.classList.remove('route-transition-enter-active');
    }, duration);
};

/**
 * Hook that provides navigation with View Transitions API support
 * and CSS fallback for unsupported browsers
 *
 * Usage:
 * ```tsx
 * const { navigateWithTransition } = useViewTransition();
 *
 * // Navigate with smooth transition
 * navigateWithTransition('/admin/orders');
 * ```
 */
export function useViewTransition() {
    const navigate = useNavigate();
    const timeoutRef = useRef<number>();

    const navigateWithTransition = useCallback(
        (to: string, options?: ViewTransitionOptions) => {
            const { skipTransition, fallbackDuration = 200, ...navigateOptions } = options || {};

            // Clear any existing timeout
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }

            // Use View Transitions API if supported and not skipped
            if (supportsViewTransitions() && !skipTransition) {
                // Type assertion needed as TypeScript doesn't know about startViewTransition
                (document as any).startViewTransition(() => {
                    navigate(to, navigateOptions);
                });
            } else if (!skipTransition) {
                // Fallback: CSS-based animation
                const mainElement = document.querySelector('main[role="main"]') as HTMLElement ||
                                   document.querySelector('[data-route-content]') as HTMLElement ||
                                   document.body;

                if (mainElement) {
                    applyFallbackAnimation(mainElement, fallbackDuration, () => {
                        navigate(to, navigateOptions);
                    });
                } else {
                    // No suitable element found, navigate without animation
                    navigate(to, navigateOptions);
                }
            } else {
                // Transition skipped, navigate immediately
                navigate(to, navigateOptions);
            }
        },
        [navigate]
    );

    return {
        navigateWithTransition,
        supportsViewTransitions: supportsViewTransitions(),
        prefersReducedMotion: prefersReducedMotion(),
    };
}

/**
 * CSS to add to your app for view transitions:
 * 
 * ```css
 * ::view-transition-old(root) {
 *   animation: fade-out 150ms ease-out;
 * }
 * 
 * ::view-transition-new(root) {
 *   animation: fade-in 150ms ease-in;
 * }
 * 
 * @keyframes fade-out {
 *   from { opacity: 1; }
 *   to { opacity: 0; }
 * }
 * 
 * @keyframes fade-in {
 *   from { opacity: 0; }
 *   to { opacity: 1; }
 * }
 * ```
 */

export default useViewTransition;
