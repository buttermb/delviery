/**
 * LongPressMenu Component
 * Shows a dropdown menu on long-press gesture (500ms)
 * Commonly used for edit/delete actions on mobile
 */

import React, { useState, useRef, useCallback, ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/utils/mobile';

interface LongPressMenuItem {
    /** Display label */
    label: string;
    /** Optional icon */
    icon?: ReactNode;
    /** Callback when selected */
    onSelect: () => void;
    /** Is this a destructive action? */
    destructive?: boolean;
    /** Disable this item */
    disabled?: boolean;
}

interface LongPressMenuProps {
    /** Content to wrap */
    children: ReactNode;
    /** Menu items */
    items: LongPressMenuItem[];
    /** Long press duration in ms (default: 500) */
    duration?: number;
    /** Disable the menu */
    disabled?: boolean;
    /** Additional className */
    className?: string;
}

const LONG_PRESS_DURATION = 500;

export function LongPressMenu({
    children,
    items,
    duration = LONG_PRESS_DURATION,
    disabled = false,
    className,
}: LongPressMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    const touchStartPos = useRef({ x: 0, y: 0 });

    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (disabled) return;

            touchStartPos.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };

            timerRef.current = setTimeout(() => {
                triggerHaptic('medium');
                setIsOpen(true);
            }, duration);
        },
        [disabled, duration]
    );

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        // Cancel if user moves finger (scrolling)
        const moveThreshold = 10;
        const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
        const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);

        if (dx > moveThreshold || dy > moveThreshold) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    }, []);

    // Also support right-click on desktop
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            if (disabled) return;
            e.preventDefault();
            setIsOpen(true);
        },
        [disabled]
    );

    return (
        <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenu.Trigger asChild disabled={disabled}>
                <div
                    className={cn('touch-none', className)}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={handleContextMenu}
                >
                    {children}
                </div>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className={cn(
                        'min-w-[180px] bg-popover rounded-lg shadow-lg border border-border p-1',
                        'animate-in fade-in-0 zoom-in-95 z-50'
                    )}
                >
                    {items.map((item, index) => (
                        <DropdownMenu.Item
                            key={index}
                            disabled={item.disabled}
                            onSelect={() => {
                                triggerHaptic('light');
                                item.onSelect();
                            }}
                            className={cn(
                                'flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer',
                                'text-sm outline-none transition-colors',
                                'focus:bg-accent focus:text-accent-foreground',
                                'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
                                item.destructive && 'text-destructive focus:bg-destructive/10 focus:text-destructive'
                            )}
                        >
                            {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                            {item.label}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

export default LongPressMenu;
