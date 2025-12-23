import { useState, useCallback, useRef } from 'react';

interface CancellableOperationState {
  isRunning: boolean;
  isCancelled: boolean;
  progress: number;
  message: string;
}

interface CancellableOperationResult<T> {
  /** Execute the operation */
  execute: () => Promise<T | null>;
  /** Cancel the running operation */
  cancel: () => void;
  /** Reset state after completion */
  reset: () => void;
  /** Current state */
  state: CancellableOperationState;
  /** Update progress (0-100) */
  updateProgress: (progress: number, message?: string) => void;
}

/**
 * Hook for managing long-running operations that can be cancelled
 * 
 * @example
 * ```tsx
 * const { execute, cancel, state } = useCancellableOperation(
 *   async (signal, updateProgress) => {
 *     for (let i = 0; i < items.length; i++) {
 *       if (signal.aborted) throw new Error('Cancelled');
 *       await processItem(items[i]);
 *       updateProgress((i / items.length) * 100, `Processing ${i + 1} of ${items.length}`);
 *     }
 *     return { success: true };
 *   }
 * );
 * ```
 */
export function useCancellableOperation<T>(
  operation: (
    signal: AbortSignal,
    updateProgress: (progress: number, message?: string) => void
  ) => Promise<T>
): CancellableOperationResult<T> {
  const [state, setState] = useState<CancellableOperationState>({
    isRunning: false,
    isCancelled: false,
    progress: 0,
    message: '',
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateProgress = useCallback((progress: number, message?: string) => {
    setState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
      message: message ?? prev.message,
    }));
  }, []);

  const execute = useCallback(async (): Promise<T | null> => {
    // Cancel any existing operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setState({
      isRunning: true,
      isCancelled: false,
      progress: 0,
      message: 'Starting...',
    });
    
    try {
      const result = await operation(signal, updateProgress);
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        progress: 100,
        message: 'Complete',
      }));
      
      return result;
    } catch (error) {
      const isCancelled = signal.aborted || 
        (error instanceof Error && error.name === 'AbortError');
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        isCancelled,
        message: isCancelled ? 'Cancelled' : 'Error',
      }));
      
      if (!isCancelled) {
        throw error;
      }
      
      return null;
    }
  }, [operation, updateProgress]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({
        ...prev,
        isCancelled: true,
        message: 'Cancelling...',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isRunning: false,
      isCancelled: false,
      progress: 0,
      message: '',
    });
  }, []);

  return {
    execute,
    cancel,
    reset,
    state,
    updateProgress,
  };
}

/**
 * Helper to check if operation should continue
 * Throws if cancelled
 */
export function checkCancellation(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error('Operation cancelled');
    error.name = 'AbortError';
    throw error;
  }
}

/**
 * Helper to yield to event loop and check cancellation
 * Use this in loops to allow UI updates and cancellation
 */
export async function yieldAndCheck(signal: AbortSignal): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
  checkCancellation(signal);
}

export default useCancellableOperation;
