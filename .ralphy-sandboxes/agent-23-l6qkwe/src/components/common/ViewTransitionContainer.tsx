/**
 * ViewTransitionContainer Component
 *
 * A container component that automatically handles View Transitions
 * with fallback support for browsers that don't support the API.
 *
 * Features:
 * - Automatic View Transitions API detection
 * - CSS-based fallback animations
 * - Respects user's reduced motion preferences
 * - Zero configuration required
 *
 * @example
 * ```tsx
 * import { ViewTransitionContainer } from '@/components/common/ViewTransitionContainer';
 *
 * function App() {
 *   return (
 *     <ViewTransitionContainer>
 *       <Routes />
 *     </ViewTransitionContainer>
 *   );
 * }
 * ```
 */

import React from 'react';
import { useViewTransitionFallback } from '@/hooks/useViewTransitionFallback';
import { cn } from '@/lib/utils';

interface ViewTransitionContainerProps {
  /** Child components to render */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Duration of fallback animation in milliseconds */
  duration?: number;
  /** Whether to enable transitions */
  enabled?: boolean;
  /** Custom transition class */
  transitionClass?: string;
}

/**
 * Container component that provides smooth transitions between routes
 * with automatic fallback for unsupported browsers
 */
export function ViewTransitionContainer({
  children,
  className,
  duration = 200,
  enabled = true,
  transitionClass,
}: ViewTransitionContainerProps) {
  const { containerRef, supportsViewTransitions, prefersReducedMotion } =
    useViewTransitionFallback({
      duration,
      enabled,
      transitionClass,
    });

  return (
    <div
      ref={containerRef}
      className={cn(className)}
      data-view-transition-container
      data-supports-view-transitions={supportsViewTransitions}
      data-prefers-reduced-motion={prefersReducedMotion}
    >
      {children}
    </div>
  );
}

export default ViewTransitionContainer;
