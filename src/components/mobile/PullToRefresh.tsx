import { useEffect, useRef, useState } from 'react';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/utils/mobile';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;
  const MAX_PULL = 150;

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (startY.current === 0 || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;

    if (distance > 0 && window.scrollY === 0) {
      // Add resistance
      const dampedDistance = Math.min(distance * 0.5, MAX_PULL);
      setPullDistance(dampedDistance);
      setIsPulling(true);

      // Prevent default pull-to-refresh from browser
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling || isRefreshing) return;

    if (pullDistance > THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD); // Snap to threshold
      triggerHaptic('medium');

      try {
        await onRefresh();
        triggerHaptic('light');
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setIsPulling(false);
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }

    startY.current = 0;
  };

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing, isPulling, pullDistance]);

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
