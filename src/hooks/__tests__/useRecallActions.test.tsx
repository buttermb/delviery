import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: Error, fallback: string) => err?.message || fallback,
}));

// ============================================================================
// Test setup
// ============================================================================

import { useRecallActions } from '@/hooks/useRecallActions';
import { toast } from 'sonner';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useRecallActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls notify-recall edge function with correct params', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, customers_notified: 5, recall_id: 'r1' },
      error: null,
    });

    const { result } = renderHook(() => useRecallActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.notifyRecall.mutateAsync({
        recall_id: 'r1',
        notification_method: 'email',
      });
    });

    expect(mockInvoke).toHaveBeenCalledWith('notify-recall', {
      body: { recall_id: 'r1', notification_method: 'email' },
    });
  });

  it('shows success toast with customer count on success', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, customers_notified: 3, recall_id: 'r1' },
      error: null,
    });

    const { result } = renderHook(() => useRecallActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.notifyRecall.mutateAsync({ recall_id: 'r1' });
    });

    expect(toast.success).toHaveBeenCalledWith(
      'Recall notifications sent to 3 customers'
    );
  });

  it('shows error toast on failure', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Edge function error'),
    });

    const { result } = renderHook(() => useRecallActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.notifyRecall.mutateAsync({ recall_id: 'bad' });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('defaults notification_method when not provided', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, customers_notified: 0, recall_id: 'r1' },
      error: null,
    });

    const { result } = renderHook(() => useRecallActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.notifyRecall.mutateAsync({ recall_id: 'r1' });
    });

    expect(mockInvoke).toHaveBeenCalledWith('notify-recall', {
      body: { recall_id: 'r1' },
    });
  });

  it('supports sms and both notification methods', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, customers_notified: 1, recall_id: 'r1' },
      error: null,
    });

    const { result } = renderHook(() => useRecallActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.notifyRecall.mutateAsync({
        recall_id: 'r1',
        notification_method: 'sms',
      });
    });

    expect(mockInvoke).toHaveBeenCalledWith('notify-recall', {
      body: { recall_id: 'r1', notification_method: 'sms' },
    });
  });
});
