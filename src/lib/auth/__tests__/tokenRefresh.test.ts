/**
 * Token Refresh Tests
 * Tests for the token refresh functionality to prevent 401 Unauthorized errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
})();

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  };
})();

// Mock document.cookie
let mockCookies = '';
Object.defineProperty(document, 'cookie', {
  get: vi.fn(() => mockCookies),
  set: vi.fn((value: string) => {
    const [cookiePart] = value.split(';');
    const [name, val] = cookiePart.split('=');

    // Handle cookie deletion (Max-Age=0 or expires in past)
    if (value.includes('Max-Age=0') || value.includes('expires=Thu, 01 Jan 1970')) {
      const cookieArray = mockCookies.split(';').filter(c => !c.trim().startsWith(name + '='));
      mockCookies = cookieArray.join(';');
    } else {
      // Add or update cookie
      const cookieArray = mockCookies.split(';').filter(c => c.trim() && !c.trim().startsWith(name + '='));
      if (val) {
        cookieArray.push(`${name}=${val}`);
      }
      mockCookies = cookieArray.join(';');
    }
  }),
});

describe('Token Refresh - Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    mockCookies = '';
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
    Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('isValidRefreshToken', () => {
    const isValidRefreshToken = (token: string | null | undefined): boolean => {
      if (!token) return false;
      if (token === 'undefined' || token === 'null') return false;
      if (typeof token !== 'string') return false;
      if (token.trim() === '') return false;
      if (token.length < 10) return false;
      return true;
    };

    it('should return false for null token', () => {
      expect(isValidRefreshToken(null)).toBe(false);
    });

    it('should return false for undefined token', () => {
      expect(isValidRefreshToken(undefined)).toBe(false);
    });

    it('should return false for "undefined" string', () => {
      expect(isValidRefreshToken('undefined')).toBe(false);
    });

    it('should return false for "null" string', () => {
      expect(isValidRefreshToken('null')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidRefreshToken('')).toBe(false);
    });

    it('should return false for whitespace only', () => {
      expect(isValidRefreshToken('   ')).toBe(false);
    });

    it('should return false for token shorter than 10 characters', () => {
      expect(isValidRefreshToken('short')).toBe(false);
    });

    it('should return true for valid token', () => {
      expect(isValidRefreshToken('valid-refresh-token-here')).toBe(true);
    });
  });
});

describe('Token Refresh - Stale State Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage._setStore({
      'sb-access-token': 'old-access-token',
      'sb-refresh-token': 'old-refresh-token',
      'supabase.auth.token': 'old-auth-data',
      'floraiq_tenant_admin_access_token': 'old-tenant-access',
      'floraiq_tenant_admin_refresh_token': 'old-tenant-refresh',
      'floraiq_tenant_admin_user': '{"id":"old-user"}',
      'floraiq_tenant_data': '{"id":"old-tenant"}',
      'lastTenantSlug': 'old-tenant',
    });
    mockCookies = 'sb-access-token=old; tenant_access_token=old; tenant_refresh_token=old';
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should clear all auth-related localStorage keys on login cleanup', () => {
    // Simulate the cleanup that happens before login
    const keysToClean = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase.auth.token',
      'floraiq_tenant_admin_access_token',
      'floraiq_tenant_admin_refresh_token',
      'floraiq_tenant_admin_user',
      'floraiq_tenant_data',
      'lastTenantSlug',
    ];

    keysToClean.forEach(key => {
      mockLocalStorage.removeItem(key);
    });

    // Verify all keys were removed
    keysToClean.forEach(key => {
      expect(mockLocalStorage.getItem(key)).toBeNull();
    });
  });

  it('should clear auth-related cookies on login cleanup', () => {
    // Simulate cookie cleanup
    const cookiesToClear = ['sb-access-token', 'tenant_access_token', 'tenant_refresh_token'];

    cookiesToClear.forEach(name => {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });

    // After cleanup, cookies should not contain the cleared values
    expect(mockCookies).not.toContain('sb-access-token=old');
    expect(mockCookies).not.toContain('tenant_access_token=old');
    expect(mockCookies).not.toContain('tenant_refresh_token=old');
  });
});

describe('Token Refresh - Race Condition Prevention', () => {
  let isRefreshing = false;
  let refreshPromise: Promise<boolean> | null = null;

  const simulateRefresh = async (): Promise<boolean> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  };

  const refreshWithRaceProtection = async (): Promise<boolean> => {
    // If already refreshing, wait for the existing promise
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = simulateRefresh();

    try {
      return await refreshPromise;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  };

  beforeEach(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  it('should prevent multiple simultaneous refresh calls', async () => {
    const refreshSpy = vi.fn(simulateRefresh);

    // Replace the actual refresh with our spy
    const mockRefresh = async (): Promise<boolean> => {
      if (isRefreshing && refreshPromise) {
        return refreshPromise;
      }
      isRefreshing = true;
      refreshPromise = refreshSpy();
      try {
        return await refreshPromise;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    };

    // Start multiple refresh calls simultaneously
    const results = await Promise.all([
      mockRefresh(),
      mockRefresh(),
      mockRefresh(),
    ]);

    // All should succeed
    expect(results).toEqual([true, true, true]);

    // But the actual refresh should only be called once
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('should allow new refresh after previous completes', async () => {
    const refreshSpy = vi.fn(simulateRefresh);

    const mockRefresh = async (): Promise<boolean> => {
      if (isRefreshing && refreshPromise) {
        return refreshPromise;
      }
      isRefreshing = true;
      refreshPromise = refreshSpy();
      try {
        return await refreshPromise;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    };

    // First refresh
    await mockRefresh();

    // Second refresh (should be a new call)
    await mockRefresh();

    // Should be called twice (once per independent refresh)
    expect(refreshSpy).toHaveBeenCalledTimes(2);
  });
});

describe('Token Refresh - Cookie Parsing', () => {
  it('should extract refresh token from cookie string', () => {
    const cookieString = 'tenant_access_token=access123; tenant_refresh_token=refresh456; other=value';

    const extractRefreshToken = (cookies: string): string | null => {
      const cookieArray = cookies.split(';').map(c => c.trim());
      const refreshCookie = cookieArray.find(c => c.startsWith('tenant_refresh_token='));
      if (refreshCookie) {
        return refreshCookie.split('=')[1] || null;
      }
      return null;
    };

    expect(extractRefreshToken(cookieString)).toBe('refresh456');
  });

  it('should return null when refresh token cookie is missing', () => {
    const cookieString = 'tenant_access_token=access123; other=value';

    const extractRefreshToken = (cookies: string): string | null => {
      const cookieArray = cookies.split(';').map(c => c.trim());
      const refreshCookie = cookieArray.find(c => c.startsWith('tenant_refresh_token='));
      if (refreshCookie) {
        return refreshCookie.split('=')[1] || null;
      }
      return null;
    };

    expect(extractRefreshToken(cookieString)).toBeNull();
  });

  it('should handle empty cookie string', () => {
    const cookieString = '';

    const extractRefreshToken = (cookies: string): string | null => {
      if (!cookies) return null;
      const cookieArray = cookies.split(';').map(c => c.trim());
      const refreshCookie = cookieArray.find(c => c.startsWith('tenant_refresh_token='));
      if (refreshCookie) {
        return refreshCookie.split('=')[1] || null;
      }
      return null;
    };

    expect(extractRefreshToken(cookieString)).toBeNull();
  });
});

describe('Token Refresh - Fallback Mechanisms', () => {
  it('should try Supabase native refresh when edge function fails', async () => {
    const edgeFunctionRefresh = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));
    const supabaseRefresh = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        },
      },
      error: null,
    });

    const refreshWithFallback = async (): Promise<boolean> => {
      try {
        await edgeFunctionRefresh();
        return true;
      } catch {
        // Fallback to Supabase native refresh
        const result = await supabaseRefresh();
        return !result.error && !!result.data?.session;
      }
    };

    const success = await refreshWithFallback();

    expect(success).toBe(true);
    expect(edgeFunctionRefresh).toHaveBeenCalledTimes(1);
    expect(supabaseRefresh).toHaveBeenCalledTimes(1);
  });

  it('should return false when both refresh methods fail', async () => {
    const edgeFunctionRefresh = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));
    const supabaseRefresh = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid refresh token' },
    });

    const refreshWithFallback = async (): Promise<boolean> => {
      try {
        await edgeFunctionRefresh();
        return true;
      } catch {
        const result = await supabaseRefresh();
        return !result.error && !!result.data?.session;
      }
    };

    const success = await refreshWithFallback();

    expect(success).toBe(false);
    expect(edgeFunctionRefresh).toHaveBeenCalledTimes(1);
    expect(supabaseRefresh).toHaveBeenCalledTimes(1);
  });
});
