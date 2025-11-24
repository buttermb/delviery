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
            data: any; // Encrypted data or plain object
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
            body: any;
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
            upgrade(db, oldVersion, newVersion, transaction) {
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
    async saveProduct(product: any) {
        const db = await initDB();
        return db.put('products', product);
    },

    // Secure Order Methods
    async saveOrder(order: any) {
        const db = await initDB();
        let dataToStore = order;
        let isEncrypted = false;

        // Encrypt if encryption is ready
        if (clientEncryption.isReady()) {
            try {
                // Encrypt the sensitive order details
                // We keep 'id' and 'createdAt' top level for querying, but encrypt the rest
                const sensitiveData = { ...order };
                delete sensitiveData.id;
                delete sensitiveData.createdAt;

                dataToStore = clientEncryption.encrypt(sensitiveData);
                isEncrypted = true;
            } catch (e) {
                logger.warn('Failed to encrypt order, storing plain text', e, { component: 'idb' });
            }
        }

        return db.put('orders', {
            id: order.id,
            data: dataToStore,
            encrypted: isEncrypted,
            createdAt: order.createdAt || Date.now(),
            synced: false
        });
    },

    async getOrder(id: string) {
        const db = await initDB();
        const record = await db.get('orders', id);

        if (!record) return null;

        if (record.encrypted && clientEncryption.isReady()) {
            try {
                const decryptedData = clientEncryption.decrypt(record.data) as Record<string, any>;
                return {
                    id: record.id,
                    ...decryptedData,
                    createdAt: record.createdAt,
                    synced: record.synced
                };
            } catch (e) {
                logger.error('Failed to decrypt order', e, { component: 'IDB', orderId: record.id });
                return null; // Or throw error
            }
        }

        // Return as is if not encrypted or encryption not ready (fallback)
        return record.encrypted ? null : { ...record.data, id: record.id, createdAt: record.createdAt, synced: record.synced };
    },

    async getAllOrders() {
        const db = await initDB();
        const records = await db.getAll('orders');

        if (!clientEncryption.isReady()) {
            return records.filter(r => !r.encrypted).map(r => ({ ...r.data, id: r.id, createdAt: r.createdAt, synced: r.synced }));
        }

        return records.map(record => {
            if (record.encrypted) {
                try {
                    const decryptedData = clientEncryption.decrypt(record.data) as Record<string, any>;
                    return {
                        id: record.id,
                        ...decryptedData,
                        createdAt: record.createdAt,
                        synced: record.synced
                    };
                } catch (e) {
                    logger.error('Failed to decrypt order', { id: record.id, component: 'idb' });
                    return null;
                }
            }
            return { ...record.data, id: record.id, createdAt: record.createdAt, synced: record.synced };
        }).filter(Boolean);
    },

    async addToSyncQueue(request: { url: string; method: string; body: any }) {
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
