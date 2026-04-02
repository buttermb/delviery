/**
 * Auth Helpers Tests
 * Tests for performFullLogout, clearAllAuthTokens, isLoggedIn, getCurrentUserType
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

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock('@/lib/react-query-config', () => ({
  appQueryClient: {
    cancelQueries: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('@/middleware/tenantMiddleware', () => ({
  getTenantSlugFromLocation: vi.fn(() => null),
}));

// Track removeItem calls for safeStorage mock
const removeItemCalls: string[] = [];
vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn((key: string) => {
      // Used by isLoggedIn and getCurrentUserType
      return null;
    }),
    setItem: vi.fn(),
    removeItem: vi.fn((key: string) => {
      removeItemCalls.push(key);
    }),
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
    COURIER_PIN_SESSION: 'courier_pin_session',
    GUEST_CART: 'guest_cart',
    CART_ITEMS: 'cart_items',
    GUEST_CHECKOUT_DATA: 'guestCheckoutData',
    CUSTOMER_MODE: 'customer_mode',
    ONBOARDING_COMPLETED: 'onboarding_completed',
    ONBOARDING_STEP: 'onboarding_step',
    ONBOARDING_DISMISSED: 'onboarding_dismissed',
    AGE_VERIFIED: 'age_verified',
    AGE_VERIFICATION_DATE: 'age_verification_date',
    FLORAIQ_USER_ID: 'floraiq_user_id',
    LAST_TENANT_SLUG: 'lastTenantSlug',
  },
}));

import {
  performFullLogout,
  clearAllAuthTokens,
  isLoggedIn,
  getCurrentUserType,
  getLoginUrl,
  isValidTenantSlug,
} from '../authHelpers';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { supabase } from '@/integrations/supabase/client';
import { safeStorage } from '@/utils/safeStorage';
import { appQueryClient } from '@/lib/react-query-config';

describe('clearAllAuthTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeItemCalls.length = 0;
  });

  it('should remove all auth tokens from storage', () => {
    clearAllAuthTokens();

    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_user');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_refresh_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_user');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_data');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_user');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_tenant_data');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('courier_pin_session');
  });
});

describe('performFullLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeItemCalls.length = 0;
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
  });

  it('should destroy encryption session', async () => {
    await performFullLogout();
    expect(clientEncryption.destroy).toHaveBeenCalledOnce();
  });

  it('should sign out from Supabase', async () => {
    await performFullLogout();
    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });

  it('should clear all auth tokens', async () => {
    await performFullLogout();

    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('tenant_admin_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_access_token');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('courier_pin_session');
  });

  it('should clear cart and checkout data', async () => {
    await performFullLogout();

    expect(safeStorage.removeItem).toHaveBeenCalledWith('guest_cart');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('cart_items');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('guestCheckoutData');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('customer_mode');
  });

  it('should clear onboarding data', async () => {
    await performFullLogout();

    expect(safeStorage.removeItem).toHaveBeenCalledWith('onboarding_completed');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('onboarding_step');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('onboarding_dismissed');
  });

  it('should clear age verification data', async () => {
    await performFullLogout();

    expect(safeStorage.removeItem).toHaveBeenCalledWith('age_verified');
    expect(safeStorage.removeItem).toHaveBeenCalledWith('age_verification_date');
  });

  it('should clear TanStack Query cache', async () => {
    await performFullLogout();

    expect(appQueryClient.cancelQueries).toHaveBeenCalled();
    expect(appQueryClient.clear).toHaveBeenCalled();
  });

  it('should handle encryption destroy failure gracefully', async () => {
    vi.mocked(clientEncryption.destroy).mockImplementation(() => {
      throw new Error('destroy failed');
    });

    await expect(performFullLogout()).resolves.not.toThrow();
    // Should still sign out even if encryption destroy fails
    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });

  it('should handle Supabase signOut failure gracefully', async () => {
    vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error('signout failed'));

    await expect(performFullLogout()).resolves.not.toThrow();
    // Should still clear tokens even if signout fails
    expect(safeStorage.removeItem).toHaveBeenCalledWith('super_admin_access_token');
  });

  it('should handle query cache clear failure gracefully', async () => {
    vi.mocked(appQueryClient.clear).mockImplementation(() => {
      throw new Error('clear failed');
    });

    await expect(performFullLogout()).resolves.not.toThrow();
  });
});

describe('isLoggedIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when no tokens exist', () => {
    vi.mocked(safeStorage.getItem).mockReturnValue(null);
    expect(isLoggedIn()).toBe(false);
  });

  it('should return true when super admin token exists', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) =>
      key === 'super_admin_access_token' ? 'token' : null,
    );
    expect(isLoggedIn()).toBe(true);
  });

  it('should return true when tenant admin token exists', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) =>
      key === 'tenant_admin_access_token' ? 'token' : null,
    );
    expect(isLoggedIn()).toBe(true);
  });

  it('should return true when customer token exists', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) =>
      key === 'customer_access_token' ? 'token' : null,
    );
    expect(isLoggedIn()).toBe(true);
  });

  it('should return true when courier session exists', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) =>
      key === 'courier_pin_session' ? 'session' : null,
    );
    expect(isLoggedIn()).toBe(true);
  });
});

describe('getCurrentUserType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no tokens exist', () => {
    vi.mocked(safeStorage.getItem).mockReturnValue(null);
    expect(getCurrentUserType()).toBeNull();
  });

  it('should return super_admin when super admin token exists', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) =>
      key === 'super_admin_access_token' ? 'token' : null,
    );
    expect(getCurrentUserType()).toBe('super_admin');
  });

  it('should return tenant_admin when tenant admin token exists', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) =>
      key === 'tenant_admin_access_token' ? 'token' : null,
    );
    expect(getCurrentUserType()).toBe('tenant_admin');
  });

  it('should return customer when customer token exists', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) =>
      key === 'customer_access_token' ? 'token' : null,
    );
    expect(getCurrentUserType()).toBe('customer');
  });

  it('should return courier when courier session exists', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) =>
      key === 'courier_pin_session' ? 'session' : null,
    );
    expect(getCurrentUserType()).toBe('courier');
  });

  it('should prioritize super_admin over other tiers', () => {
    vi.mocked(safeStorage.getItem).mockImplementation((key: string) => {
      if (key === 'super_admin_access_token') return 'sa-token';
      if (key === 'tenant_admin_access_token') return 'ta-token';
      return null;
    });
    expect(getCurrentUserType()).toBe('super_admin');
  });
});

describe('getLoginUrl', () => {
  it('should return super admin login URL', () => {
    expect(getLoginUrl('super_admin')).toBe('/super-admin/login');
  });

  it('should return tenant admin login URL with slug', () => {
    expect(getLoginUrl('tenant_admin', 'acme')).toBe('/acme/admin/login');
  });

  it('should return customer login URL with slug', () => {
    expect(getLoginUrl('customer', 'acme')).toBe('/acme/shop/login');
  });

  it('should return courier login URL', () => {
    expect(getLoginUrl('courier')).toBe('/courier/login');
  });
});

describe('isValidTenantSlug', () => {
  it('should accept valid slugs', () => {
    expect(isValidTenantSlug('acme')).toBe(true);
    expect(isValidTenantSlug('my-store')).toBe(true);
    expect(isValidTenantSlug('store_1')).toBe(true);
    expect(isValidTenantSlug('abc')).toBe(true);
  });

  it('should reject invalid slugs', () => {
    expect(isValidTenantSlug('ab')).toBe(false); // Too short
    expect(isValidTenantSlug('AB')).toBe(false); // Uppercase
    expect(isValidTenantSlug('a'.repeat(51))).toBe(false); // Too long
    expect(isValidTenantSlug('with space')).toBe(false);
    expect(isValidTenantSlug('with.dot')).toBe(false);
  });
});
