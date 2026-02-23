/**
 * Gesture Hooks
 * Touch gesture handling for mobile navigation and interactions
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { haptics as hapticFeedback } from '@/utils/haptics';

export interface SwipeDirection {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
  velocity: number;
}

export interface SwipeOptions {
  /** Minimum distance to trigger swipe (px) */
  threshold?: number;
  /** Minimum velocity to trigger swipe (px/ms) */
  velocityThreshold?: number;
  /** Whether to prevent default touch behavior */
  preventDefault?: boolean;
  /** Enable haptic feedback */
  haptics?: boolean;
}

/**
 * Hook for detecting swipe gestures
 */
export function useSwipe(
  onSwipe: (direction: SwipeDirection) => void,
  options: SwipeOptions = {}
) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    preventDefault = false,
    haptics = true,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startTime = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      startPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      startTime.current = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - startPos.current.x;
      const deltaY = endY - startPos.current.y;
      const deltaTime = Date.now() - startTime.current;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = distance / deltaTime;

      // Determine primary direction
      let direction: SwipeDirection['direction'] = null;
      if (distance >= threshold || velocity >= velocityThreshold) {
        if (absX > absY) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          direction = deltaY > 0 ? 'down' : 'up';
        }
      }

      if (direction) {
        if (haptics) hapticFeedback.light();
        onSwipe({ direction, distance, velocity });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (preventDefault) {
        e.preventDefault();
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefault });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [threshold, velocityThreshold, preventDefault, haptics, onSwipe]);

  return ref;
}

/**
 * Hook for swipe-to-go-back navigation
 */
export function useSwipeBack(onBack: () => void, options?: SwipeOptions) {
  return useSwipe(
    ({ direction }) => {
      if (direction === 'right') {
        onBack();
      }
    },
    { threshold: 80, ...options }
  );
}

/**
 * Hook for pull-to-refresh gesture
 */
export interface PullToRefreshOptions {
  /** Distance to pull before triggering refresh */
  threshold?: number;
  /** Maximum pull distance */
  maxPull?: number;
  /** Enable haptic feedback */
  haptics?: boolean;
}

export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  options: PullToRefreshOptions = {}
) {
  const { threshold = 80, maxPull = 120, haptics = true } = options;

  const ref = useRef<HTMLElement>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const triggered = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only enable pull-to-refresh at top of scroll
      if (element.scrollTop > 0) return;
      
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
      triggered.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;
      if (element.scrollTop > 0) {
        setIsPulling(false);
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const delta = currentY - startY.current;

      if (delta > 0) {
        e.preventDefault();
        // Apply resistance
        const resistance = 0.5;
        const distance = Math.min(delta * resistance, maxPull);
        setPullDistance(distance);

        // Haptic feedback at threshold
        if (distance >= threshold && !triggered.current) {
          triggered.current = true;
          if (haptics) hapticFeedback.medium();
        } else if (distance < threshold && triggered.current) {
          triggered.current = false;
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;

      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }

      setIsPulling(false);
      setPullDistance(0);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, threshold, maxPull, haptics, isRefreshing, onRefresh]);

  return {
    ref,
    isPulling,
    pullDistance,
    isRefreshing,
    progress: Math.min(pullDistance / threshold, 1),
  };
}

/**
 * Hook for long press detection
 */
export interface LongPressOptions {
  /** Duration in ms to trigger long press */
  duration?: number;
  /** Enable haptic feedback */
  haptics?: boolean;
}

export function useLongPress(
  onLongPress: () => void,
  options: LongPressOptions = {}
) {
  const { duration = 500, haptics = true } = options;

  const timeoutRef = useRef<NodeJS.Timeout>();
  const targetRef = useRef<HTMLElement>(null);
  const [isPressed, setIsPressed] = useState(false);

  const start = useCallback(() => {
    setIsPressed(true);
    timeoutRef.current = setTimeout(() => {
      if (haptics) hapticFeedback.medium();
      onLongPress();
    }, duration);
  }, [duration, haptics, onLongPress]);

  const stop = useCallback(() => {
    setIsPressed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchend', stop, { passive: true });
    element.addEventListener('touchcancel', stop, { passive: true });
    element.addEventListener('mousedown', start);
    element.addEventListener('mouseup', stop);
    element.addEventListener('mouseleave', stop);

    return () => {
      element.removeEventListener('touchstart', start);
      element.removeEventListener('touchend', stop);
      element.removeEventListener('touchcancel', stop);
      element.removeEventListener('mousedown', start);
      element.removeEventListener('mouseup', stop);
      element.removeEventListener('mouseleave', stop);
    };
  }, [start, stop]);

  return { ref: targetRef, isPressed };
}

/**
 * Hook for pinch-to-zoom detection
 */
export interface PinchState {
  scale: number;
  origin: { x: number; y: number };
}

export function usePinchZoom(
  onPinch: (state: PinchState) => void,
  options: { minScale?: number; maxScale?: number } = {}
) {
  const { minScale = 0.5, maxScale = 3 } = options;
  
  const ref = useRef<HTMLElement>(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const getDistance = (touches: TouchList) => {
      const [t1, t2] = [touches[0], touches[1]];
      return Math.sqrt(
        Math.pow(t2.clientX - t1.clientX, 2) +
        Math.pow(t2.clientY - t1.clientY, 2)
      );
    };

    const getCenter = (touches: TouchList) => {
      const [t1, t2] = [touches[0], touches[1]];
      return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance.current = getDistance(e.touches);
        initialScale.current = 1;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;

      const currentDistance = getDistance(e.touches);
      const scale = Math.max(
        minScale,
        Math.min(maxScale, (currentDistance / initialDistance.current) * initialScale.current)
      );

      onPinch({
        scale,
        origin: getCenter(e.touches),
      });
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [minScale, maxScale, onPinch]);

  return ref;
}

