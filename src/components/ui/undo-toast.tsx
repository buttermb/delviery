/**
 * Undo Toast Component
 * Shows a toast with undo functionality and countdown timer
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Undo2, X, Check } from 'lucide-react';

interface UndoToastProps {
    /** Description of the action */
    description: string;
    /** Time remaining in ms */
    timeRemaining: number;
    /** Total timeout in ms */
    totalTime?: number;
    /** Called when undo is clicked */
    onUndo: () => void;
    /** Called when dismissed (committed early) */
    onDismiss?: () => void;
    /** Additional className */
    className?: string;
}

/**
 * Undo Toast with countdown progress bar
 * 
 * @example
 * ```tsx
 * {pendingAction && (
 *   <UndoToast
 *     description={pendingAction.description}
 *     timeRemaining={timeRemaining}
 *     totalTime={5000}
 *     onUndo={undo}
 *     onDismiss={commit}
 *   />
 * )}
 * ```
 */
export function UndoToast({
    description,
    timeRemaining,
    totalTime = 5000,
    onUndo,
    onDismiss,
    className,
}: UndoToastProps) {
    const progress = (timeRemaining / totalTime) * 100;
    const secondsLeft = Math.ceil(timeRemaining / 1000);

    return (
        <div
            className={cn(
                'fixed bottom-20 left-1/2 -translate-x-1/2 z-toast',
                'bg-zinc-900 text-white rounded-lg shadow-lg overflow-hidden',
                'min-w-[300px] max-w-[400px]',
                'animate-in slide-in-from-bottom-5 fade-in duration-300',
                className
            )}
        >
            {/* Progress bar */}
            <div className="h-1 bg-zinc-700">
                <div
                    className="h-full bg-primary transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="p-3 flex items-center gap-3">
                {/* Check icon */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="h-4 w-4 text-green-500" />
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{description}</p>
                    <p className="text-xs text-zinc-400">
                        Undoing in {secondsLeft}s...
                    </p>
                </div>

                {/* Undo button */}
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={onUndo}
                    className="flex-shrink-0 gap-1.5 bg-white/10 hover:bg-white/20 text-white border-0"
                >
                    <Undo2 className="h-3.5 w-3.5" />
                    Undo
                </Button>

                {/* Dismiss button */}
                {onDismiss && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onDismiss}
                        className="flex-shrink-0 h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

/**
 * Hook to show undo toast with automatic positioning
 */
export function useUndoToast() {
    const [toasts, setToasts] = useState<Array<{
        id: string;
        description: string;
        timeRemaining: number;
        totalTime: number;
        onUndo: () => void;
    }>>([]);

    const showUndoToast = (
        description: string,
        onUndo: () => void,
        totalTime = 5000
    ) => {
        const id = `toast-${Date.now()}`;

        setToasts((prev) => [
            ...prev,
            { id, description, timeRemaining: totalTime, totalTime, onUndo },
        ]);

        // Update countdown
        const interval = setInterval(() => {
            setToasts((prev) =>
                prev.map((t) =>
                    t.id === id
                        ? { ...t, timeRemaining: Math.max(0, t.timeRemaining - 100) }
                        : t
                )
            );
        }, 100);

        // Auto-dismiss after timeout
        const timeout = setTimeout(() => {
            clearInterval(interval);
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, totalTime);

        return {
            dismiss: () => {
                clearInterval(interval);
                clearTimeout(timeout);
                setToasts((prev) => prev.filter((t) => t.id !== id));
            },
        };
    };

    return { toasts, showUndoToast };
}

export default UndoToast;
