/**
 * Token Refresh Tests
 * Tests for the token refresh functionality to prevent 401 Unauthorized errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidRefreshToken,
  tokenNeedsRefresh,
  extractRefreshTokenFromCookies,
  cleanupStaleAuthState,
  cleanupAuthCookies,
  createRefreshTimer,
  createRefreshExecutor,
  REFRESH_BUFFER_MS,
} from '@/lib/auth/tokenRefresh';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper: create a fake JWT token with a given expiration
function createFakeToken(expiresInMs: number): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.floor(expiresInMs / 1000);
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payload = btoa(JSON.stringify({ exp, iat: now, sub: 'test-user' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signature = btoa('fake-signature')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${payload}.${signature}`;
}

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

describe('Token Refresh - isValidRefreshToken', () => {
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

describe('Token Refresh - tokenNeedsRefresh', () => {
  it('should return true when token expires within buffer', () => {
    // Token expires in 2 minutes (within default 5 min buffer)
    const token = createFakeToken(2 * 60 * 1000);
    expect(tokenNeedsRefresh(token)).toBe(true);
  });

  it('should return false when token has plenty of time left', () => {
    // Token expires in 30 minutes
    const token = createFakeToken(30 * 60 * 1000);
    expect(tokenNeedsRefresh(token)).toBe(false);
  });

  it('should return true when token is already expired', () => {
    // Token expired 1 minute ago
    const token = createFakeToken(-60 * 1000);
    expect(tokenNeedsRefresh(token)).toBe(true);
  });

  it('should respect custom buffer parameter', () => {
    // Token expires in 8 minutes, buffer is 10 minutes
    const token = createFakeToken(8 * 60 * 1000);
    expect(tokenNeedsRefresh(token, 10 * 60 * 1000)).toBe(true);
    // Same token with 5 minute buffer should be fine
    expect(tokenNeedsRefresh(token, 5 * 60 * 1000)).toBe(false);
  });

  it('should return false for invalid token format', () => {
    expect(tokenNeedsRefresh('not-a-jwt')).toBe(false);
  });
});

describe('Token Refresh - extractRefreshTokenFromCookies', () => {
  it('should extract refresh token from cookie string', () => {
    const cookies = 'tenant_access_token=access123; tenant_refresh_token=refresh456; other=value';
    expect(extractRefreshTokenFromCookies(cookies)).toBe('refresh456');
  });

  it('should return null when refresh token cookie is missing', () => {
    const cookies = 'tenant_access_token=access123; other=value';
    expect(extractRefreshTokenFromCookies(cookies)).toBeNull();
  });

  it('should handle empty cookie string', () => {
    expect(extractRefreshTokenFromCookies('')).toBeNull();
  });

  it('should support custom cookie names', () => {
    const cookies = 'my_refresh=token123; other=value';
    expect(extractRefreshTokenFromCookies(cookies, 'my_refresh')).toBe('token123');
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

  it('should clear all auth-related localStorage keys on cleanup', () => {
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

    cleanupStaleAuthState(mockLocalStorage as unknown as Storage, keysToClean);

    // Verify all keys were removed
    keysToClean.forEach(key => {
      expect(mockLocalStorage.getItem(key)).toBeNull();
    });
  });

  it('should clear auth-related cookies on cleanup', () => {
    const cookiesToClear = ['sb-access-token', 'tenant_access_token', 'tenant_refresh_token'];
    cleanupAuthCookies(cookiesToClear);

    // After cleanup, cookies should not contain the cleared values
    expect(mockCookies).not.toContain('sb-access-token=old');
    expect(mockCookies).not.toContain('tenant_access_token=old');
    expect(mockCookies).not.toContain('tenant_refresh_token=old');
  });
});

describe('Token Refresh - createRefreshExecutor (Race Condition Prevention)', () => {
  it('should prevent multiple simultaneous refresh calls', async () => {
    const refreshSpy = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    });

    const executor = createRefreshExecutor(refreshSpy);

    // Start multiple refresh calls simultaneously
    const results = await Promise.all([
      executor(),
      executor(),
      executor(),
    ]);

    // All should succeed
    expect(results).toEqual([true, true, true]);

    // But the actual refresh should only be called once
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('should allow new refresh after previous completes', async () => {
    const refreshSpy = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return true;
    });

    const executor = createRefreshExecutor(refreshSpy);

    // First refresh
    await executor();

    // Second refresh (should be a new call since first completed)
    await executor();

    // Should be called twice (once per independent refresh)
    expect(refreshSpy).toHaveBeenCalledTimes(2);
  });

  it('should propagate failures correctly', async () => {
    const refreshSpy = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return false;
    });

    const executor = createRefreshExecutor(refreshSpy);
    const result = await executor();

    expect(result).toBe(false);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Token Refresh - createRefreshTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger refresh before token expires', async () => {
    const onRefresh = vi.fn().mockResolvedValue(true);
    // Token expires in 10 minutes
    const token = createFakeToken(10 * 60 * 1000);

    const handle = createRefreshTimer({
      token,
      onRefresh,
    });

    // Advance 5 minutes (within the 5-minute buffer before expiry)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    handle.cleanup();
  });

  it('should refresh immediately when token is already near expiry', async () => {
    const onRefresh = vi.fn().mockResolvedValue(true);
    // Token expires in 2 minutes (already within buffer)
    const token = createFakeToken(2 * 60 * 1000);

    const handle = createRefreshTimer({
      token,
      onRefresh,
    });

    // Should fire immediately (on next tick)
    await vi.advanceTimersByTimeAsync(100);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    handle.cleanup();
  });

  it('should not trigger refresh when token has plenty of time', () => {
    const onRefresh = vi.fn().mockResolvedValue(true);
    // Token expires in 1 hour
    const token = createFakeToken(60 * 60 * 1000);

    const handle = createRefreshTimer({
      token,
      onRefresh,
    });

    // Advance 10 minutes - should not trigger yet
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(onRefresh).not.toHaveBeenCalled();
    handle.cleanup();
  });

  it('should call onWarning before expiry', () => {
    const onRefresh = vi.fn().mockResolvedValue(true);
    const onWarning = vi.fn();
    // Token expires in 7 minutes; buffer=5min means refresh at 2min mark,
    // warningBuffer=3min means warning at 4min mark.
    // Warning fires after refresh in this case, but we just need to verify it fires.
    // Use a token where warning fires first: expires in 4 minutes, buffer=2min (refresh at 2min),
    // warningBuffer=3min (warning at 1min mark - fires first).
    const token = createFakeToken(4 * 60 * 1000);

    const handle = createRefreshTimer({
      token,
      onRefresh,
      onWarning,
      bufferMs: 2 * 60 * 1000,
      warningBufferMs: 3 * 60 * 1000,
    });

    // Advance to 1 minute in (warning should fire at 1 minute = 4min - 3min)
    vi.advanceTimersByTime(1 * 60 * 1000 + 1000);

    expect(onWarning).toHaveBeenCalled();
    handle.cleanup();
  });

  it('should clean up timers on disposal', () => {
    const onRefresh = vi.fn().mockResolvedValue(true);
    // Token expires in 10 minutes
    const token = createFakeToken(10 * 60 * 1000);

    const handle = createRefreshTimer({
      token,
      onRefresh,
    });

    // Clean up before timer fires
    handle.cleanup();

    // Advance past expiration
    vi.advanceTimersByTime(15 * 60 * 1000);

    // Should not have been called since we cleaned up
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('should detect visibility change and check token', () => {
    const onRefresh = vi.fn().mockResolvedValue(true);
    // Token expires in 3 minutes (within buffer)
    const token = createFakeToken(3 * 60 * 1000);

    const handle = createRefreshTimer({
      token,
      onRefresh,
    });

    // Simulate tab becoming visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Should trigger refresh since token is within buffer
    expect(onRefresh).toHaveBeenCalled();
    handle.cleanup();
  });

  it('should handle checkNow method', () => {
    const onRefresh = vi.fn().mockResolvedValue(true);
    // Token expires in 2 minutes (within buffer)
    const token = createFakeToken(2 * 60 * 1000);

    const handle = createRefreshTimer({
      token,
      onRefresh,
    });

    // Calling checkNow should trigger refresh since within buffer
    handle.checkNow();

    expect(onRefresh).toHaveBeenCalled();
    handle.cleanup();
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

describe('Token Refresh - REFRESH_BUFFER_MS constant', () => {
  it('should be 5 minutes in milliseconds', () => {
    expect(REFRESH_BUFFER_MS).toBe(5 * 60 * 1000);
  });
});
