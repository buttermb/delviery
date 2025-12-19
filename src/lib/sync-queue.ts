import { db } from './idb';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

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
                    logger.error(`Failed to sync item: ${item.url}`, response.statusText, { component: 'SyncQueue' });
                    // Optional: Implement retry logic or max retries here
                }
            } catch (error) {
                logger.error(`Error syncing item: ${item.url}`, error, { component: 'SyncQueue' });
            }
        }

        toast.success('Offline changes synced!');
    },

    async add(url: string, method: string, body: any) {
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
