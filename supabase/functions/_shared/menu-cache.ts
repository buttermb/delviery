
import { connect, Redis } from 'https://deno.land/x/redis@v0.29.0/mod.ts';

export interface MenuCacheItem {
    decryptedData: any;
    products: any[];
    accessCount: number;
    lastAccessed: string;
}

export class MenuCache {
    private redis: Redis | null = null;
    private isConnected = false;

    constructor(
        private hostname: string,
        private port: number,
        private password?: string
    ) { }

    async connect() {
        if (this.isConnected && this.redis) return;

        try {
            this.redis = await connect({
                hostname: this.hostname,
                port: this.port,
                password: this.password,
            });
            this.isConnected = true;
            console.log('Connected to Redis');
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    private getCacheKey(tenantId: string, menuId: string): string {
        return `menu:${tenantId}:${menuId}`;
    }

    async get(tenantId: string, menuId: string): Promise<MenuCacheItem | null> {
        if (!this.isConnected || !this.redis) await this.connect();
        if (!this.redis) return null;

        const key = this.getCacheKey(tenantId, menuId);
        const data = await this.redis.get(key);

        if (!data) return null;

        try {
            return JSON.parse(data);
        } catch (error) {
            console.error('Error parsing cached menu data:', error);
            return null;
        }
    }

    async set(
        tenantId: string,
        menuId: string,
        data: MenuCacheItem,
        ttlSeconds: number = 3600
    ): Promise<void> {
        if (!this.isConnected || !this.redis) await this.connect();
        if (!this.redis) return;

        const key = this.getCacheKey(tenantId, menuId);
        await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
    }

    async invalidate(tenantId: string, menuId: string): Promise<void> {
        if (!this.isConnected || !this.redis) await this.connect();
        if (!this.redis) return;

        const key = this.getCacheKey(tenantId, menuId);
        await this.redis.del(key);
    }

    async incrementAccessCount(tenantId: string, menuId: string): Promise<void> {
        if (!this.isConnected || !this.redis) await this.connect();
        if (!this.redis) return;
        
        // This is a simplified approach. Ideally we'd update the JSON or use a separate counter key.
        // For now, let's assume we might want to track this separately for speed.
        const statsKey = `menu:stats:${tenantId}:${menuId}`;
        await this.redis.incr(statsKey);
    }
}
