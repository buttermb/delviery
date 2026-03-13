/**
 * useMutationQueue Hook
 *
 * Provides reactive queue state and processQueue trigger for offline mutation handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import type { MutationQueueItem } from '@/lib/mutationQueue';
import { getQueue, processQueue, clearQueue, enqueue } from '@/lib/mutationQueue';

interface UseMutationQueueReturn {
  queue: MutationQueueItem[];
  isProcessing: boolean;
  enqueue: (mutation: Omit<MutationQueueItem, 'id' | 'timestamp' | 'retryCount'>) => void;
  process: (executor: (item: MutationQueueItem) => Promise<void>) => Promise<void>;
  clear: () => void;
}

export function useMutationQueue(): UseMutationQueueReturn {
  const [queue, setQueue] = useState<MutationQueueItem[]>(getQueue);
  const [isProcessing, setIsProcessing] = useState(false);
  const mountedRef = useRef(true);

  // Refresh queue state from localStorage
  const refreshQueue = useCallback(() => {
    if (mountedRef.current) {
      setQueue(getQueue());
    }
  }, []);

  // Listen for online events to refresh queue state
  useEffect(() => {
    mountedRef.current = true;
    window.addEventListener('online', refreshQueue);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', refreshQueue);
    };
  }, [refreshQueue]);

  const handleEnqueue = useCallback(
    (mutation: Omit<MutationQueueItem, 'id' | 'timestamp' | 'retryCount'>) => {
      enqueue(mutation);
      refreshQueue();
    },
    [refreshQueue]
  );

  const handleProcess = useCallback(
    async (executor: (item: MutationQueueItem) => Promise<void>) => {
      setIsProcessing(true);
      try {
        await processQueue(executor);
      } finally {
        if (mountedRef.current) {
          setIsProcessing(false);
          refreshQueue();
        }
      }
    },
    [refreshQueue]
  );

  const handleClear = useCallback(() => {
    clearQueue();
    refreshQueue();
  }, [refreshQueue]);

  return {
    queue,
    isProcessing,
    enqueue: handleEnqueue,
    process: handleProcess,
    clear: handleClear,
  };
}
