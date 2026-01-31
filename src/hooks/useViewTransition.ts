/**
 * useViewTransition Hook
 * 
 * Wraps navigation with the View Transitions API for smooth panel switching.
 * Falls back gracefully on browsers without support.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
 */

import { useCallback } from 'react';
import { useNavigate, NavigateOptions } from 'react-router-dom';

interface ViewTransitionOptions extends NavigateOptions {
    /** Skip view transition even if supported */
    skipTransition?: boolean;
}

/**
 * Check if View Transitions API is supported
 */
const supportsViewTransitions = (): boolean => {
    return typeof document !== 'undefined' &&
        'startViewTransition' in document;
};

/**
 * Hook that provides navigation with View Transitions API support
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

    const navigateWithTransition = useCallback(
        (to: string, options?: ViewTransitionOptions) => {
            const { skipTransition, ...navigateOptions } = options || {};

            // Use View Transitions API if supported and not skipped
            if (supportsViewTransitions() && !skipTransition) {
                // Type assertion needed as TypeScript doesn't know about startViewTransition
                (document as any).startViewTransition(() => {
                    navigate(to, navigateOptions);
                });
            } else {
                // Fallback: regular navigation
                navigate(to, navigateOptions);
            }
        },
        [navigate]
    );

    return {
        navigateWithTransition,
        supportsViewTransitions: supportsViewTransitions(),
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
