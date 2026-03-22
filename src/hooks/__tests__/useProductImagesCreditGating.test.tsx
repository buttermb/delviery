/**
 * useProductImages Credit Gating Tests
 *
 * Tests that AI product image generation is gated behind credit consumption:
 * 1. Single image generation checks credits before calling edge function
 * 2. Bulk generation checks credits per image and stops on insufficient credits
 * 3. Both hooks use 'ai_task_run' action key (50 credits per image)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecuteCreditAction = vi.fn();

// Mock useCreditGatedAction from useCredits
vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: vi.fn(() => ({
    execute: mockExecuteCreditAction,
    isPerforming: false,
    isFreeTier: true,
  })),
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    canPerformAction: vi.fn(),
    performAction: vi.fn(),
  })),
}));

// Mock supabase
const mockInvoke = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      }),
    },
    from: () => ({
      update: () => ({
        eq: (...args: unknown[]) => mockUpdate(...args),
      }),
    }),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock queryKeys
vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    products: { all: ['products'] },
    productsForWholesale: { all: ['productsForWholesale'] },
  },
}));

// Mock useTenantAdminAuth
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
  })),
}));

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Import after mocks
// ============================================================================

import { useGenerateProductImage, useBulkGenerateImages } from '../useProductImages';
import { toast } from 'sonner';

describe('useProductImages Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // Single Image Generation
  // ==========================================================================

  describe('useGenerateProductImage', () => {
    it('should call executeCreditAction with ai_task_run action key', async () => {
      // Set up credit action to execute the callback
      mockExecuteCreditAction.mockImplementation(async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      });

      // Set up edge function response
      const fakeBase64 = btoa('fake-image-data');
      mockInvoke.mockResolvedValue({
        data: { imageUrl: `data:image/png;base64,${fakeBase64}` },
        error: null,
      });
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.png' } });
      mockUpdate.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useGenerateProductImage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          productId: 'prod-1',
          productName: 'Test Flower',
          category: 'flower',
          strainType: 'sativa',
        });
      });

      // Verify credit gate was called with correct action key
      expect(mockExecuteCreditAction).toHaveBeenCalledWith(
        'ai_task_run',
        expect.any(Function)
      );
    });

    it('should throw when credits are insufficient (executeCreditAction returns null)', async () => {
      // Credit action returns null when insufficient credits
      mockExecuteCreditAction.mockResolvedValue(null);

      const { result } = renderHook(() => useGenerateProductImage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            productId: 'prod-1',
            productName: 'Test Flower',
            category: 'flower',
          });
        } catch {
          // Expected to throw
        }
      });

      // Edge function should NOT be called
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should propagate edge function errors through credit gate', async () => {
      mockExecuteCreditAction.mockImplementation(async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      });

      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error('Edge function error'),
      });

      const { result } = renderHook(() => useGenerateProductImage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            productId: 'prod-1',
            productName: 'Test Flower',
            category: 'flower',
          });
        } catch {
          // Expected to throw
        }
      });

      expect(mockExecuteCreditAction).toHaveBeenCalledWith(
        'ai_task_run',
        expect.any(Function)
      );
    });
  });

  // ==========================================================================
  // Bulk Image Generation
  // ==========================================================================

  describe('useBulkGenerateImages', () => {
    it('should call executeCreditAction for each product', async () => {
      const fakeBase64 = btoa('fake-image-data');
      let callCount = 0;

      mockExecuteCreditAction.mockImplementation(async (_actionKey: string, action: () => Promise<unknown>) => {
        callCount++;
        return action();
      });

      mockInvoke.mockResolvedValue({
        data: { imageUrl: `data:image/png;base64,${fakeBase64}` },
        error: null,
      });
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.png' } });
      mockUpdate.mockResolvedValue({ error: null });

      const products = [
        { id: 'p1', name: 'Product 1', category: 'flower' },
        { id: 'p2', name: 'Product 2', category: 'edibles' },
        { id: 'p3', name: 'Product 3', category: 'concentrates' },
      ];

      const { result } = renderHook(() => useBulkGenerateImages(), {
        wrapper: createWrapper(),
      });

      let results: unknown[] = [];
      await act(async () => {
        results = await result.current.mutateAsync(products);
      });

      // Should call credit gate once per product
      expect(callCount).toBe(3);
      expect(mockExecuteCreditAction).toHaveBeenCalledTimes(3);

      // All calls should use ai_task_run action key
      for (let i = 0; i < 3; i++) {
        expect(mockExecuteCreditAction).toHaveBeenNthCalledWith(
          i + 1,
          'ai_task_run',
          expect.any(Function)
        );
      }

      // All results should be successful
      expect(results).toHaveLength(3);
      expect((results as Array<{ success: boolean }>).every(r => r.success)).toBe(true);
    });

    it('should stop processing when credits are insufficient', async () => {
      let callCount = 0;

      mockExecuteCreditAction.mockImplementation(async (_actionKey: string, action: () => Promise<unknown>) => {
        callCount++;
        // First product succeeds, second fails due to insufficient credits
        if (callCount === 1) {
          const fakeBase64 = btoa('fake-image-data');
          mockInvoke.mockResolvedValue({
            data: { imageUrl: `data:image/png;base64,${fakeBase64}` },
            error: null,
          });
          mockUpload.mockResolvedValue({ error: null });
          mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.png' } });
          mockUpdate.mockResolvedValue({ error: null });
          return action();
        }
        return null; // Insufficient credits
      });

      const products = [
        { id: 'p1', name: 'Product 1', category: 'flower' },
        { id: 'p2', name: 'Product 2', category: 'edibles' },
        { id: 'p3', name: 'Product 3', category: 'concentrates' },
      ];

      const { result } = renderHook(() => useBulkGenerateImages(), {
        wrapper: createWrapper(),
      });

      let results: unknown[] = [];
      await act(async () => {
        results = await result.current.mutateAsync(products);
      });

      // Should only call credit gate twice (first succeeds, second fails)
      expect(callCount).toBe(2);

      // All 3 products should have results
      const typedResults = results as Array<{ productId: string; success: boolean; creditBlocked?: boolean }>;
      expect(typedResults).toHaveLength(3);
      expect(typedResults[0].success).toBe(true);
      expect(typedResults[1].success).toBe(false);
      expect(typedResults[1].creditBlocked).toBe(true);
      expect(typedResults[2].success).toBe(false);
      expect(typedResults[2].creditBlocked).toBe(true);
    });

    it('should show warning toast when some images are credit-blocked', async () => {
      let callCount = 0;

      mockExecuteCreditAction.mockImplementation(async (_actionKey: string, action: () => Promise<unknown>) => {
        callCount++;
        if (callCount === 1) {
          const fakeBase64 = btoa('fake-image-data');
          mockInvoke.mockResolvedValue({
            data: { imageUrl: `data:image/png;base64,${fakeBase64}` },
            error: null,
          });
          mockUpload.mockResolvedValue({ error: null });
          mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.png' } });
          mockUpdate.mockResolvedValue({ error: null });
          return action();
        }
        return null;
      });

      const products = [
        { id: 'p1', name: 'Product 1', category: 'flower' },
        { id: 'p2', name: 'Product 2', category: 'edibles' },
      ];

      const { result } = renderHook(() => useBulkGenerateImages(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(products);
      });

      // Should show warning toast mentioning skipped images
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('1/2')
      );
    });

    it('should show success toast when all images generate successfully', async () => {
      const fakeBase64 = btoa('fake-image-data');

      mockExecuteCreditAction.mockImplementation(async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      });

      mockInvoke.mockResolvedValue({
        data: { imageUrl: `data:image/png;base64,${fakeBase64}` },
        error: null,
      });
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/image.png' } });
      mockUpdate.mockResolvedValue({ error: null });

      const products = [
        { id: 'p1', name: 'Product 1', category: 'flower' },
        { id: 'p2', name: 'Product 2', category: 'edibles' },
      ];

      const { result } = renderHook(() => useBulkGenerateImages(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(products);
      });

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('2/2')
      );
    });
  });
});
