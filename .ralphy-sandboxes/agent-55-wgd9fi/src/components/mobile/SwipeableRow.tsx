/**
 * SwipeableRow Component
 * A wrapper that enables swipe-to-action gestures on mobile devices
 * Uses react-swipeable for cross-platform touch handling
 */

import React, { useState, useCallback, ReactNode } from 'react';
import { useSwipeable, SwipeEventData } from 'react-swipeable';
import { cn } from '@/lib/utils';

interface SwipeAction {
    /** Action label for accessibility */
    label: string;
    /** Background color when revealed */
    color: string;
    /** Icon to display */
    icon: ReactNode;
    /** Callback when action is triggered */
    onAction: () => void;
}

interface SwipeableRowProps {
    /** Content to display in the row */
    children: ReactNode;
    /** Action when swiping left */
    leftAction?: SwipeAction;
    /** Action when swiping right */
    rightAction?: SwipeAction;
    /** Minimum swipe distance to trigger action (default: 80) */
    threshold?: number;
    /** Additional className for the container */
    className?: string;
    /** Disable swiping */
    disabled?: boolean;
}

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 80;

export function SwipeableRow({
    children,
    leftAction,
    rightAction,
    threshold = SWIPE_THRESHOLD,
    className,
    disabled = false,
}: SwipeableRowProps) {
    const [translateX, setTranslateX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);

    const handleSwipeStart = useCallback(() => {
        if (disabled) return;
        setIsSwiping(true);
    }, [disabled]);

    const handleSwiping = useCallback(
        (eventData: SwipeEventData) => {
            if (disabled) return;

            const { deltaX } = eventData;

            // Limit swipe distance
            const maxSwipe = ACTION_WIDTH + 20;
            let newTranslateX = deltaX;

            // Only allow swipe if there's an action for that direction
            if (deltaX > 0 && !rightAction) newTranslateX = 0;
            if (deltaX < 0 && !leftAction) newTranslateX = 0;

            // Apply resistance at edges
            if (Math.abs(newTranslateX) > maxSwipe) {
                const overflow = Math.abs(newTranslateX) - maxSwipe;
                newTranslateX = Math.sign(newTranslateX) * (maxSwipe + overflow * 0.2);
            }

            setTranslateX(newTranslateX);
        },
        [disabled, leftAction, rightAction]
    );

    const handleSwipeEnd = useCallback(
        (eventData: SwipeEventData) => {
            if (disabled) return;

            setIsSwiping(false);
            const { deltaX } = eventData;

            // Check if swipe exceeded threshold
            if (deltaX > threshold && rightAction) {
                rightAction.onAction();
            } else if (deltaX < -threshold && leftAction) {
                leftAction.onAction();
            }

            // Reset position
            setTranslateX(0);
        },
        [disabled, threshold, leftAction, rightAction]
    );

    const handlers = useSwipeable({
        onSwipeStart: handleSwipeStart,
        onSwiping: handleSwiping,
        onSwiped: handleSwipeEnd,
        trackMouse: false,
        trackTouch: true,
        preventScrollOnSwipe: true,
    });

    const showLeftAction = translateX < -20 && leftAction;
    const showRightAction = translateX > 20 && rightAction;

    return (
        <div
            className={cn('relative overflow-hidden', className)}
            {...handlers}
        >
            {/* Left action (revealed when swiping left) */}
            {leftAction && (
                <div
                    className="absolute inset-y-0 right-0 flex items-center justify-center transition-opacity"
                    style={{
                        width: ACTION_WIDTH,
                        backgroundColor: leftAction.color,
                        opacity: showLeftAction ? 1 : 0,
                    }}
                    aria-label={leftAction.label}
                >
                    <div className="text-white">{leftAction.icon}</div>
                </div>
            )}

            {/* Right action (revealed when swiping right) */}
            {rightAction && (
                <div
                    className="absolute inset-y-0 left-0 flex items-center justify-center transition-opacity"
                    style={{
                        width: ACTION_WIDTH,
                        backgroundColor: rightAction.color,
                        opacity: showRightAction ? 1 : 0,
                    }}
                    aria-label={rightAction.label}
                >
                    <div className="text-white">{rightAction.icon}</div>
                </div>
            )}

            {/* Main content */}
            <div
                className={cn(
                    'relative bg-background',
                    isSwiping ? '' : 'transition-transform duration-200'
                )}
                style={{
                    transform: `translateX(${translateX}px)`,
                }}
            >
                {children}
            </div>
        </div>
    );
}

export default SwipeableRow;
