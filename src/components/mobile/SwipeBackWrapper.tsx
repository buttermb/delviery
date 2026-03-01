/**
 * Swipe Back Wrapper Component
 * Enables swipe-to-go-back navigation on detail pages
 */

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { haptics } from '@/utils/haptics';
import { ChevronLeft } from 'lucide-react';

interface SwipeBackWrapperProps {
  children: React.ReactNode;
  /** Custom back navigation function */
  onBack?: () => void;
  /** Swipe threshold in pixels (default: 100) */
  threshold?: number;
  /** Whether swipe-back is enabled (default: true) */
  enabled?: boolean;
  /** Additional className */
  className?: string;
}

export function SwipeBackWrapper({
  children,
  onBack,
  threshold = 100,
  enabled = true,
  className,
}: SwipeBackWrapperProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isGesturing, setIsGesturing] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);

  const handleBack = useCallback(() => {
    haptics.medium();
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }, [onBack, navigate]);

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start from left edge (first 20px)
      if (e.touches[0].clientX > 30) return;
      
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      isHorizontalRef.current = null;
      setIsGesturing(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isGesturing) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - startXRef.current;
      const deltaY = currentY - startYRef.current;

      // Determine if horizontal or vertical scroll on first significant move
      if (isHorizontalRef.current === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      // If vertical scroll, cancel the gesture
      if (isHorizontalRef.current === false) {
        setIsGesturing(false);
        setTranslateX(0);
        return;
      }

      // Only allow right swipe (positive deltaX)
      if (deltaX > 0 && isHorizontalRef.current) {
        e.preventDefault();
        // Apply resistance
        const resistance = 0.4;
        const translate = Math.min(deltaX * resistance, 150);
        setTranslateX(translate);

        // Haptic at threshold
        if (translate >= threshold * 0.9 && translate < threshold) {
          haptics.light();
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isGesturing) return;

      if (translateX >= threshold * 0.8) {
        // Trigger back navigation
        setTranslateX(window.innerWidth);
        setTimeout(handleBack, 150);
      } else {
        // Snap back
        setTranslateX(0);
      }
      setIsGesturing(false);
      isHorizontalRef.current = null;
    };

    const handleTouchCancel = () => {
      setIsGesturing(false);
      setTranslateX(0);
      isHorizontalRef.current = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, isGesturing, translateX, threshold, handleBack]);

  // Calculate opacity for the back indicator
  const indicatorOpacity = Math.min(translateX / threshold, 1);
  const showIndicator = translateX > 20;

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* Back indicator */}
      {enabled && showIndicator && (
        <div
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
          style={{
            opacity: indicatorOpacity,
            transform: `translateX(${Math.min(translateX * 0.5, 40)}px) translateY(-50%)`,
          }}
        >
          <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
            <ChevronLeft className="w-6 h-6 text-primary-foreground" />
          </div>
        </div>
      )}

      {/* Main content with transform */}
      <div
        className="min-h-full"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isGesturing ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>

      {/* Shadow overlay during swipe */}
      {enabled && translateX > 0 && (
        <div
          className="fixed inset-0 bg-black pointer-events-none"
          style={{
            opacity: Math.min(translateX / 300, 0.3),
            transition: isGesturing ? 'none' : 'opacity 0.2s ease-out',
          }}
        />
      )}
    </div>
  );
}

/**
 * Hook to detect if device supports touch gestures
 */
export function useTouchDevice() {
  return useMemo(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0, []);
}

/**
 * Hook to detect if running as PWA
 */
export function useIsPWA() {
  return useMemo(() => {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }, []);
}

