/**
 * Undo Manager
 * Provides undo functionality for actions with a configurable timeout
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface UndoableAction<T = unknown> {
    id: string;
    description: string;
    data: T;
    execute: () => Promise<void>;
    undo: () => Promise<void>;
    createdAt: number;
}

interface UseUndoOptions {
    /** Time in ms before action is committed (default: 5000) */
    timeout?: number;
    /** Callback when action is committed */
    onCommit?: (action: UndoableAction) => void;
    /** Callback when action is undone */
    onUndo?: (action: UndoableAction) => void;
}

interface UseUndoReturn<T = unknown> {
    /** Current pending action (if any) */
    pendingAction: UndoableAction<T> | null;
    /** Time remaining before commit (ms) */
    timeRemaining: number;
    /** Execute an action with undo capability */
    executeWithUndo: (action: Omit<UndoableAction<T>, 'id' | 'createdAt'>) => Promise<void>;
    /** Undo the pending action */
    undo: () => Promise<void>;
    /** Commit immediately (skip waiting) */
    commit: () => Promise<void>;
    /** Cancel without executing undo (just clear pending) */
    cancel: () => void;
}

/**
 * Hook for managing undoable actions
 * 
 * @example
 * ```tsx
 * const { pendingAction, timeRemaining, executeWithUndo, undo } = useUndo({
 *   timeout: 5000,
 *   onUndo: () => toast.info('Action undone'),
 * });
 * 
 * // Execute action with undo
 * await executeWithUndo({
 *   description: 'Order marked as delivered',
 *   data: { orderId, previousStatus: 'ready' },
 *   execute: async () => {
 *     await updateOrderStatus(orderId, 'delivered');
 *   },
 *   undo: async () => {
 *     await updateOrderStatus(orderId, 'ready');
 *   },
 * });
 * 
 * // Show undo toast
 * {pendingAction && (
 *   <Toast>
 *     {pendingAction.description}
 *     <span>{Math.ceil(timeRemaining / 1000)}s</span>
 *     <Button onClick={undo}>Undo</Button>
 *   </Toast>
 * )}
 * ```
 */
export function useUndo<T = unknown>({
    timeout = 5000,
    onCommit,
    onUndo,
}: UseUndoOptions = {}): UseUndoReturn<T> {
    const [pendingAction, setPendingAction] = useState<UndoableAction<T> | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Clear all timers
    const clearTimers = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => clearTimers();
    }, [clearTimers]);

    // Commit the pending action (finalize it)
    const commit = useCallback(async () => {
        if (!pendingAction) return;

        clearTimers();
        onCommit?.(pendingAction);
        setPendingAction(null);
        setTimeRemaining(0);
    }, [pendingAction, clearTimers, onCommit]);

    // Undo the pending action
    const undo = useCallback(async () => {
        if (!pendingAction) return;

        clearTimers();

        try {
            await pendingAction.undo();
            onUndo?.(pendingAction);
        } catch (error) {
            console.error('Undo failed:', error);
            throw error;
        } finally {
            setPendingAction(null);
            setTimeRemaining(0);
        }
    }, [pendingAction, clearTimers, onUndo]);

    // Cancel without undo (just clear)
    const cancel = useCallback(() => {
        clearTimers();
        setPendingAction(null);
        setTimeRemaining(0);
    }, [clearTimers]);

    // Execute action with undo capability
    const executeWithUndo = useCallback(async (
        action: Omit<UndoableAction<T>, 'id' | 'createdAt'>
    ) => {
        // If there's a pending action, commit it first
        if (pendingAction) {
            await commit();
        }

        // Execute the action immediately
        try {
            await action.execute();
        } catch (error) {
            console.error('Action execution failed:', error);
            throw error;
        }

        // Create the undoable action
        const undoableAction: UndoableAction<T> = {
            ...action,
            id: `action-${Date.now()}`,
            createdAt: Date.now(),
        };

        setPendingAction(undoableAction);
        setTimeRemaining(timeout);

        // Start countdown interval
        intervalRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                const newValue = prev - 100;
                return newValue > 0 ? newValue : 0;
            });
        }, 100);

        // Set commit timer
        timerRef.current = setTimeout(() => {
            commit();
        }, timeout);
    }, [pendingAction, commit, timeout]);

    return {
        pendingAction,
        timeRemaining,
        executeWithUndo,
        undo,
        commit,
        cancel,
    };
}

/**
 * Generate unique ID
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
