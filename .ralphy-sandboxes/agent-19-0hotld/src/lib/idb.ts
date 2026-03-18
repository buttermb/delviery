import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { clientEncryption } from './encryption/clientEncryption';
import { logger } from './logger';

interface FloraIQDB extends DBSchema {
    products: {
        key: string;
        value: {
            id: string;
            name: string;
            price: number;
            sku: string;
            updatedAt: number;
        };
        indexes: { 'by-sku': string };
    };
    orders: {
        key: string;
        value: {
            id: string;
            data: unknown; // Encrypted data or plain object
            encrypted: boolean;
            createdAt: number;
            synced: boolean;
        };
    };
    syncQueue: {
        key: number;
        value: {
            url: string;
            method: string;
            body: unknown;
            timestamp: number;
            retryCount: number;
        };
    };
}

const DB_NAME = 'floraiq-db';
const DB_VERSION = 2; // Bump version for schema change

let dbPromise: Promise<IDBPDatabase<FloraIQDB>>;

export const initDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<FloraIQDB>(DB_NAME, DB_VERSION, {
            upgrade(db, _oldVersion, _newVersion, _transaction) {
                // Products store
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id' });
                    productStore.createIndex('by-sku', 'sku');
                }

                // Orders store
                if (!db.objectStoreNames.contains('orders')) {
                    db.createObjectStore('orders', { keyPath: 'id' });
                }

                // Sync Queue store
                if (!db.objectStoreNames.contains('syncQueue')) {
                    db.createObjectStore('syncQueue', { keyPath: 'timestamp' });
                }
            },
        });
    }
    return dbPromise;
};

export const db = {
    async getProduct(id: string) {
        const db = await initDB();
        return db.get('products', id);
    },
    async getAllProducts() {
        const db = await initDB();
        return db.getAll('products');
    },
    async saveProduct(product: FloraIQDB['products']['value']) {
        const db = await initDB();
        return db.put('products', product);
    },

    // Secure Order Methods
    async saveOrder(order: Record<string, unknown> & { id: string; createdAt?: number | string }) {
        const db = await initDB();
        let dataToStore: unknown = order;
        let isEncrypted = false;

        // Encrypt if encryption is ready
        if (clientEncryption.isReady()) {
            try {
                const sensitiveData = { ...order };
                delete sensitiveData.id;
                delete sensitiveData.createdAt;

                dataToStore = clientEncryption.encrypt(JSON.stringify(sensitiveData));
                isEncrypted = true;
            } catch (e) {
                logger.warn('Failed to encrypt order, storing plain text', e, { component: 'idb' });
            }
        }

        const createdAtValue = order.createdAt;
        const createdAtNum = typeof createdAtValue === 'string' ? new Date(createdAtValue).getTime() : (createdAtValue || Date.now());

        return db.put('orders', {
            id: order.id,
            data: dataToStore,
            encrypted: isEncrypted,
            createdAt: createdAtNum,
            synced: false
        });
    },

    async getOrder(id: string) {
        const db = await initDB();
        const record = await db.get('orders', id);

        if (!record) return null;

        if (record.encrypted && clientEncryption.isReady()) {
            try {
                const decryptedData = clientEncryption.decrypt(record.data as string) as Record<string, unknown>;
                return {
                    id: record.id,
                    ...decryptedData,
                    createdAt: record.createdAt,
                    synced: record.synced
                };
            } catch (e) {
                logger.error('Failed to decrypt order', e, { component: 'IDB', orderId: record.id });
                return null;
            }
        }

        // Return as is if not encrypted or encryption not ready (fallback)
        const data = record.data as Record<string, unknown> | null;
        return record.encrypted ? null : { ...(data ?? {}), id: record.id, createdAt: record.createdAt, synced: record.synced };
    },

    async getAllOrders() {
        const db = await initDB();
        const records = await db.getAll('orders');

        if (!clientEncryption.isReady()) {
            return records.filter(r => !r.encrypted).map(r => ({ ...(r.data as Record<string, unknown> ?? {}), id: r.id, createdAt: r.createdAt, synced: r.synced }));
        }

        return records.map(record => {
            if (record.encrypted) {
                try {
                    const decryptedData = clientEncryption.decrypt(record.data as string) as Record<string, unknown>;
                    return {
                        id: record.id,
                        ...decryptedData,
                        createdAt: record.createdAt,
                        synced: record.synced
                    };
                } catch {
                    logger.error('Failed to decrypt order', { id: record.id, component: 'idb' });
                    return null;
                }
            }
            return { ...(record.data as Record<string, unknown> ?? {}), id: record.id, createdAt: record.createdAt, synced: record.synced };
        }).filter(Boolean);
    },

    async addToSyncQueue(request: { url: string; method: string; body: unknown }) {
        const db = await initDB();
        return db.add('syncQueue', {
            ...request,
            timestamp: Date.now(),
            retryCount: 0,
        });
    },
    async getSyncQueue() {
        const db = await initDB();
        return db.getAll('syncQueue');
    },
    async removeFromSyncQueue(timestamp: number) {
        const db = await initDB();
        return db.delete('syncQueue', timestamp);
    }
};
