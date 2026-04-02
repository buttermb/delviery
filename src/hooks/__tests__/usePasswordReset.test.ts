/**
 * usePasswordReset Hook Tests
 *
 * Tests the password reset hook's API contract:
 * - confirmReset sends new_password (snake_case) to auth-reset-password
 * - verifyToken sends action: "verify" to auth-reset-password
 * - requestReset sends to auth-forgot-password
 * - Password strength validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// Mock dependencies
const mockApiFetch = vi.fn();
vi.mock('@/lib/utils/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  getErrorMessage: (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Unknown error';
  },
}));

import { usePasswordReset, validatePasswordStrength } from '@/hooks/usePasswordReset';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockReset();
  });

  describe('confirmReset', () => {
    it('should send new_password in snake_case to auth-reset-password', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.confirmReset({
          token: 'test-token-123',
          newPassword: 'StrongP@ss1',
        });
      });

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/auth-reset-password'),
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
        })
      );

      const callBody = JSON.parse(
        (mockApiFetch.mock.calls[0][1] as Record<string, string>).body
      );
      expect(callBody).toEqual({
        token: 'test-token-123',
        new_password: 'StrongP@ss1',
      });
      // Verify no camelCase newPassword leaked
      expect(callBody).not.toHaveProperty('newPassword');
    });

    it('should reject weak passwords before calling API', async () => {
      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.confirmReset({
            token: 'test-token-123',
            newPassword: 'weak',
          });
        })
      ).rejects.toThrow();

      // Should not call API for weak passwords
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('should handle expired token error', async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Reset token has expired' }),
      });

      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.confirmReset({
            token: 'expired-token',
            newPassword: 'StrongP@ss1',
          });
        })
      ).rejects.toThrow(/expired/i);
    });

    it('should handle invalid token error', async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid or not found' }),
      });

      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.confirmReset({
            token: 'invalid-token',
            newPassword: 'StrongP@ss1',
          });
        })
      ).rejects.toThrow(/invalid/i);
    });
  });

  describe('verifyToken', () => {
    it('should send action: "verify" to auth-reset-password', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ valid: true, email: 'user@example.com' }),
      });

      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      let verifyResult: { valid: boolean; email?: string };
      await act(async () => {
        verifyResult = await result.current.verifyToken('test-token-123');
      });

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/auth-reset-password'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'verify', token: 'test-token-123' }),
          skipAuth: true,
        })
      );

      expect(verifyResult!.valid).toBe(true);
      expect(verifyResult!.email).toBe('user@example.com');
    });

    it('should update tokenVerification state on success', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ valid: true, email: 'user@example.com' }),
      });

      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.verifyToken('test-token-123');
      });

      expect(result.current.tokenVerification.isValid).toBe(true);
      expect(result.current.tokenVerification.email).toBe('user@example.com');
      expect(result.current.tokenVerification.error).toBeNull();
      expect(result.current.tokenVerification.isVerifying).toBe(false);
    });

    it('should update tokenVerification state on failure', async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Token has expired' }),
      });

      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.verifyToken('expired-token');
      });

      expect(result.current.tokenVerification.isValid).toBe(false);
      expect(result.current.tokenVerification.error).toBe('Token has expired');
      expect(result.current.tokenVerification.isVerifying).toBe(false);
    });

    it('should set isVerifying during token verification', async () => {
      let resolveApiFetch: (value: unknown) => void;
      mockApiFetch.mockImplementation(
        () => new Promise((resolve) => { resolveApiFetch = resolve; })
      );

      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      // Start verification without awaiting
      act(() => {
        result.current.verifyToken('test-token-123');
      });

      // Should be verifying
      await waitFor(() => {
        expect(result.current.tokenVerification.isVerifying).toBe(true);
      });

      // Resolve the API call
      await act(async () => {
        resolveApiFetch!({
          ok: true,
          json: () => Promise.resolve({ valid: true, email: 'user@example.com' }),
        });
      });

      expect(result.current.tokenVerification.isVerifying).toBe(false);
    });
  });

  describe('requestReset', () => {
    it('should call auth-forgot-password endpoint', async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => usePasswordReset(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.requestReset({
          email: 'admin@example.com',
          tenantSlug: 'test-store',
          userType: 'tenant_admin',
        });
      });

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/auth-forgot-password'),
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
        })
      );
    });
  });
});

describe('validatePasswordStrength', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePasswordStrength('Short1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });

  it('should reject passwords longer than 128 characters', () => {
    const result = validatePasswordStrength('A1!' + 'a'.repeat(126));
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be no more than 128 characters');
  });

  it('should reject passwords without uppercase', () => {
    const result = validatePasswordStrength('lowercase1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject passwords without lowercase', () => {
    const result = validatePasswordStrength('UPPERCASE1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject passwords without numbers', () => {
    const result = validatePasswordStrength('NoNumbers!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should reject passwords without special characters', () => {
    const result = validatePasswordStrength('NoSpecial1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  it('should accept strong passwords meeting all criteria', () => {
    const result = validatePasswordStrength('StrongP@ss1');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.score).toBe(5);
  });

  it('should return score based on criteria met', () => {
    // Only lowercase and length
    const result = validatePasswordStrength('longpassword');
    expect(result.score).toBe(2); // length + lowercase
  });
});
