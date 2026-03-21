/**
 * useDeleteInvoice Tests
 * Verifies that delete only allows draft invoices
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// Mock supabase client
const mockMaybeSingle = vi.fn();
const mockDelete = vi.fn();

const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: mockMaybeSingle,
  delete: vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
  },
}));

vi.mock('@/hooks/crm/useAccountId', () => ({
  useAccountIdSafe: vi.fn().mockReturnValue('account-123'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((err: unknown) => err instanceof Error ? err.message : String(err)),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    crm: {
      invoices: {
        all: () => ['crm', 'invoices'],
        lists: () => ['crm', 'invoices', 'list'],
        detail: (id: string) => ['crm', 'invoices', id],
        byClient: (id: string) => ['crm', 'invoices', 'client', id],
      },
    },
  },
}));

import { useInvoices } from '@/hooks/crm/useInvoices';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useDeleteInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow deletion of draft invoices', async () => {
    // Mock: invoice lookup returns draft status
    mockMaybeSingle.mockResolvedValueOnce({
      data: { status: 'draft' },
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => {
      const { useDeleteInvoice } = useInvoices();
      return useDeleteInvoice();
    }, { wrapper });

    result.current.mutate('invoice-1');

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    });

    // Should succeed — draft invoice can be deleted
    expect(result.current.isSuccess).toBe(true);
  });

  it('should reject deletion of sent invoices', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { status: 'sent' },
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => {
      const { useDeleteInvoice } = useInvoices();
      return useDeleteInvoice();
    }, { wrapper });

    result.current.mutate('invoice-2');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Only draft invoices can be deleted');
  });

  it('should reject deletion of paid invoices', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { status: 'paid' },
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => {
      const { useDeleteInvoice } = useInvoices();
      return useDeleteInvoice();
    }, { wrapper });

    result.current.mutate('invoice-3');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Only draft invoices can be deleted');
  });

  it('should reject deletion of overdue invoices', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { status: 'overdue' },
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => {
      const { useDeleteInvoice } = useInvoices();
      return useDeleteInvoice();
    }, { wrapper });

    result.current.mutate('invoice-4');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Only draft invoices can be deleted');
  });

  it('should reject deletion of cancelled invoices', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { status: 'cancelled' },
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => {
      const { useDeleteInvoice } = useInvoices();
      return useDeleteInvoice();
    }, { wrapper });

    result.current.mutate('invoice-5');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Only draft invoices can be deleted');
  });

  it('should throw when invoice is not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => {
      const { useDeleteInvoice } = useInvoices();
      return useDeleteInvoice();
    }, { wrapper });

    result.current.mutate('nonexistent');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Invoice not found');
  });
});
