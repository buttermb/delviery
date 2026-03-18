import { db } from './idb';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface SyncManager {
    register(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
    sync: SyncManager;
}

export const syncQueue = {
    async process() {
        if (!navigator.onLine) return;

        const queue = await db.getSyncQueue();
        if (queue.length === 0) return;

        logger.info(`Processing ${queue.length} offline items...`, null, { component: 'SyncQueue' });

        for (const item of queue) {
            try {
                // Exponential backoff check
                if (item.retryCount > 0) {
                    const backoffTime = Math.pow(2, item.retryCount) * 1000; // 2s, 4s, 8s...
                    if (Date.now() - item.timestamp < backoffTime) {
                        continue; // Skip if in backoff period
                    }
                }

                const response = await fetch(item.url, {
                    method: item.method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(item.body),
                });

                if (response.ok) {
                    await db.removeFromSyncQueue(item.timestamp);
                    logger.info(`Synced item: ${item.url}`, null, { component: 'SyncQueue' });
                } else {
                    // Increment retry count
                    const newItem = { ...item, retryCount: (item.retryCount ?? 0) + 1 };

                    if (newItem.retryCount > 5) {
                        logger.error(`Max retries reached for item: ${item.url}`, null, { component: 'SyncQueue' });
                        await db.removeFromSyncQueue(item.timestamp); // Give up
                    } else {
                        // Update in DB (we need to expose an update method or just re-add)
                        // Since idb.ts keys by timestamp, we can just put it back
                        const dbInstance = await import('./idb').then(m => m.initDB());
                        await dbInstance.put('syncQueue', newItem);
                        logger.warn(`Sync failed, retrying later (${newItem.retryCount}/5)`, response.statusText, { component: 'SyncQueue' });
                    }
                }
            } catch (error) {
                logger.error(`Error syncing item: ${item.url}`, error, { component: 'SyncQueue' });
                // Increment retry count on network error too
                const newItem = { ...item, retryCount: (item.retryCount ?? 0) + 1 };
                if (newItem.retryCount <= 5) {
                    const dbInstance = await import('./idb').then(m => m.initDB());
                    await dbInstance.put('syncQueue', newItem);
                }
            }
        }

        toast.success('Offline changes processing...');
    },

    async add(url: string, method: string, body: unknown) {
        // Enforce idempotency: Inject UUID if not present and body is an object
        if (body && typeof body === 'object' && !Array.isArray(body)) {
            const record = body as Record<string, unknown>;
            if (!record.idempotencyKey && !record.idempotency_key) {
                body = { ...record, idempotencyKey: uuidv4() };
            }
        }

        await db.addToSyncQueue({ url, method, body });

        // Register background sync if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await (registration as ServiceWorkerRegistrationWithSync).sync.register('sync-queue');
            } catch (err) {
                logger.warn('Background sync registration failed:', err, { component: 'SyncQueue' });
            }
        } else {
            // Fallback: Try to process immediately if online
            if (navigator.onLine) {
                this.process();
            }
        }
    }
};

// Listen for online event to trigger sync
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        syncQueue.process();
    });
}
