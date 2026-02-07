import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>;
    threshold?: number;
    disabled?: boolean;
}

interface UsePullToRefreshReturn {
    isRefreshing: boolean;
    pullProgress: number;
    containerRef: React.RefObject<HTMLDivElement>;
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    handleTouchEnd: () => void;
}

/**
 * Hook for pull-to-refresh functionality on mobile
 * 
 * @example
 * ```tsx
 * const { isRefreshing, pullProgress, containerRef, ...handlers } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await refetchData();
 *   }
 * });
 * 
 * return (
 *   <div ref={containerRef} {...handlers}>
 *     {isRefreshing && <RefreshSpinner />}
 *     <YourContent />
 *   </div>
 * );
 * ```
 */
export function usePullToRefresh({
    onRefresh,
    threshold = 80,
    disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);
    const isPulling = useRef(false);

    // Only enable on mobile/native platforms
    const isMobile = typeof window !== 'undefined' && (
        Capacitor.isNativePlatform() ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (disabled || !isMobile || isRefreshing) return;

        const container = containerRef.current;
        if (!container || container.scrollTop > 0) return;

        startY.current = e.touches[0].clientY;
        isPulling.current = true;
    }, [disabled, isMobile, isRefreshing]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling.current || isRefreshing) return;

        const container = containerRef.current;
        if (!container || container.scrollTop > 0) {
            isPulling.current = false;
            setPullProgress(0);
            return;
        }

        currentY.current = e.touches[0].clientY;
        const deltaY = currentY.current - startY.current;

        if (deltaY > 0) {
            // Apply resistance (diminishing returns as you pull further)
            const resistance = 0.5;
            const actualPull = deltaY * resistance;
            const progress = Math.min(actualPull / threshold, 1);
            setPullProgress(progress);

            // Prevent default scroll when pulling down
            if (progress > 0) {
                e.preventDefault();
            }
        }
    }, [threshold, isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling.current) return;
        isPulling.current = false;

        if (pullProgress >= 1 && !isRefreshing) {
            setIsRefreshing(true);
            setPullProgress(0);

            try {
                await onRefresh();
            } catch (error) {
                logger.error('Refresh failed', error);
            } finally {
                setIsRefreshing(false);
            }
        } else {
            setPullProgress(0);
        }
    }, [pullProgress, isRefreshing, onRefresh]);

    // Haptic feedback when threshold is reached (on native platforms)
    useEffect(() => {
        if (Capacitor.isNativePlatform() && pullProgress >= 1) {
            import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
                Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
            }).catch(() => { });
        }
    }, [pullProgress >= 1]);

    return {
        isRefreshing,
        pullProgress,
        containerRef,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    };
}

/**
 * Swipe action directions
 */
export type SwipeDirection = 'left' | 'right';

interface SwipeAction {
    direction: SwipeDirection;
    threshold?: number;
    onSwipe: () => void;
    backgroundColor?: string;
    icon?: React.ReactNode;
    label?: string;
}

interface UseSwipeActionsOptions {
    leftAction?: Omit<SwipeAction, 'direction'>;
    rightAction?: Omit<SwipeAction, 'direction'>;
    threshold?: number;
    disabled?: boolean;
}

interface UseSwipeActionsReturn {
    swipeOffset: number;
    isSwiping: boolean;
    activeDirection: SwipeDirection | null;
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    handleTouchEnd: () => void;
    resetSwipe: () => void;
}

/**
 * Hook for swipe actions on list items (like iOS swipe to delete)
 * 
 * @example
 * ```tsx
 * const { swipeOffset, activeDirection, ...handlers } = useSwipeActions({
 *   leftAction: { onSwipe: () => deleteItem(), label: 'Delete' },
 *   rightAction: { onSwipe: () => archiveItem(), label: 'Archive' },
 * });
 * 
 * return (
 *   <div {...handlers} style={{ transform: `translateX(${swipeOffset}px)` }}>
 *     <ListItem />
 *   </div>
 * );
 * ```
 */
export function useSwipeActions({
    leftAction,
    rightAction,
    threshold = 100,
    disabled = false,
}: UseSwipeActionsOptions): UseSwipeActionsReturn {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [activeDirection, setActiveDirection] = useState<SwipeDirection | null>(null);

    const startX = useRef(0);
    const startY = useRef(0);
    const isHorizontalSwipe = useRef<boolean | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (disabled) return;

        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        isHorizontalSwipe.current = null;
        setIsSwiping(true);
    }, [disabled]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isSwiping || disabled) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - startX.current;
        const deltaY = currentY - startY.current;

        // Determine swipe direction on first significant movement
        if (isHorizontalSwipe.current === null) {
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
            }
            return;
        }

        if (!isHorizontalSwipe.current) {
            // Vertical scroll, don't interfere
            setIsSwiping(false);
            return;
        }

        // Check if action exists for direction
        const direction: SwipeDirection = deltaX > 0 ? 'right' : 'left';
        const hasAction = direction === 'left' ? leftAction : rightAction;

        if (!hasAction) {
            // No action for this direction, limit offset
            setSwipeOffset(deltaX * 0.2);
            setActiveDirection(null);
            return;
        }

        // Apply resistance at the edges
        const maxOffset = threshold * 1.5;
        const resistance = Math.min(1, maxOffset / (Math.abs(deltaX) + maxOffset));
        const boundedOffset = deltaX * resistance;

        setSwipeOffset(boundedOffset);
        setActiveDirection(Math.abs(boundedOffset) >= threshold ? direction : null);

        // Prevent vertical scrolling while swiping
        e.preventDefault();
    }, [isSwiping, disabled, leftAction, rightAction, threshold]);

    const handleTouchEnd = useCallback(() => {
        if (!isSwiping) return;
        setIsSwiping(false);

        if (activeDirection === 'left' && leftAction) {
            leftAction.onSwipe();
        } else if (activeDirection === 'right' && rightAction) {
            rightAction.onSwipe();
        }

        // Animate back to center
        setSwipeOffset(0);
        setActiveDirection(null);
    }, [isSwiping, activeDirection, leftAction, rightAction]);

    const resetSwipe = useCallback(() => {
        setSwipeOffset(0);
        setActiveDirection(null);
        setIsSwiping(false);
    }, []);

    return {
        swipeOffset,
        isSwiping,
        activeDirection,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        resetSwipe,
    };
}
