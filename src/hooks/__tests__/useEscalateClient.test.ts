/**
 * useEscalateClient Hook Tests
 * Tests the escalation mutation that logs a collection activity
 * and suspends the client account.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEscalateClient } from '../useFinancialData';
import { createElement, type ReactNode } from 'react';

// Track mock calls
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

// Build chainable mock
function createChainMock(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.select = mockSelect.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.maybeSingle = mockMaybeSingle.mockReturnValue(chain);
  Object.assign(chain, overrides);
  return chain;
}

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
      }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id' },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

describe('useEscalateClient', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it('should insert escalation activity and suspend client on success', async () => {
    // First call: collection_activities insert (returns no error)
    const activityChain = createChainMock();
    activityChain.insert = mockInsert.mockReturnValueOnce({ error: null });

    // Second call: wholesale_clients update (returns no error)
    const clientChain: Record<string, unknown> = {};
    const clientEq = vi.fn().mockReturnValue(clientChain);
    clientChain.update = vi.fn().mockReturnValue(clientChain);
    clientChain.eq = clientEq;
    // First .eq returns chain, second .eq resolves with no error
    clientEq.mockReturnValueOnce(clientChain).mockReturnValueOnce({ error: null });

    mockFrom
      .mockReturnValueOnce(activityChain)   // collection_activities
      .mockReturnValueOnce(clientChain);     // wholesale_clients

    const { result } = renderHook(() => useEscalateClient(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        client_id: 'client-123',
        client_name: 'Test Business',
        outstanding_amount: 5000,
      });
    });

    // Verify collection_activities insert was called
    expect(mockFrom).toHaveBeenCalledWith('collection_activities');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-123',
        activity_type: 'escalation',
        amount: 5000,
        tenant_id: 'test-tenant-id',
        performed_by: 'test-user-id',
      })
    );

    // Verify wholesale_clients update was called
    expect(mockFrom).toHaveBeenCalledWith('wholesale_clients');
  });

  it('should include custom reason in notes when provided', async () => {
    const activityChain = createChainMock();
    activityChain.insert = mockInsert.mockReturnValueOnce({ error: null });

    const clientChain: Record<string, unknown> = {};
    const clientEq = vi.fn().mockReturnValue(clientChain);
    clientChain.update = vi.fn().mockReturnValue(clientChain);
    clientChain.eq = clientEq;
    clientEq.mockReturnValueOnce(clientChain).mockReturnValueOnce({ error: null });

    mockFrom
      .mockReturnValueOnce(activityChain)
      .mockReturnValueOnce(clientChain);

    const { result } = renderHook(() => useEscalateClient(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        client_id: 'client-123',
        client_name: 'Test Business',
        outstanding_amount: 5000,
        reason: 'Repeated missed payments',
      });
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Escalated to collections: Repeated missed payments',
      })
    );
  });

  it('should generate default notes when no reason provided', async () => {
    const activityChain = createChainMock();
    activityChain.insert = mockInsert.mockReturnValueOnce({ error: null });

    const clientChain: Record<string, unknown> = {};
    const clientEq = vi.fn().mockReturnValue(clientChain);
    clientChain.update = vi.fn().mockReturnValue(clientChain);
    clientChain.eq = clientEq;
    clientEq.mockReturnValueOnce(clientChain).mockReturnValueOnce({ error: null });

    mockFrom
      .mockReturnValueOnce(activityChain)
      .mockReturnValueOnce(clientChain);

    const { result } = renderHook(() => useEscalateClient(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        client_id: 'client-123',
        client_name: 'Test Business',
        outstanding_amount: 5000,
      });
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.stringContaining('Escalated to collections team'),
      })
    );
  });

  it('should throw when activity insert fails', async () => {
    const activityChain = createChainMock();
    activityChain.insert = mockInsert.mockReturnValueOnce({
      error: { message: 'Insert failed', code: '42501' },
    });

    mockFrom.mockReturnValueOnce(activityChain);

    const { result } = renderHook(() => useEscalateClient(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          client_id: 'client-123',
          client_name: 'Test Business',
          outstanding_amount: 5000,
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should throw when client suspend fails', async () => {
    const activityChain = createChainMock();
    activityChain.insert = mockInsert.mockReturnValueOnce({ error: null });

    const clientChain: Record<string, unknown> = {};
    const clientEq = vi.fn().mockReturnValue(clientChain);
    clientChain.update = vi.fn().mockReturnValue(clientChain);
    clientChain.eq = clientEq;
    clientEq
      .mockReturnValueOnce(clientChain)
      .mockReturnValueOnce({ error: { message: 'Update failed', code: '42501' } });

    mockFrom
      .mockReturnValueOnce(activityChain)
      .mockReturnValueOnce(clientChain);

    const { result } = renderHook(() => useEscalateClient(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          client_id: 'client-123',
          client_name: 'Test Business',
          outstanding_amount: 5000,
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should show success toast and invalidate queries on success', async () => {
    const { showSuccessToast } = await import('@/utils/toastHelpers');

    const activityChain = createChainMock();
    activityChain.insert = mockInsert.mockReturnValueOnce({ error: null });

    const clientChain: Record<string, unknown> = {};
    const clientEq = vi.fn().mockReturnValue(clientChain);
    clientChain.update = vi.fn().mockReturnValue(clientChain);
    clientChain.eq = clientEq;
    clientEq.mockReturnValueOnce(clientChain).mockReturnValueOnce({ error: null });

    mockFrom
      .mockReturnValueOnce(activityChain)
      .mockReturnValueOnce(clientChain);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEscalateClient(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        client_id: 'client-123',
        client_name: 'Test Business',
        outstanding_amount: 5000,
      });
    });

    await waitFor(() => {
      expect(showSuccessToast).toHaveBeenCalledWith(
        'Client Escalated',
        expect.stringContaining('Test Business')
      );
    });

    // Should invalidate collections, finance, and wholesale client queries
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
