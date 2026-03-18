/**
 * useRealtimeSync Hook - Visibility API Tests
 * Tests the Page Visibility API integration to pause subscriptions when tab is hidden
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeSync } from '../useRealtimeSync';
import { createElement, type ReactNode } from 'react';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => {}),
      })),
    })),
    removeChannel: vi.fn(() => Promise.resolve()),
  },
}));

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useRealtimeSync - Page Visibility API', () => {
  let visibilityChangeHandler: (() => void) | null = null;

  beforeEach(() => {
    // Mock document.hidden
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });

    // Mock addEventListener to capture the handler
    const originalAddEventListener = document.addEventListener;
    vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'visibilitychange') {
        visibilityChangeHandler = handler as () => void;
      }
      return originalAddEventListener.call(document, event, handler);
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    visibilityChangeHandler = null;
    vi.restoreAllMocks();
  });

  describe('Initial Setup', () => {
    it('should initialize with tab visible state', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }),
        { wrapper }
      );

      expect(result.current.isTabVisible).toBe(true);
    });

    it('should register visibilitychange event listener', () => {
      const wrapper = createWrapper();
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), { wrapper });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
    });

    it('should remove visibilitychange event listener on unmount', () => {
      const wrapper = createWrapper();
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }),
        { wrapper }
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
    });
  });

  describe('Tab Visibility Changes', () => {
    it('should detect when tab becomes hidden', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }),
        { wrapper }
      );

      // Initially visible
      expect(result.current.isTabVisible).toBe(true);

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      if (visibilityChangeHandler) {
        visibilityChangeHandler();
      }

      await waitFor(() => {
        expect(result.current.isTabVisible).toBe(false);
      });
    });

    it('should detect when tab becomes visible again', async () => {
      // Start with hidden tab
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }),
        { wrapper }
      );

      // Should start as hidden
      await waitFor(() => {
        expect(result.current.isTabVisible).toBe(false);
      });

      // Make tab visible
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });

      if (visibilityChangeHandler) {
        visibilityChangeHandler();
      }

      await waitFor(() => {
        expect(result.current.isTabVisible).toBe(true);
      });
    });
  });

  describe('Data Refresh on Visibility Change', () => {
    it('should invalidate queries when tab becomes visible', async () => {
      // Start with hidden tab
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), { wrapper });

      // Make tab visible
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });

      if (visibilityChangeHandler) {
        visibilityChangeHandler();
      }

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });
    });

    it('should invalidate all subscribed tables when tab becomes visible', async () => {
      // Start with hidden tab
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const tables = ['orders', 'products', 'menu_orders'];
      renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: true, tables }),
        { wrapper }
      );

      invalidateQueriesSpy.mockClear();

      // Make tab visible
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });

      if (visibilityChangeHandler) {
        visibilityChangeHandler();
      }

      await waitFor(() => {
        // Should invalidate queries for each table
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['menu_orders'] });
      });
    });

    it('should NOT invalidate queries when tab becomes hidden', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), { wrapper });

      invalidateQueriesSpy.mockClear();

      // Make tab hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      if (visibilityChangeHandler) {
        visibilityChangeHandler();
      }

      // Wait a bit to ensure no invalidation happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid visibility changes gracefully', async () => {
      const wrapper = createWrapper();
      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), { wrapper });

      // Rapidly toggle visibility
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => i % 2 === 0,
        });

        if (visibilityChangeHandler) {
          visibilityChangeHandler();
        }
      }

      // Should not crash or throw errors
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should not invalidate queries if hook is disabled', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: false }), { wrapper });

      invalidateQueriesSpy.mockClear();

      // Make tab visible
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });

      if (visibilityChangeHandler) {
        visibilityChangeHandler();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });

    it('should not invalidate queries if tenantId is not provided', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useRealtimeSync({ enabled: true }), { wrapper });

      invalidateQueriesSpy.mockClear();

      // Make tab visible
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });

      if (visibilityChangeHandler) {
        visibilityChangeHandler();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });
  });

  describe('Performance Optimization', () => {
    it('should skip connection when tab is initially hidden', async () => {
      // Start with hidden tab
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      const supabaseMock = await vi.importMock('@/integrations/supabase/client');
      const channelSpy = vi.spyOn(supabaseMock.supabase, 'channel');

      const wrapper = createWrapper();
      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), { wrapper });

      // Should not create channels when tab is hidden
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(channelSpy).not.toHaveBeenCalled();
    });

    it('should invalidate queries to refresh data when tab becomes visible from hidden state', async () => {
      // Start with hidden tab
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }),
        { wrapper }
      );

      invalidateQueriesSpy.mockClear();

      // Make tab visible
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });

      if (visibilityChangeHandler) {
        visibilityChangeHandler();
      }

      // Should invalidate queries to refresh data
      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });
    });
  });
});
