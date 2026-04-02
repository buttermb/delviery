/**
 * Logout Cleanup Tests
 * Tests for performLogoutCleanup and broadcastLogout utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// Mock dependencies before imports
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

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('@/constants/storageKeys', () => ({
  STORAGE_KEYS: {
    SUPER_ADMIN_ACCESS_TOKEN: 'super_admin_access_token',
    SUPER_ADMIN_USER: 'super_admin_user',
    SUPER_ADMIN_TENANT_ID: 'super_admin_tenant_id',
    TENANT_ADMIN_ACCESS_TOKEN: 'tenant_admin_access_token',
    TENANT_ADMIN_REFRESH_TOKEN: 'tenant_admin_refresh_token',
    TENANT_ADMIN_USER: 'tenant_admin_user',
    TENANT_DATA: 'tenant_data',
    CUSTOMER_ACCESS_TOKEN: 'customer_access_token',
    CUSTOMER_USER: 'customer_user',
    CUSTOMER_TENANT_DATA: 'customer_tenant_data',
    GUEST_CART: 'guest_cart',
    CART_ITEMS: 'cart_items',
    GUEST_CHECKOUT_DATA: 'guestCheckoutData',
    CUSTOMER_MODE: 'customer_mode',
  },
}));

import { performLogoutCleanup, broadcastLogout } from '../logoutCleanup';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { invalidateSessionNonce } from '@/lib/auth/sessionFixation';
import { safeStorage } from '@/utils/safeStorage';

describe('performLogoutCleanup', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    vi.spyOn(queryClient, 'clear');
  });

  it('should invalidate session nonce', () => {
    performLogoutCleanup({ queryClient, tier: 'tenant_admin' });
    expect(invalidateSessionNonce).toHaveBeenCalledOnce();
  });

  it('should destroy encryption session', () => {
    performLogoutCleanup({ queryClient, tier: 'tenant_admin' });
    expect(clientEncryption.destroy).toHaveBeenCalledOnce();
  });

  it('should clear query cache when queryClient provided', () => {
    performLogoutCleanup({ queryClient, tier: 'tenant_admin' });
    expect(queryClient.clear).toHaveBeenCalledOnce();
  });

  it('should not throw when queryClient not provided', () => {
    expect(() => performLogoutCleanup({ tier: 'base' })).not.toThrow();
  });

  it('should clear super_admin tier storage keys', () => {
    performLogoutCleanup({ queryClient, tier: 'super_admin' });

    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_user');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_tenant_id');
  });

  it('should clear tenant_admin tier storage keys', () => {
    performLogoutCleanup({ queryClient, tier: 'tenant_admin' });

    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_refresh_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_user');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_data');
  });

  it('should clear customer tier storage keys', () => {
    performLogoutCleanup({ queryClient, tier: 'customer' });

    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_user');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_tenant_data');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('guest_cart');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('cart_items');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('guestCheckoutData');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_mode');
  });

  it('should clear shared keys for all tiers', () => {
    performLogoutCleanup({ queryClient, tier: 'base' });

    expect(safeStorage.removeItem).toHaveBeenCalledWith('floraiq_user_id');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('lastTenantSlug');
  });

  it('should not clear tier-specific keys for base tier', () => {
    performLogoutCleanup({ queryClient, tier: 'base' });

    // Only shared keys + sessionStorage cleanup, no tier keys
    expect(safeStorage.removeItem).toHaveBeenCalledWith('floraiq_user_id');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('lastTenantSlug');
    // Should not clear any tier-specific tokens
    expect(safeStorage.removeItem).not.toHaveBeenCalledWith('super_admin_access_token');
    expect(safeStorage.removeItem).not.toHaveBeenCalledWith('tenant_admin_access_token');
    expect(safeStorage.removeItem).not.toHaveBeenCalledWith('customer_access_token');
  });

  it('should handle encryption destroy failure gracefully', () => {
    vi.mocked(clientEncryption.destroy).mockImplementation(() => {
      throw new Error('destroy failed');
    });

    expect(() => performLogoutCleanup({ queryClient, tier: 'tenant_admin' })).not.toThrow();
  });

  it('should handle session nonce invalidation failure gracefully', () => {
    vi.mocked(invalidateSessionNonce).mockImplementation(() => {
      throw new Error('nonce failed');
    });

    expect(() => performLogoutCleanup({ queryClient, tier: 'tenant_admin' })).not.toThrow();
  });

  it('should handle query cache clear failure gracefully', () => {
    vi.spyOn(queryClient, 'clear').mockImplementation(() => {
      throw new Error('clear failed');
    });

    expect(() => performLogoutCleanup({ queryClient, tier: 'tenant_admin' })).not.toThrow();
  });
});

describe('broadcastLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should broadcast logout message to channel', () => {
    const mockPostMessage = vi.fn();
    const mockClose = vi.fn();

    // Use a class-based mock for BroadcastChannel
    class MockBroadcastChannel {
      postMessage = mockPostMessage;
      close = mockClose;
      constructor(public name: string) {}
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    broadcastLogout('tenant_auth_channel');

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'LOGOUT' });
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('should handle BroadcastChannel not available gracefully', () => {
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('BroadcastChannel not supported');
      }
    });

    expect(() => broadcastLogout('channel')).not.toThrow();
  });
});
