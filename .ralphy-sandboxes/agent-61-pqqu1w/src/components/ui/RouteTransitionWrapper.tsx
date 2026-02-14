/**
 * Route Transition Wrapper Component
 *
 * Provides smooth page transitions with automatic fallback for browsers
 * that don't support the View Transitions API.
 *
 * Features:
 * - Automatic detection of View Transitions API support
 * - CSS-based fallback transitions for unsupported browsers
 * - Respects user's reduced motion preferences
 * - Zero configuration - just wrap your route content
 *
 * @example
 * ```tsx
 * <RouteTransitionWrapper>
 *   <YourPageContent />
 * </RouteTransitionWrapper>
 * ```
 */

import { type ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useViewTransitionSupport } from '@/hooks/useViewTransitionSupport';
import { cn } from '@/lib/utils';

interface RouteTransitionWrapperProps {
  children: ReactNode;
  className?: string;
}

export function RouteTransitionWrapper({
  children,
  className,
}: RouteTransitionWrapperProps) {
  const location = useLocation();
  const supportsViewTransitions = useViewTransitionSupport();
  const contentRef = useRef<HTMLDivElement>(null);
  const prevLocationRef = useRef(location.pathname);

  useEffect(() => {
    // Only apply fallback animation if View Transitions API is not supported
    if (!supportsViewTransitions && contentRef.current) {
      const hasLocationChanged = prevLocationRef.current !== location.pathname;

      if (hasLocationChanged) {
        // Trigger enter animation by adding class
        contentRef.current.classList.add('route-transition-enter');
        contentRef.current.classList.add('route-transition-enter-active');

        // Remove animation classes after animation completes
        const timeoutId = setTimeout(() => {
          if (contentRef.current) {
            contentRef.current.classList.remove('route-transition-enter');
            contentRef.current.classList.remove('route-transition-enter-active');
          }
        }, 200); // Match animation duration in CSS

        prevLocationRef.current = location.pathname;

        return () => clearTimeout(timeoutId);
      }
    }
  }, [location.pathname, supportsViewTransitions]);

  return (
    <div
      ref={contentRef}
      data-route-content
      className={cn(
        // Apply fallback transition class only if View Transitions not supported
        !supportsViewTransitions && 'route-transition-fallback',
        className
      )}
    >
      {children}
    </div>
  );
}
