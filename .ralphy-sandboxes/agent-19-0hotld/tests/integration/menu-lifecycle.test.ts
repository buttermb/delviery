
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VelocityChecker } from '../../supabase/functions/_shared/velocity-check';
import { AutoBurnEngine } from '../../src/lib/security/auto-burn';
import { MenuCache } from '../../supabase/functions/_shared/menu-cache';

// Mock Redis
const mockRedis = {
    connect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
};

// Mock Supabase Client
const mockSupabase = {
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(),
                data: null,
                error: null
            }))
        })),
        update: vi.fn(() => ({
            eq: vi.fn(() => ({
                data: null,
                error: null
            }))
        })),
        insert: vi.fn(() => ({
            select: vi.fn(() => ({
                single: vi.fn(),
                data: null,
                error: null
            }))
        }))
    })),
    rpc: vi.fn()
};

describe('Menu Lifecycle Integration', () => {
    let velocityChecker: VelocityChecker;
    let autoBurnEngine: AutoBurnEngine;
    let menuCache: MenuCache;

    beforeEach(() => {
        vi.clearAllMocks();
        velocityChecker = new VelocityChecker(mockRedis as any);
        autoBurnEngine = new AutoBurnEngine(mockSupabase as any);
        menuCache = new MenuCache(mockRedis as any);
    });

    it('should allow access when velocity is low', async () => {
        const ip = '192.168.1.1';
        const menuId = 'menu-123';

        // Mock Redis responses for velocity check
        mockRedis.get.mockResolvedValue(null); // No previous attempts
        mockRedis.incr.mockResolvedValue(1);

        const result = await velocityChecker.checkVelocity(ip, menuId);
        expect(result.allowed).toBe(true);
    });

    it('should trigger auto-burn when max views exceeded', async () => {
        const menuId = 'menu-burn-1';
        const menuConfig = {
            id: menuId,
            settings: {
                max_views: 5,
                auto_burn: true
            },
            status: 'active'
        };

        // Simulate 6th view
        const currentViews = 6;

        // Mock Supabase update for burn
        const updateMock = vi.fn().mockResolvedValue({ data: { status: 'burned' }, error: null });
        mockSupabase.from.mockReturnValue({
            update: () => ({
                eq: updateMock
            })
        } as any);

        await autoBurnEngine.evaluateBurnConditions(menuConfig, {
            views: currentViews,
            velocity_score: 0,
            security_events: 0
        });

        expect(updateMock).toHaveBeenCalled();
    });

    it('should cache menu data after first fetch', async () => {
        const menuId = 'menu-cache-1';
        const menuData = { id: menuId, title: 'Cached Menu' };

        // 1. Cache Miss
        mockRedis.get.mockResolvedValue(null);
        const cached = await menuCache.get(menuId);
        expect(cached).toBeNull();

        // 2. Set Cache
        await menuCache.set(menuId, menuData);
        expect(mockRedis.set).toHaveBeenCalledWith(
            expect.stringContaining(menuId),
            expect.any(String),
            expect.any(Object)
        );
    });
});
