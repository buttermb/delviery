import { db } from './idb';
import { toast } from 'sonner';

export const syncQueue = {
    async process() {
        if (!navigator.onLine) return;

        const queue = await db.getSyncQueue();
        if (queue.length === 0) return;

        console.log(`Processing ${queue.length} offline items...`);

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
                    console.log(`Synced item: ${item.url}`);
                } else {
                    console.error(`Failed to sync item: ${item.url}`, response.statusText);
                    // Optional: Implement retry logic or max retries here
                }
            } catch (error) {
                console.error(`Error syncing item: ${item.url}`, error);
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (registration as any).sync.register('sync-queue');
            } catch (err) {
                console.warn('Background sync registration failed:', err);
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
