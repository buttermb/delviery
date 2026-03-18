import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// Mock the edge function helper
vi.mock('@/utils/edgeFunctionHelper', () => ({
  invokeEdgeFunction: vi.fn(),
}));

import { useBarcodeLookup } from '@/hooks/useBarcodeLookup';
import { invokeEdgeFunction } from '@/utils/edgeFunctionHelper';

const mockInvoke = vi.mocked(invokeEdgeFunction);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useBarcodeLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not fetch when barcode is too short', () => {
    const { result } = renderHook(() => useBarcodeLookup('123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.found).toBe(false);
    expect(result.current.product).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should not fetch when barcode contains non-digits', () => {
    const { result } = renderHook(() => useBarcodeLookup('1234567abc'), {
      wrapper: createWrapper(),
    });

    expect(result.current.found).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should not fetch when barcode is empty', () => {
    const { result } = renderHook(() => useBarcodeLookup(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.found).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should fetch and return product when barcode is valid and found', async () => {
    const mockProduct = {
      name: 'Test Product',
      brand: 'Test Brand',
      imageUrl: 'https://example.com/image.jpg',
      category: 'Food',
      description: 'Test description',
    };

    mockInvoke.mockResolvedValueOnce({
      data: { found: true, product: mockProduct },
      error: null,
    });

    const { result } = renderHook(() => useBarcodeLookup('12345678'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.found).toBe(true);
    });

    expect(result.current.product).toEqual(mockProduct);
    expect(mockInvoke).toHaveBeenCalledWith({
      functionName: 'barcode-lookup',
      body: { barcode: '12345678' },
    });
  });

  it('should return not found when product does not exist', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { found: false, product: null },
      error: null,
    });

    const { result } = renderHook(() => useBarcodeLookup('99999999'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.found).toBe(false);
    expect(result.current.product).toBeNull();
  });

  it('should handle edge function errors gracefully', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Network error'),
    });

    const { result } = renderHook(() => useBarcodeLookup('12345678'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.found).toBe(false);
    expect(result.current.product).toBeNull();
  });

  it('should trim whitespace from barcode input', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { found: false, product: null },
      error: null,
    });

    renderHook(() => useBarcodeLookup('  12345678  '), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith({
        functionName: 'barcode-lookup',
        body: { barcode: '12345678' },
      });
    });
  });

  it('should enable query only for 8+ digit numeric barcodes', () => {
    // 7 digits - should not fetch
    const { result: result7 } = renderHook(() => useBarcodeLookup('1234567'), {
      wrapper: createWrapper(),
    });
    expect(result7.current.isLoading).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();

    // 8 digits - should fetch
    mockInvoke.mockResolvedValueOnce({
      data: { found: false, product: null },
      error: null,
    });
    renderHook(() => useBarcodeLookup('12345678'), {
      wrapper: createWrapper(),
    });
    expect(mockInvoke).toHaveBeenCalled();
  });
});
