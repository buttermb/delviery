/**
 * Tests for useOrdersRealtime hook
 * Verifies real-time order subscription functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOrdersRealtime } from './useOrdersRealtime';
import { supabase } from '@/integrations/supabase/client';
import * as TenantAdminAuthContext from '@/contexts/TenantAdminAuthContext';
import * as notificationSound from '@/utils/notificationSound';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/utils/notificationSound', () => ({
  playNotificationSound: vi.fn(),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(),
}));

describe('useOrdersRealtime', () => {
  let queryClient: QueryClient;
  let mockChannel: RealtimeChannel;
  let subscribeCallback: (status: string) => void;
  let insertCallback: (payload: any) => void;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup mock channel
    subscribeCallback = vi.fn();
    insertCallback = vi.fn();

    mockChannel = {
      on: vi.fn().mockImplementation((event, config, callback) => {
        if (event === 'postgres_changes') {
          insertCallback = callback;
        }
        return mockChannel;
      }),
      subscribe: vi.fn().mockImplementation((callback) => {
        subscribeCallback = callback;
        // Immediately call with SUBSCRIBED status
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      }),
      unsubscribe: vi.fn(),
    } as unknown as RealtimeChannel;

    vi.mocked(supabase.channel).mockReturnValue(mockChannel);
    vi.mocked(supabase.removeChannel).mockResolvedValue({ error: null });

    // Mock tenant context
    vi.mocked(TenantAdminAuthContext.useTenantAdminAuth).mockReturnValue({
      tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    } as any);

    // Mock Notification API
    global.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as any;

    // Mock navigator.vibrate
    global.navigator.vibrate = vi.fn();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useOrdersRealtime(), { wrapper });

      expect(result.current.newOrderIds.size).toBe(0);
      expect(result.current.isSubscribed).toBe(false);
    });

    it('should not subscribe when disabled', () => {
      renderHook(() => useOrdersRealtime({ enabled: false }), { wrapper });

      expect(supabase.channel).not.toHaveBeenCalled();
    });

    it('should not subscribe when tenant is not available', () => {
      vi.mocked(TenantAdminAuthContext.useTenantAdminAuth).mockReturnValue({
        tenant: null,
      } as any);

      renderHook(() => useOrdersRealtime(), { wrapper });

      expect(supabase.channel).not.toHaveBeenCalled();
    });

    it('should request notification permission on mount', async () => {
      renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(global.Notification.requestPermission).toHaveBeenCalled();
      });
    });
  });

  describe('Subscription Setup', () => {
    it('should create a channel with correct configuration', async () => {
      renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith('orders-realtime-test-tenant-id');
      });
    });

    it('should subscribe to INSERT events on orders table', async () => {
      renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: 'tenant_id=eq.test-tenant-id',
          },
          expect.any(Function)
        );
      });
    });

    it('should set isSubscribed to true after subscription', async () => {
      const { result } = renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSubscribed).toBe(true);
      });
    });
  });

  describe('New Order Handling', () => {
    it('should handle new order INSERT event', async () => {
      const onNewOrder = vi.fn();
      renderHook(() => useOrdersRealtime({ onNewOrder }), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Simulate new order insert
      const newOrder = {
        id: 'order-123',
        order_number: 'ORD-001',
        order_source: 'admin',
        total_amount: 99.99,
        created_at: '2024-01-31T12:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(onNewOrder).toHaveBeenCalledWith({
          id: 'order-123',
          orderNumber: 'ORD-001',
          source: 'admin',
          customerName: 'Customer',
          totalAmount: 99.99,
          timestamp: '2024-01-31T12:00:00Z',
        });
      });
    });

    it('should add order to newOrderIds set', async () => {
      const { result } = renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-456',
        order_number: 'ORD-002',
        total_amount: 150.0,
        created_at: '2024-01-31T13:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(result.current.newOrderIds.has('order-456')).toBe(true);
      });
    });

    it('should play notification sound for new order', async () => {
      renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-789',
        order_number: 'ORD-003',
        total_amount: 200.0,
        created_at: '2024-01-31T14:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(notificationSound.playNotificationSound).toHaveBeenCalledWith(true);
      });
    });

    it('should invalidate orders query cache', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-999',
        total_amount: 75.0,
        created_at: '2024-01-31T15:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
      });
    });

    it('should handle order with missing order_number', async () => {
      const onNewOrder = vi.fn();
      renderHook(() => useOrdersRealtime({ onNewOrder }), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-abc123def456',
        total_amount: 50.0,
        created_at: '2024-01-31T16:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(onNewOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            orderNumber: 'order-ab', // First 8 chars of ID
          })
        );
      });
    });

    it('should handle order with different sources', async () => {
      const onNewOrder = vi.fn();
      renderHook(() => useOrdersRealtime({ onNewOrder }), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const sources = ['admin', 'storefront', 'pos', 'menu', 'api'] as const;

      for (const source of sources) {
        const newOrder = {
          id: `order-${source}`,
          order_source: source,
          total_amount: 100.0,
          created_at: '2024-01-31T17:00:00Z',
        };

        insertCallback({ new: newOrder });

        await waitFor(() => {
          expect(onNewOrder).toHaveBeenCalledWith(
            expect.objectContaining({
              source: source,
            })
          );
        });
      }
    });
  });

  describe('Browser Notifications', () => {
    it('should show browser notification when permission is granted', async () => {
      global.Notification.permission = 'granted';
      const mockNotification = vi.fn();
      global.Notification = mockNotification as any;

      renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-notif',
        order_number: 'ORD-NOTIF',
        order_source: 'admin',
        total_amount: 125.0,
        created_at: '2024-01-31T18:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(mockNotification).toHaveBeenCalledWith(
          'New ADMIN Order',
          expect.objectContaining({
            body: expect.stringContaining('ORD-NOTIF'),
            icon: '/logo.svg',
          })
        );
      });
    });

    it('should not show notification when permission is denied', async () => {
      global.Notification.permission = 'denied';
      const mockNotification = vi.fn();
      global.Notification = mockNotification as any;

      renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-no-notif',
        total_amount: 50.0,
        created_at: '2024-01-31T19:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(mockNotification).not.toHaveBeenCalled();
      });
    });
  });

  describe('Highlight Timeout', () => {
    it('should remove order from highlight set after 10 seconds', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-timeout',
        total_amount: 300.0,
        created_at: '2024-01-31T20:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(result.current.newOrderIds.has('order-timeout')).toBe(true);
      });

      // Fast-forward 10 seconds
      vi.advanceTimersByTime(10000);

      await waitFor(() => {
        expect(result.current.newOrderIds.has('order-timeout')).toBe(false);
      });

      vi.useRealTimers();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on unmount', async () => {
      const { unmount } = renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      unmount();

      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.mocked(supabase.removeChannel).mockRejectedValue(new Error('Cleanup failed'));
      const { unmount } = renderHook(() => useOrdersRealtime(), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle orders with zero amount', async () => {
      const onNewOrder = vi.fn();
      renderHook(() => useOrdersRealtime({ onNewOrder }), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-zero',
        total_amount: 0,
        created_at: '2024-01-31T21:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(onNewOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            totalAmount: 0,
          })
        );
      });
    });

    it('should handle orders with missing total_amount', async () => {
      const onNewOrder = vi.fn();
      renderHook(() => useOrdersRealtime({ onNewOrder }), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-no-total',
        created_at: '2024-01-31T22:00:00Z',
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(onNewOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            totalAmount: 0,
          })
        );
      });
    });

    it('should use current timestamp if created_at is missing', async () => {
      const onNewOrder = vi.fn();
      renderHook(() => useOrdersRealtime({ onNewOrder }), { wrapper });

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      const newOrder = {
        id: 'order-no-timestamp',
        total_amount: 100.0,
      };

      insertCallback({ new: newOrder });

      await waitFor(() => {
        expect(onNewOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            timestamp: expect.any(String),
          })
        );
      });
    });
  });
});
