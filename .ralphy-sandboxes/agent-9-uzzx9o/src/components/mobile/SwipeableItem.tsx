import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { ReactNode } from 'react';
import { triggerHaptic } from '@/lib/utils/mobile';

interface SwipeAction {
    label: string;
    icon?: ReactNode;
    color: string;
    onClick: () => void;
}

interface SwipeableItemProps {
    children: ReactNode;
    leftAction?: SwipeAction;
    rightAction?: SwipeAction;
    threshold?: number;
}

export function SwipeableItem({
    children,
    leftAction,
    rightAction,
    threshold = 100
}: SwipeableItemProps) {
    const x = useMotionValue(0);
    const opacity = useTransform(x, [-threshold, 0, threshold], [1, 0, 1]);
    const leftIconX = useTransform(x, [0, threshold], [-20, 0]);
    const rightIconX = useTransform(x, [-threshold, 0], [0, 20]);

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (leftAction && info.offset.x > threshold) {
            triggerHaptic('medium');
            leftAction.onClick();
        } else if (rightAction && info.offset.x < -threshold) {
            triggerHaptic('medium');
            rightAction.onClick();
        }
    };

    return (
        <div className="relative overflow-hidden bg-background">
            {/* Left Action Background */}
            {leftAction && (
                <div
                    className="absolute inset-y-0 left-0 flex items-center justify-start px-6 w-full"
                    style={{ backgroundColor: leftAction.color }}
                >
                    <motion.div style={{ opacity, x: leftIconX }}>
                        {leftAction.icon || <span className="text-white font-medium">{leftAction.label}</span>}
                    </motion.div>
                </div>
            )}

            {/* Right Action Background */}
            {rightAction && (
                <div
                    className="absolute inset-y-0 right-0 flex items-center justify-end px-6 w-full"
                    style={{ backgroundColor: rightAction.color }}
                >
                    <motion.div style={{ opacity, x: rightIconX }}>
                        {rightAction.icon || <span className="text-white font-medium">{rightAction.label}</span>}
                    </motion.div>
                </div>
            )}

            {/* Swipeable Content */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.1}
                style={{ x, background: 'var(--background)' }}
                onDragEnd={handleDragEnd}
                className="relative z-10 bg-background"
            >
                {children}
            </motion.div>
        </div>
    );
}
