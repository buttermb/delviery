
import { Redis } from 'https://deno.land/x/redis@v0.29.0/mod.ts';

export interface VelocityRule {
    metric: 'access_count' | 'unique_ips' | 'failed_attempts';
    threshold: number;
    timeWindow: number; // seconds
    action: 'alert' | 'soft_burn' | 'hard_burn' | 'block_tenant';
}

export const defaultVelocityRules: VelocityRule[] = [
    {
        metric: 'access_count',
        threshold: 100,
        timeWindow: 60,
        action: 'alert'
    },
    {
        metric: 'unique_ips',
        threshold: 20,
        timeWindow: 300,
        action: 'soft_burn'
    },
    {
        metric: 'failed_attempts',
        threshold: 10,
        timeWindow: 60,
        action: 'block_tenant'
    }
];

export class VelocityChecker {
    private redis: Redis;
    private isConnected = false;

    constructor(
        private hostname: string,
        private port: number,
        private password?: string
    ) { }

    async connect() {
        if (this.isConnected) return;
        try {
            this.redis = await new Redis().connect({
                hostname: this.hostname,
                port: this.port,
                password: this.password,
            });
            this.isConnected = true;
        } catch (error) {
            console.error('Failed to connect to Redis for velocity check:', error);
            throw error;
        }
    }

    async checkVelocity(menuId: string, clientIp: string): Promise<{ allowed: boolean; action?: string }> {
        if (!this.isConnected) await this.connect();

        for (const rule of defaultVelocityRules) {
            const count = await this.getMetricCount(menuId, rule.metric, rule.timeWindow, clientIp);
            if (count > rule.threshold) {
                return { allowed: false, action: rule.action };
            }
        }

        return { allowed: true };
    }

    async recordAccess(menuId: string, clientIp: string) {
        if (!this.isConnected) await this.connect();

        const now = Math.floor(Date.now() / 1000);

        // Increment access count
        const accessKey = `velocity:${menuId}:access_count`;
        await this.redis.zadd(accessKey, now, `${now}:${clientIp}`);
        await this.redis.zremrangebyscore(accessKey, '-inf', now - 300); // Keep last 5 mins
        await this.redis.expire(accessKey, 300);

        // Track unique IPs (using a set)
        const ipKey = `velocity:${menuId}:unique_ips`;
        await this.redis.sadd(ipKey, clientIp);
        await this.redis.expire(ipKey, 300);
    }

    async recordFailedAttempt(menuId: string, clientIp: string) {
        if (!this.isConnected) await this.connect();
        const now = Math.floor(Date.now() / 1000);
        const key = `velocity:${menuId}:failed_attempts`;
        await this.redis.zadd(key, now, `${now}:${clientIp}`);
        await this.redis.zremrangebyscore(key, '-inf', now - 60);
        await this.redis.expire(key, 60);
    }

    private async getMetricCount(menuId: string, metric: string, timeWindow: number, clientIp?: string): Promise<number> {
        const now = Math.floor(Date.now() / 1000);
        const start = now - timeWindow;

        if (metric === 'access_count') {
            const key = `velocity:${menuId}:access_count`;
            return await this.redis.zcount(key, start, '+inf');
        } else if (metric === 'unique_ips') {
            // This is a bit harder with sliding window, simplified to just set count for now
            // For strict sliding window unique IPs, we'd need a different structure
            const key = `velocity:${menuId}:unique_ips`;
            return await this.redis.scard(key);
        } else if (metric === 'failed_attempts') {
            const key = `velocity:${menuId}:failed_attempts`;
            return await this.redis.zcount(key, start, '+inf');
        }

        return 0;
    }
}
