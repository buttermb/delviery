/**
 * Hook for navigation with View Transitions API fallback
 *
 * This hook provides a consistent navigation function that:
 * - Uses View Transitions API when supported
 * - Falls back to smooth CSS transitions when not supported
 * - Respects user's reduced motion preferences
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const navigate = useNavigateWithTransition();
 *
 *   return (
 *     <button onClick={() => navigate('/path')}>
 *       Navigate
 *     </button>
 *   );
 * }
 * ```
 */

import { useNavigate, type NavigateOptions } from 'react-router-dom';
import { useViewTransitionSupport } from './useViewTransitionSupport';
import { useCallback } from 'react';

export function useNavigateWithTransition() {
  const navigate = useNavigate();
  const supportsViewTransitions = useViewTransitionSupport();

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      // If View Transitions are supported, use them
      if (supportsViewTransitions && typeof to === 'string') {
        navigate(to, { ...options, viewTransition: true });
        return;
      }

      // Otherwise, use standard navigation with CSS fallback
      // The CSS fallback will be applied via the route-transition-fallback class
      if (typeof to === 'string') {
        navigate(to, options);
      } else {
        // Handle numeric navigation (back/forward)
        navigate(to);
      }
    },
    [navigate, supportsViewTransitions]
  );
}
