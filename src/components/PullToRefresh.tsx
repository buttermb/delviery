import { useState, useEffect, useRef, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (touchStart === 0 || isRefreshing) return;

    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStart;

    if (distance > 0 && window.scrollY === 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance * 0.5, MAX_PULL));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    setTouchStart(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStart, pullDistance, isRefreshing]);

  const rotation = (pullDistance / PULL_THRESHOLD) * 360;
  const opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="absolute top-0 left-0 right-0 flex justify-center items-center transition-all"
        style={{
          height: `${pullDistance}px`,
          opacity,
        }}
      >
        <div className="bg-background rounded-full p-2 shadow-lg">
          <RefreshCw
            className={`w-6 h-6 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`,
            }}
          />
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${isRefreshing ? PULL_THRESHOLD : pullDistance}px)`,
          transition: isRefreshing ? 'transform 0.2s ease' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};
