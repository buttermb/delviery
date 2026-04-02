/**
 * useEmailVerification Hook Tests
 *
 * Verifies that useEmailVerification correctly:
 * 1. Calls auth-verify-email edge function with the token
 * 2. Returns correct verification state for already-verified emails
 * 3. Handles errors from the edge function
 * 4. Returns isSuccess for successful verification
 * 5. Supports resending verification via auth-signup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Hoisted mocks
// ============================================================================

const { mockInvoke, mockSearchParams } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockSearchParams: new URLSearchParams(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams],
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) =>
    err instanceof Error ? err.message : 'Something went wrong',
}));

import { useEmailVerification } from '@/hooks/useEmailVerification';

// ============================================================================
// Test helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return QueryClientProvider({ client: queryClient, children });
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useEmailVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('token');
  });

  describe('token extraction', () => {
    it('extracts token from URL search params', () => {
      mockSearchParams.set('token', 'my-token-123');
      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });
      expect(result.current.token).toBe('my-token-123');
    });

    it('returns null when no token in URL', () => {
      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });
      expect(result.current.token).toBeNull();
    });
  });

  describe('verifyEmail mutation', () => {
    it('calls auth-verify-email with token from argument', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message: 'Email verified successfully', user_id: 'u1' },
        error: null,
      });

      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.verifyEmail.mutate('explicit-token');
      });

      await waitFor(() => expect(result.current.verifyEmail.isSuccess).toBe(true));

      expect(mockInvoke).toHaveBeenCalledWith('auth-verify-email', {
        body: { token: 'explicit-token' },
      });
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.verificationState.isAlreadyVerified).toBe(false);
    });

    it('uses URL token when no argument provided', async () => {
      mockSearchParams.set('token', 'url-token-456');
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message: 'Email verified successfully', user_id: 'u2' },
        error: null,
      });

      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.verifyEmail.mutate();
      });

      await waitFor(() => expect(result.current.verifyEmail.isSuccess).toBe(true));

      expect(mockInvoke).toHaveBeenCalledWith('auth-verify-email', {
        body: { token: 'url-token-456' },
      });
    });

    it('detects already-verified state from response', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message: 'Email already verified', already_verified: true },
        error: null,
      });

      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.verifyEmail.mutate('some-token');
      });

      await waitFor(() => expect(result.current.verifyEmail.isSuccess).toBe(true));

      expect(result.current.verificationState.isAlreadyVerified).toBe(true);
      // isSuccess should be false when already verified
      expect(result.current.isSuccess).toBe(false);
    });

    it('throws when no token available', async () => {
      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.verifyEmail.mutate();
      });

      await waitFor(() => expect(result.current.verifyEmail.isError).toBe(true));

      expect(result.current.verifyError?.message).toBe('No verification token provided');
    });

    it('handles edge function error response', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid or expired verification token' },
      });

      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.verifyEmail.mutate('bad-token');
      });

      await waitFor(() => expect(result.current.verifyEmail.isError).toBe(true));

      expect(result.current.verifyError?.message).toBe(
        'Invalid or expired verification token'
      );
    });
  });

  describe('resendVerification mutation', () => {
    it('calls auth-signup with resend flag', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, message: 'Verification email sent' },
        error: null,
      });

      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.resendVerification.mutate('user@example.com');
      });

      await waitFor(() =>
        expect(result.current.resendVerification.isSuccess).toBe(true)
      );

      expect(mockInvoke).toHaveBeenCalledWith('auth-signup', {
        body: { email: 'user@example.com', resend: true },
      });
    });

    it('throws when email is empty', async () => {
      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.resendVerification.mutate('');
      });

      await waitFor(() =>
        expect(result.current.resendVerification.isError).toBe(true)
      );

      expect(result.current.resendError?.message).toBe(
        'Email is required to resend verification'
      );
    });
  });

  describe('loading states', () => {
    it('shows isVerifying during verification', async () => {
      let resolveInvoke: (value: unknown) => void;
      mockInvoke.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInvoke = resolve;
        })
      );

      const { result } = renderHook(() => useEmailVerification(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.verifyEmail.mutate('test-token');
      });

      await waitFor(() => expect(result.current.isVerifying).toBe(true));

      await act(async () => {
        resolveInvoke!({
          data: { success: true, message: 'Email verified' },
          error: null,
        });
      });

      await waitFor(() => expect(result.current.isVerifying).toBe(false));
    });
  });
});
