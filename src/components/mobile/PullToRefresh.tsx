import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { haptics } from "@/utils/haptics";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function PullToRefresh({ children, onRefresh, disabled = false, className }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const threshold = 80;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled || isRefreshing) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      setIsPulling(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      if (!isPulling && e.touches[0].clientY > startY.current) {
        setIsPulling(true);
      }
      
      if (isPulling && e.touches[0].clientY > startY.current) {
        const distance = e.touches[0].clientY - startY.current;
        if (distance > 0) {
          setPullDistance(Math.min(distance, threshold));
        }
      }
    };

    const handleTouchEnd = async () => {
      if (window.scrollY > 0) return;
      
      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        haptics.medium();
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, onRefresh, isPulling, isRefreshing, disabled]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all"
          style={{ 
            height: `${Math.min(pullDistance * 1.5, 100)}px`,
            opacity: Math.min(pullDistance / threshold, 1)
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {pullDistance >= threshold ? "Release to refresh" : "Pull down to refresh"}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

