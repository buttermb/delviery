import * as React from 'react';
import { cn } from '@/lib/utils';
import { GripVertical, GripHorizontal } from 'lucide-react';

interface SplitPaneProps {
    /** Left or top panel content */
    primary: React.ReactNode;
    /** Right or bottom panel content */
    secondary: React.ReactNode;
    /** Orientation of the split */
    orientation?: 'horizontal' | 'vertical';
    /** Initial size of primary panel (in pixels or percentage) */
    defaultSize?: number | string;
    /** Minimum size of primary panel in pixels */
    minSize?: number;
    /** Maximum size of primary panel in pixels */
    maxSize?: number;
    /** Whether the split is resizable */
    resizable?: boolean;
    /** Callback when size changes */
    onSizeChange?: (size: number) => void;
    /** Container className */
    className?: string;
    /** Storage key for persisting size */
    storageKey?: string;
}

/**
 * Split Pane Component
 * A resizable split view for displaying two panels side-by-side or stacked
 * 
 * @example
 * ```tsx
 * <SplitPane
 *   orientation="horizontal"
 *   primary={<Sidebar />}
 *   secondary={<MainContent />}
 *   defaultSize={300}
 *   minSize={200}
 *   maxSize={500}
 *   storageKey="main-split"
 * />
 * ```
 */
export function SplitPane({
    primary,
    secondary,
    orientation = 'horizontal',
    defaultSize = '50%',
    minSize = 100,
    maxSize,
    resizable = true,
    onSizeChange,
    className,
    storageKey,
}: SplitPaneProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [size, setSize] = React.useState<number>(() => {
        // Try to load from storage
        if (storageKey && typeof window !== 'undefined') {
            const stored = localStorage.getItem(`split-pane-${storageKey}`);
            if (stored) {
                return parseInt(stored, 10);
            }
        }
        // Parse defaultSize
        if (typeof defaultSize === 'number') {
            return defaultSize;
        }
        // Percentage - we'll calculate on first render
        return 0;
    });
    const [isDragging, setIsDragging] = React.useState(false);

    // Calculate initial size from percentage
    React.useEffect(() => {
        if (size === 0 && containerRef.current) {
            const container = containerRef.current;
            const totalSize = orientation === 'horizontal'
                ? container.clientWidth
                : container.clientHeight;

            if (typeof defaultSize === 'string' && defaultSize.endsWith('%')) {
                const percentage = parseFloat(defaultSize) / 100;
                setSize(Math.round(totalSize * percentage));
            }
        }
    }, [size, defaultSize, orientation]);

    // Save size to storage
    React.useEffect(() => {
        if (storageKey && size > 0 && typeof window !== 'undefined') {
            localStorage.setItem(`split-pane-${storageKey}`, size.toString());
        }
    }, [size, storageKey]);

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        if (!resizable) return;
        e.preventDefault();
        setIsDragging(true);
    }, [resizable]);

    React.useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;

            const container = containerRef.current;
            const rect = container.getBoundingClientRect();

            let newSize: number;
            if (orientation === 'horizontal') {
                newSize = e.clientX - rect.left;
            } else {
                newSize = e.clientY - rect.top;
            }

            // Apply constraints
            newSize = Math.max(minSize, newSize);
            if (maxSize) {
                newSize = Math.min(maxSize, newSize);
            }

            // Also constrain to container size
            const totalSize = orientation === 'horizontal'
                ? container.clientWidth
                : container.clientHeight;
            newSize = Math.min(newSize, totalSize - minSize);

            setSize(newSize);
            onSizeChange?.(newSize);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, orientation, minSize, maxSize, onSizeChange]);

    // Touch support
    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
        if (!resizable) return;
        e.preventDefault();
        setIsDragging(true);
    }, [resizable]);

    React.useEffect(() => {
        if (!isDragging) return;

        const handleTouchMove = (e: TouchEvent) => {
            if (!containerRef.current || e.touches.length === 0) return;

            const touch = e.touches[0];
            const container = containerRef.current;
            const rect = container.getBoundingClientRect();

            let newSize: number;
            if (orientation === 'horizontal') {
                newSize = touch.clientX - rect.left;
            } else {
                newSize = touch.clientY - rect.top;
            }

            // Apply constraints
            newSize = Math.max(minSize, newSize);
            if (maxSize) {
                newSize = Math.min(maxSize, newSize);
            }

            const totalSize = orientation === 'horizontal'
                ? container.clientWidth
                : container.clientHeight;
            newSize = Math.min(newSize, totalSize - minSize);

            setSize(newSize);
            onSizeChange?.(newSize);
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
        };

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, orientation, minSize, maxSize, onSizeChange]);

    const isHorizontal = orientation === 'horizontal';
    const GripIcon = isHorizontal ? GripVertical : GripHorizontal;

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex overflow-hidden',
                isHorizontal ? 'flex-row h-full' : 'flex-col w-full',
                isDragging && 'select-none cursor-col-resize',
                className
            )}
        >
            {/* Primary Panel */}
            <div
                className="overflow-auto"
                style={{
                    [isHorizontal ? 'width' : 'height']: size > 0 ? `${size}px` : undefined,
                    flexShrink: 0,
                }}
            >
                {primary}
            </div>

            {/* Resizer */}
            {resizable && (
                <div
                    className={cn(
                        'relative flex items-center justify-center shrink-0',
                        isHorizontal
                            ? 'w-2 cursor-col-resize hover:bg-primary/10'
                            : 'h-2 cursor-row-resize hover:bg-primary/10',
                        isDragging && 'bg-primary/20'
                    )}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    <div
                        className={cn(
                            'absolute bg-border rounded-full transition-colors',
                            isHorizontal ? 'w-1 h-8' : 'h-1 w-8',
                            isDragging && 'bg-primary'
                        )}
                    />
                    <GripIcon
                        className={cn(
                            'absolute h-4 w-4 text-muted-foreground/50',
                            isDragging && 'text-primary'
                        )}
                    />
                </div>
            )}

            {/* Secondary Panel */}
            <div className="flex-1 overflow-auto min-w-0 min-h-0">
                {secondary}
            </div>
        </div>
    );
}

export default SplitPane;
