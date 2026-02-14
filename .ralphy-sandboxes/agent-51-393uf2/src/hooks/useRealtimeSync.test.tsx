/**
 * Tests for useRealtimeSync Hook
 * Verifies realtime subscription behavior and DEFAULT_TABLES configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeSync } from './useRealtimeSync';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock the invalidation system
vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

describe('useRealtimeSync', () => {
  let queryClient: QueryClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockChannel: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSubscribe: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockOn: any;

  beforeEach(() => {
    // Create a fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Setup mock channel
    mockSubscribe = vi.fn().mockImplementation((callback) => {
      // Simulate successful subscription
      setTimeout(() => callback('SUBSCRIBED'), 0);
      return mockChannel;
    });

    mockOn = vi.fn().mockReturnValue({
      subscribe: mockSubscribe,
    });

    mockChannel = {
      on: mockOn,
      subscribe: mockSubscribe,
    };

    // Setup supabase.channel mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.channel as any).mockReturnValue(mockChannel);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.removeChannel as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('DEFAULT_TABLES configuration', () => {
    it('should subscribe to exactly 4 critical tables by default', async () => {
      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledTimes(4);
      });

      // Verify the exact tables being subscribed to
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channelCalls = (supabase.channel as any).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscribedTables = channelCalls.map((call: any) => {
        const channelKey = call[0];
        // Extract table name from channel key format: realtime-sync-{table}-{tenantId}
        const match = channelKey.match(/realtime-sync-(.+)-test-tenant/);
        return match ? match[1] : null;
      });

      expect(subscribedTables).toContain('orders');
      expect(subscribedTables).toContain('wholesale_orders');
      expect(subscribedTables).toContain('products');
      expect(subscribedTables).toContain('menu_orders');
      expect(subscribedTables).toHaveLength(4);
    });

    it('should NOT subscribe to storefront_orders by default', async () => {
      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channelCalls = (supabase.channel as any).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscribedTables = channelCalls.map((call: any) => {
        const channelKey = call[0];
        const match = channelKey.match(/realtime-sync-(.+)-test-tenant/);
        return match ? match[1] : null;
      });

      expect(subscribedTables).not.toContain('storefront_orders');
    });

    it('should NOT subscribe to performance-heavy tables by default', async () => {
      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channelCalls = (supabase.channel as any).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscribedTables = channelCalls.map((call: any) => {
        const channelKey = call[0];
        const match = channelKey.match(/realtime-sync-(.+)-test-tenant/);
        return match ? match[1] : null;
      });

      // Verify none of the removed tables are subscribed
      expect(subscribedTables).not.toContain('deliveries');
      expect(subscribedTables).not.toContain('customers');
      expect(subscribedTables).not.toContain('payments');
      expect(subscribedTables).not.toContain('inventory_transfers');
      expect(subscribedTables).not.toContain('courier_earnings');
      expect(subscribedTables).not.toContain('invoices');
    });
  });

  describe('Subscription behavior', () => {
    it('should create channels with correct configuration', async () => {
      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      // Check that channels are created with correct config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstCall = (supabase.channel as any).mock.calls[0];
      expect(firstCall[1]).toEqual({
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      });
    });

    it('should listen to all postgres_changes events', async () => {
      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockOn).toHaveBeenCalled();
      });

      // Verify each channel listens to postgres_changes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockOn.mock.calls.forEach((call: any) => {
        expect(call[0]).toBe('postgres_changes');
        expect(call[1]).toMatchObject({
          event: '*',
          schema: 'public',
          filter: undefined,
        });
      });
    });

    it('should not subscribe when disabled', () => {
      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: false }), {
        wrapper,
      });

      expect(supabase.channel).not.toHaveBeenCalled();
    });

    it('should not subscribe when tenantId is missing', () => {
      renderHook(() => useRealtimeSync({ enabled: true }), { wrapper });

      expect(supabase.channel).not.toHaveBeenCalled();
    });

    it('should cleanup channels on unmount', async () => {
      const { unmount } = renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }),
        { wrapper }
      );

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(supabase.removeChannel).toHaveBeenCalled();
      });
    });
  });

  describe('Custom table subscriptions', () => {
    it('should allow subscribing to custom tables', async () => {
      const customTables = ['custom_table_1', 'custom_table_2'];

      renderHook(
        () =>
          useRealtimeSync({
            tenantId: 'test-tenant',
            tables: customTables,
            enabled: true,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledTimes(2);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channelCalls = (supabase.channel as any).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscribedTables = channelCalls.map((call: any) => {
        const channelKey = call[0];
        const match = channelKey.match(/realtime-sync-(.+)-test-tenant/);
        return match ? match[1] : null;
      });

      expect(subscribedTables).toContain('custom_table_1');
      expect(subscribedTables).toContain('custom_table_2');
    });
  });

  describe('Query invalidation', () => {
    it('should invalidate queries when receiving wholesale_orders updates', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockOn).toHaveBeenCalled();
      });

      // Find the wholesale_orders callback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wholesaleOrdersCall = mockOn.mock.calls.find((call: any) => {
        return call[1].table === 'wholesale_orders';
      });

      expect(wholesaleOrdersCall).toBeDefined();

      // Simulate a postgres change event
      const callback = wholesaleOrdersCall[2];
      callback({
        eventType: 'INSERT',
        new: { id: 'test-id' },
        old: {},
        table: 'wholesale_orders',
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });

      // Verify the correct queries were invalidated
      const invalidatedKeys = invalidateQueriesSpy.mock.calls.map((call) => call[0].queryKey);
      expect(invalidatedKeys).toContainEqual(['wholesale-orders']);
      expect(invalidatedKeys).toContainEqual(['orders']);
    });

    it('should invalidate queries when receiving menu_orders updates', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockOn).toHaveBeenCalled();
      });

      // Find the menu_orders callback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const menuOrdersCall = mockOn.mock.calls.find((call: any) => {
        return call[1].table === 'menu_orders';
      });

      expect(menuOrdersCall).toBeDefined();

      // Simulate a postgres change event
      const callback = menuOrdersCall[2];
      callback({
        eventType: 'UPDATE',
        new: { id: 'menu-order-id' },
        old: {},
        table: 'menu_orders',
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });

      // Verify the correct queries were invalidated
      const invalidatedKeys = invalidateQueriesSpy.mock.calls.map((call) => call[0].queryKey);
      expect(invalidatedKeys).toContainEqual(['menu-orders']);
      expect(invalidatedKeys).toContainEqual(['live-orders']);
    });

    it('should invalidate queries when receiving products updates', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockOn).toHaveBeenCalled();
      });

      // Find the products callback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productsCall = mockOn.mock.calls.find((call: any) => {
        return call[1].table === 'products';
      });

      expect(productsCall).toBeDefined();

      // Simulate a postgres change event
      const callback = productsCall[2];
      callback({
        eventType: 'UPDATE',
        new: { id: 'product-id' },
        old: {},
        table: 'products',
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });

      // Verify the correct queries were invalidated
      const invalidatedKeys = invalidateQueriesSpy.mock.calls.map((call) => call[0].queryKey);
      expect(invalidatedKeys).toContainEqual(['inventory']);
      expect(invalidatedKeys).toContainEqual(['products']);
    });

    it('should invalidate queries when receiving orders updates', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockOn).toHaveBeenCalled();
      });

      // Find the orders callback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ordersCall = mockOn.mock.calls.find((call: any) => {
        return call[1].table === 'orders';
      });

      expect(ordersCall).toBeDefined();

      // Simulate a postgres change event
      const callback = ordersCall[2];
      callback({
        eventType: 'INSERT',
        new: { id: 'order-id' },
        old: {},
        table: 'orders',
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });

      // Verify the correct queries were invalidated
      const invalidatedKeys = invalidateQueriesSpy.mock.calls.map((call) => call[0].queryKey);
      expect(invalidatedKeys).toContainEqual(['orders']);
      expect(invalidatedKeys).toContainEqual(['live-orders']);
    });
  });

  describe('Connection failure handling', () => {
    it('should track connection failures', async () => {
      // Modify subscribe to simulate error
      const errorSubscribe = vi.fn().mockImplementation((callback) => {
        setTimeout(() => callback('CHANNEL_ERROR'), 0);
        return mockChannel;
      });

      mockChannel.subscribe = errorSubscribe;
      mockOn.mockReturnValue({
        subscribe: errorSubscribe,
      });

      renderHook(() => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(errorSubscribe).toHaveBeenCalled();
      });

      // No assertions needed - just verifying it doesn't crash
    });
  });

  describe('Return value', () => {
    it('should return isActive and channelCount properties', async () => {
      const { result } = renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: true }),
        { wrapper }
      );

      // Verify the return value has the correct shape
      expect(result.current).toHaveProperty('isActive');
      expect(result.current).toHaveProperty('channelCount');
      expect(typeof result.current.isActive).toBe('boolean');
      expect(typeof result.current.channelCount).toBe('number');

      // Wait for channels to be created
      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledTimes(4);
      });
    });

    it('should return zero channels when disabled', () => {
      const { result } = renderHook(
        () => useRealtimeSync({ tenantId: 'test-tenant', enabled: false }),
        { wrapper }
      );

      expect(result.current.isActive).toBe(false);
      expect(result.current.channelCount).toBe(0);
    });
  });
});
