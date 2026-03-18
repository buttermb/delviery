import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';

const mockInvokeEdgeFunction = vi.fn();

vi.mock('@/utils/edgeFunctionHelper', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockInvokeEdgeFunction(...args),
}));

// Import after mocks
const { useBinLookup } = await import('@/hooks/useBinLookup');

describe('useBinLookup', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvokeEdgeFunction.mockReset();
  });

  it('should not fetch when bin is empty', () => {
    const { result } = renderHook(() => useBinLookup(''), { wrapper });

    expect(result.current.found).toBe(false);
    expect(result.current.card).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockInvokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('should not fetch when bin is invalid (letters)', () => {
    const { result } = renderHook(() => useBinLookup('abc123'), { wrapper });

    expect(result.current.found).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockInvokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('should not fetch when bin is too short (5 digits)', () => {
    const { result } = renderHook(() => useBinLookup('12345'), { wrapper });

    expect(result.current.found).toBe(false);
    expect(mockInvokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('should not fetch when bin is too long (9 digits)', () => {
    const { result } = renderHook(() => useBinLookup('123456789'), { wrapper });

    expect(result.current.found).toBe(false);
    expect(mockInvokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('should fetch when bin is valid 6-digit BIN', async () => {
    const mockResult = {
      found: true,
      card: {
        scheme: 'visa',
        type: 'debit',
        brand: 'Visa Classic',
        prepaid: false,
        country: { alpha2: 'US', name: 'United States' },
        bank: { name: 'Chase' },
      },
    };

    mockInvokeEdgeFunction.mockResolvedValueOnce({ data: mockResult, error: null });

    const { result } = renderHook(() => useBinLookup('424242'), { wrapper });

    await waitFor(() => {
      expect(result.current.found).toBe(true);
    });

    expect(result.current.card).toEqual(mockResult.card);
    expect(result.current.isLoading).toBe(false);
    expect(mockInvokeEdgeFunction).toHaveBeenCalledWith({
      functionName: 'bin-lookup',
      body: { bin: '424242' },
    });
  });

  it('should fetch when bin is valid 8-digit BIN', async () => {
    const mockResult = {
      found: true,
      card: {
        scheme: 'mastercard',
        type: 'credit',
        brand: null,
        prepaid: null,
        country: null,
        bank: null,
      },
    };

    mockInvokeEdgeFunction.mockResolvedValueOnce({ data: mockResult, error: null });

    const { result } = renderHook(() => useBinLookup('55555555'), { wrapper });

    await waitFor(() => {
      expect(result.current.found).toBe(true);
    });

    expect(result.current.card?.scheme).toBe('mastercard');
  });

  it('should return not found when API returns found: false', async () => {
    mockInvokeEdgeFunction.mockResolvedValueOnce({
      data: { found: false, card: null },
      error: null,
    });

    const { result } = renderHook(() => useBinLookup('000000'), { wrapper });

    await waitFor(() => {
      expect(mockInvokeEdgeFunction).toHaveBeenCalled();
    });

    expect(result.current.found).toBe(false);
    expect(result.current.card).toBeNull();
  });

  it('should handle edge function errors gracefully', async () => {
    mockInvokeEdgeFunction.mockResolvedValueOnce({
      data: null,
      error: new Error('Network error'),
    });

    const { result } = renderHook(() => useBinLookup('424242'), { wrapper });

    await waitFor(() => {
      expect(mockInvokeEdgeFunction).toHaveBeenCalled();
    });

    expect(result.current.found).toBe(false);
    expect(result.current.card).toBeNull();
  });

  it('should trim whitespace from bin input', async () => {
    mockInvokeEdgeFunction.mockResolvedValueOnce({
      data: { found: true, card: { scheme: 'visa', type: null, brand: null, prepaid: null, country: null, bank: null } },
      error: null,
    });

    renderHook(() => useBinLookup('  424242  '), { wrapper });

    await waitFor(() => {
      expect(mockInvokeEdgeFunction).toHaveBeenCalledWith({
        functionName: 'bin-lookup',
        body: { bin: '424242' },
      });
    });
  });

  it('should use 30-day stale time for caching', () => {
    mockInvokeEdgeFunction.mockResolvedValueOnce({
      data: { found: true, card: null },
      error: null,
    });

    renderHook(() => useBinLookup('424242'), { wrapper });

    const queries = queryClient.getQueryCache().getAll();
    const binQuery = queries.find(
      (q) => Array.isArray(q.queryKey) && q.queryKey.includes('bin-lookup'),
    );
    expect(binQuery?.options?.staleTime).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
