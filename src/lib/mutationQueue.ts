/**
 * Offline Mutation Queue
 *
 * Stores failed mutations in localStorage and retries them when back online.
 * Lightweight alternative to the IndexedDB-based offlineQueue for simple mutations.
 */

import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';

const MAX_RETRIES = 3;

export interface MutationQueueItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function readQueue(): MutationQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MUTATION_QUEUE);
    if (!raw) return [];
    return JSON.parse(raw) as MutationQueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(queue: MutationQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));
  } catch {
    logger.warn('Failed to persist mutation queue to localStorage');
  }
}

export function enqueue(mutation: Omit<MutationQueueItem, 'id' | 'timestamp' | 'retryCount'>): MutationQueueItem {
  const item: MutationQueueItem = {
    ...mutation,
    id: generateId(),
    timestamp: Date.now(),
    retryCount: 0,
  };

  const queue = readQueue();
  writeQueue([...queue, item]);

  logger.debug('Mutation enqueued', { id: item.id, type: item.type });
  return item;
}

export function dequeue(): MutationQueueItem | undefined {
  const queue = readQueue();
  if (queue.length === 0) return undefined;

  const [first, ...rest] = queue;
  writeQueue(rest);
  return first;
}

export function getQueue(): MutationQueueItem[] {
  return readQueue();
}

export function clearQueue(): void {
  writeQueue([]);
  logger.debug('Mutation queue cleared');
}

/**
 * Process all queued mutations. Called automatically when coming back online.
 * Each mutation is passed to the provided executor function.
 * Mutations that fail are re-enqueued with an incremented retryCount up to MAX_RETRIES.
 */
export async function processQueue(
  executor: (item: MutationQueueItem) => Promise<void>
): Promise<{ processed: number; failed: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  logger.info(`Processing ${queue.length} queued mutations`);

  let processed = 0;
  let failed = 0;
  const remaining: MutationQueueItem[] = [];

  for (const item of queue) {
    try {
      await executor(item);
      processed++;
    } catch {
      const updated: MutationQueueItem = {
        ...item,
        retryCount: item.retryCount + 1,
      };

      if (updated.retryCount < MAX_RETRIES) {
        remaining.push(updated);
      } else {
        logger.warn('Mutation exceeded max retries, discarding', {
          id: item.id,
          type: item.type,
        });
      }
      failed++;
    }
  }

  writeQueue(remaining);
  return { processed, failed };
}

/**
 * Initialize the online listener to auto-process the queue when connectivity is restored.
 */
export function initMutationQueueListener(
  executor: (item: MutationQueueItem) => Promise<void>
): () => void {
  const handler = () => {
    processQueue(executor);
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
