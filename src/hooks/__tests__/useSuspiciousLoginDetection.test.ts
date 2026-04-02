/**
 * useSuspiciousLoginDetection Hook Tests
 *
 * Tests:
 * 1. Hook triggers on SIGNED_IN auth events
 * 2. Calls detect-suspicious-login edge function with correct payload
 * 3. Handles error responses gracefully (no throw)
 * 4. Logs suspicious login detections
 * 5. Skips detection when offline
 * 6. Cleans up subscription on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock device fingerprint
vi.mock('@/utils/deviceFingerprint', () => ({
  generateDeviceFingerprint: vi.fn(() => ({
    fingerprint: 'test-fingerprint-abc123',
    deviceType: 'desktop',
    browser: 'Chrome',
    os: 'MacOS',
    screenResolution: '1920x1080',
    timezone: 'America/New_York',
    language: 'en-US',
  })),
}));

const mockUnsubscribe = vi.fn();
let capturedAuthCallback: ((event: string, session: unknown) => void) | null =
  null;

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        capturedAuthCallback = cb;
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
        };
      },
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import { logger } from '@/lib/logger';
import { useSuspiciousLoginDetection } from '@/hooks/useSuspiciousLoginDetection';

describe('useSuspiciousLoginDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedAuthCallback = null;
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Chrome/120.0.0.0',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should subscribe to auth state changes on mount', () => {
    renderHook(() => useSuspiciousLoginDetection());
    expect(capturedAuthCallback).not.toBeNull();
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useSuspiciousLoginDetection());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should call edge function on SIGNED_IN event after delay', async () => {
    mockInvoke.mockResolvedValue({
      data: { suspicious: false, deviceId: 'device-1' },
      error: null,
    });

    renderHook(() => useSuspiciousLoginDetection());

    // Simulate SIGNED_IN event
    act(() => {
      capturedAuthCallback!('SIGNED_IN', { user: { id: 'user-123' } });
    });

    // Advance past the 1500ms setTimeout and flush async
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(mockInvoke).toHaveBeenCalledWith('detect-suspicious-login', {
      body: {
        userId: 'user-123',
        fingerprint: 'test-fingerprint-abc123',
        deviceType: 'desktop',
        browser: 'Chrome',
        os: 'MacOS',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        screenResolution: '1920x1080',
        timezone: 'America/New_York',
        language: 'en-US',
      },
    });
  });

  it('should not call edge function for non-SIGNED_IN events', async () => {
    renderHook(() => useSuspiciousLoginDetection());

    act(() => {
      capturedAuthCallback!('SIGNED_OUT', null);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should not call edge function when session is null', async () => {
    renderHook(() => useSuspiciousLoginDetection());

    act(() => {
      capturedAuthCallback!('SIGNED_IN', null);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should not call edge function when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false });

    mockInvoke.mockResolvedValue({ data: null, error: null });

    renderHook(() => useSuspiciousLoginDetection());

    act(() => {
      capturedAuthCallback!('SIGNED_IN', { user: { id: 'user-123' } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should log suspicious login when detected', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        suspicious: true,
        alertType: 'new_device',
        alertId: 'alert-456',
        emailSent: true,
      },
      error: null,
    });

    renderHook(() => useSuspiciousLoginDetection());

    act(() => {
      capturedAuthCallback!('SIGNED_IN', { user: { id: 'user-123' } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(logger.info).toHaveBeenCalledWith('Suspicious login detected', {
      alertType: 'new_device',
      alertId: 'alert-456',
      emailSent: true,
    });
  });

  it('should handle edge function errors gracefully', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Server error' },
    });

    renderHook(() => useSuspiciousLoginDetection());

    act(() => {
      capturedAuthCallback!('SIGNED_IN', { user: { id: 'user-123' } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Suspicious login detection error:',
      expect.objectContaining({ message: 'Server error' })
    );
  });

  it('should suppress network errors silently', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network error' },
    });

    renderHook(() => useSuspiciousLoginDetection());

    act(() => {
      capturedAuthCallback!('SIGNED_IN', { user: { id: 'user-123' } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    // Network errors should NOT be logged
    expect(logger.error).not.toHaveBeenCalled();
  });
});
