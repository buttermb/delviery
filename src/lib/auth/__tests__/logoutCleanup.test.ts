/**
 * Logout Cleanup Utility Tests
 * Tests the performLogoutCleanup and broadcastLogout functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/encryption/clientEncryption', () => ({
  clientEncryption: {
    destroy: vi.fn(),
  },
}));

vi.mock('@/lib/auth/sessionFixation', () => ({
  invalidateSessionNonce: vi.fn(),
}));

vi.mock('@/utils/safeStorage', () => {
  const storage = new Map<string, string>();
  return {
    safeStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      _storage: storage,
    },
  };
});

import { performLogoutCleanup, broadcastLogout } from '../logoutCleanup';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { invalidateSessionNonce } from '@/lib/auth/sessionFixation';
import { safeStorage } from '@/utils/safeStorage';

describe('performLogoutCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Access internal storage map to set up state
    const storage = (safeStorage as unknown as { _storage: Map<string, string> })._storage;
    storage.clear();
  });

  it('should invalidate session nonce', () => {
    performLogoutCleanup({ tier: 'tenant_admin' });
    expect(invalidateSessionNonce).toHaveBeenCalled();
  });

  it('should destroy encryption session', () => {
    performLogoutCleanup({ tier: 'tenant_admin' });
    expect(clientEncryption.destroy).toHaveBeenCalled();
  });

  it('should clear TanStack Query cache when queryClient provided', () => {
    const mockQueryClient = {
      clear: vi.fn(),
    };

    performLogoutCleanup({
      queryClient: mockQueryClient as unknown as Parameters<typeof performLogoutCleanup>[0]['queryClient'],
      tier: 'tenant_admin',
    });

    expect(mockQueryClient.clear).toHaveBeenCalled();
  });

  it('should not throw when queryClient is not provided', () => {
    expect(() => {
      performLogoutCleanup({ tier: 'tenant_admin' });
    }).not.toThrow();
  });

  it('should remove tenant admin storage keys', () => {
    performLogoutCleanup({ tier: 'tenant_admin' });

    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_refresh_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_user');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_data');
  });

  it('should remove shared storage keys', () => {
    performLogoutCleanup({ tier: 'tenant_admin' });

    expect(safeStorage.removeItem).toHaveBeenCalledWith('floraiq_user_id');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('lastTenantSlug');
  });

  it('should remove super admin storage keys for super_admin tier', () => {
    performLogoutCleanup({ tier: 'super_admin' });

    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_user');
  });

  it('should remove customer storage keys for customer tier', () => {
    performLogoutCleanup({ tier: 'customer' });

    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_user');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_tenant_data');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('guest_cart');
  });

  it('should handle encryption destroy failure gracefully', () => {
    (clientEncryption.destroy as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('Encryption destroy failed');
    });

    expect(() => {
      performLogoutCleanup({ tier: 'tenant_admin' });
    }).not.toThrow();
  });

  it('should handle session nonce invalidation failure gracefully', () => {
    (invalidateSessionNonce as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('Nonce invalidation failed');
    });

    expect(() => {
      performLogoutCleanup({ tier: 'tenant_admin' });
    }).not.toThrow();
  });

  it('should handle query cache clear failure gracefully', () => {
    const mockQueryClient = {
      clear: vi.fn().mockImplementation(() => {
        throw new Error('Cache clear failed');
      }),
    };

    expect(() => {
      performLogoutCleanup({
        queryClient: mockQueryClient as unknown as Parameters<typeof performLogoutCleanup>[0]['queryClient'],
        tier: 'tenant_admin',
      });
    }).not.toThrow();
  });
});

describe('broadcastLogout', () => {
  it('should not throw when called with a valid channel name', () => {
    expect(() => {
      broadcastLogout('tenant_auth_channel');
    }).not.toThrow();
  });

  it('should not throw when BroadcastChannel constructor throws', () => {
    const originalBC = globalThis.BroadcastChannel;
    // Force BroadcastChannel to throw
    globalThis.BroadcastChannel = function () {
      throw new Error('Not supported');
    } as unknown as typeof BroadcastChannel;

    try {
      expect(() => {
        broadcastLogout('tenant_auth_channel');
      }).not.toThrow();
    } finally {
      globalThis.BroadcastChannel = originalBC;
    }
  });
});
