import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/utils/mobile';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

/** Walk up the DOM to find the nearest scrollable ancestor */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  let current = el.parentElement;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') return current;
    current = current.parentElement;
  }
  return null;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);

  // Track state in refs to avoid stale closures in touch handlers
  const isRefreshingRef = useRef(false);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  isRefreshingRef.current = isRefreshing;
  isPullingRef.current = isPulling;
  pullDistanceRef.current = pullDistance;

  const THRESHOLD = 80;
  const MAX_PULL = 150;

  /** Check if content is scrolled to top (works for both overflow containers and window) */
  const isAtTop = useCallback((): boolean => {
    const scrollParent = scrollParentRef.current;
    if (scrollParent) return scrollParent.scrollTop <= 0;
    return window.scrollY <= 0;
  }, []);

  // Find scroll parent on mount
  useEffect(() => {
    scrollParentRef.current = getScrollParent(contentRef.current);
  }, []);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isAtTop() && !isRefreshingRef.current) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0 || isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0 && isAtTop()) {
        // Add resistance
        const dampedDistance = Math.min(distance * 0.5, MAX_PULL);
        setPullDistance(dampedDistance);
        pullDistanceRef.current = dampedDistance;
        setIsPulling(true);
        isPullingRef.current = true;

        // Prevent default pull-to-refresh from browser
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current || isRefreshingRef.current) return;

      if (pullDistanceRef.current > THRESHOLD) {
        setIsRefreshing(true);
        isRefreshingRef.current = true;
        setPullDistance(THRESHOLD); // Snap to threshold
        triggerHaptic('medium');

        try {
          await onRefresh();
          triggerHaptic('light');
        } finally {
          setIsRefreshing(false);
          isRefreshingRef.current = false;
          setPullDistance(0);
          pullDistanceRef.current = 0;
          setIsPulling(false);
          isPullingRef.current = false;
        }
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
        setIsPulling(false);
        isPullingRef.current = false;
      }

      startY.current = 0;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isAtTop, onRefresh]);

  return (
    <div ref={contentRef} className={cn("relative min-h-full", className)}>
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-10"
        style={{
          height: `${pullDistance}px`,
          opacity: Math.min(pullDistance / THRESHOLD, 1),
          transition: isPulling ? 'none' : 'height 0.3s ease-out, opacity 0.3s ease-out'
        }}
      >
        {isRefreshing ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : (
          <div className={cn(
            "text-sm font-medium transition-colors",
            pullDistance > THRESHOLD ? "text-primary" : "text-muted-foreground"
          )}>
            {pullDistance > THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}
