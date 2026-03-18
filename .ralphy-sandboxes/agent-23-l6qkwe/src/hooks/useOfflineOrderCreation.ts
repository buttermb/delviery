/**
 * Offline Order Creation Hook
 * Handles creating orders locally when offline and syncing when back online.
 * Uses IndexedDB for persistence and the offline queue for sync.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { db as idb } from '@/lib/idb';
import { queueAction, getOnlineStatus } from '@/lib/offlineQueue';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export interface OfflineOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
}

export interface OfflineOrderData {
  id: string;
  tenantId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  paymentMethod: 'cash' | 'card' | 'credit';
  items: OfflineOrderItem[];
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  status: 'draft' | 'pending_sync' | 'syncing' | 'synced' | 'failed';
  createdAt: string;
  syncedAt?: string;
  syncError?: string;
  idempotencyKey: string;
}

export interface UseOfflineOrderCreationReturn {
  offlineOrders: OfflineOrderData[];
  isOnline: boolean;
  isSyncing: boolean;
  createOfflineOrder: (order: Omit<OfflineOrderData, 'id' | 'status' | 'createdAt' | 'idempotencyKey'>) => Promise<string>;
  syncOfflineOrders: () => Promise<{ success: number; failed: number }>;
  removeOfflineOrder: (id: string) => Promise<void>;
  retryOrder: (id: string) => Promise<void>;
  getOfflineOrderCount: () => number;
}

export function useOfflineOrderCreation(tenantId?: string): UseOfflineOrderCreationReturn {
  const [offlineOrders, setOfflineOrders] = useState<OfflineOrderData[]>([]);
  const [isOnline, setIsOnline] = useState(getOnlineStatus());
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Load offline orders from IndexedDB
  const loadOfflineOrders = useCallback(async () => {
    try {
      const allOrders = await idb.getAllOrders();
      const filtered = (allOrders as unknown as OfflineOrderData[]).filter(
        (order) => order && order.tenantId === tenantId && order.status !== 'synced'
      );
      setOfflineOrders(filtered);
    } catch (error) {
      logger.error('Failed to load offline orders', error instanceof Error ? error : new Error(String(error)), { component: 'useOfflineOrderCreation' });
    }
  }, [tenantId]);

  // Ref holds latest syncOfflineOrders so event listeners don't go stale.
  // Updated below after syncOfflineOrders is defined.
  const syncOfflineOrdersRef = useRef<() => Promise<{ success: number; failed: number }>>(() => Promise.resolve({ success: 0, failed: 0 }));

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncOfflineOrdersRef.current();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [tenantId]);

  // Load orders on mount and when tenantId changes
  useEffect(() => {
    if (tenantId) {
      loadOfflineOrders();
    }
  }, [tenantId, loadOfflineOrders]);

  // Create an order locally (works offline)
  const createOfflineOrder = useCallback(async (
    orderData: Omit<OfflineOrderData, 'id' | 'status' | 'createdAt' | 'idempotencyKey'>
  ): Promise<string> => {
    const id = uuidv4();
    const idempotencyKey = uuidv4();
    const now = new Date().toISOString();

    const order: OfflineOrderData = {
      ...orderData,
      id,
      status: 'pending_sync',
      createdAt: now,
      idempotencyKey,
    };

    // Save to IndexedDB
    await idb.saveOrder(order as unknown as Record<string, unknown> & { id: string; createdAt?: number | string });

    // Update local state
    setOfflineOrders((prev) => [...prev, order]);

    // If online, try to sync immediately
    if (getOnlineStatus()) {
      await syncSingleOrder(order);
    } else {
      toast.info('Order saved offline', {
        description: 'Will sync automatically when connection is restored.',
      });
    }

    return id;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncSingleOrder is defined below and stable
  }, []);

  // Sync a single order to Supabase
  const syncSingleOrder = async (order: OfflineOrderData): Promise<boolean> => {
    try {
      // Update status to syncing
      const updatedOrder = { ...order, status: 'syncing' as const };
      await idb.saveOrder(updatedOrder as unknown as Record<string, unknown> & { id: string; createdAt?: number | string });
      setOfflineOrders((prev) =>
        prev.map((o) => (o.id === order.id ? updatedOrder : o))
      );

      // Create the order in Supabase
      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: order.tenantId,
          customer_id: order.customerId || null,
          customer_name: order.customerName,
          customer_phone: order.customerPhone || null,
          delivery_address: order.deliveryAddress,
          delivery_notes: order.deliveryNotes || null,
          delivery_borough: '',
          payment_method: order.paymentMethod,
          subtotal: order.subtotal,
          total_amount: order.totalAmount,
          delivery_fee: order.deliveryFee,
          status: 'pending',
          order_type: 'retail',
          created_at: order.createdAt,
        })
        .select('id, order_number')
        .maybeSingle();

      if (orderError) {
        throw new Error(orderError.message);
      }

      // Insert order items
      if (order.items.length > 0 && createdOrder) {
        const orderItems = order.items.map((item) => ({
          order_id: createdOrder.id,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          price: item.unitPrice,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          logger.warn('Failed to insert order items for offline order', itemsError, { component: 'useOfflineOrderCreation', orderId: order.id });
        }
      }

      // Mark as synced
      const syncedOrder: OfflineOrderData = {
        ...order,
        status: 'synced',
        syncedAt: new Date().toISOString(),
      };
      await idb.saveOrder(syncedOrder as unknown as Record<string, unknown> & { id: string; createdAt?: number | string });
      setOfflineOrders((prev) =>
        prev.map((o) => (o.id === order.id ? syncedOrder : o))
      );

      // Invalidate orders query to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
      logger.error('Failed to sync offline order', error instanceof Error ? error : new Error(String(error)), {
        component: 'useOfflineOrderCreation',
        orderId: order.id,
      });

      // Mark as failed
      const failedOrder: OfflineOrderData = {
        ...order,
        status: 'failed',
        syncError: errorMsg,
      };
      await idb.saveOrder(failedOrder as unknown as Record<string, unknown> & { id: string; createdAt?: number | string });
      setOfflineOrders((prev) =>
        prev.map((o) => (o.id === order.id ? failedOrder : o))
      );

      // Queue for retry via offline queue
      await queueAction(
        'create_order',
        '/api/orders',
        'POST',
        {
          ...order,
          idempotencyKey: order.idempotencyKey,
        },
        5
      );

      return false;
    }
  };

  // Sync all pending offline orders
  const syncOfflineOrders = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (!getOnlineStatus() || isSyncing) {
      return { success: 0, failed: 0 };
    }

    setIsSyncing(true);
    let success = 0;
    let failed = 0;

    try {
      const pendingOrders = offlineOrders.filter(
        (o) => o.status === 'pending_sync' || o.status === 'failed'
      );

      for (const order of pendingOrders) {
        const result = await syncSingleOrder(order);
        if (result) {
          success++;
        } else {
          failed++;
        }
      }

      if (success > 0) {
        toast.success(`${success} offline ${success !== 1 ? 'orders' : 'order'} synced successfully`);
      }
      if (failed > 0) {
        toast.error(`${failed} ${failed !== 1 ? 'orders' : 'order'} failed to sync`);
      }
    } finally {
      setIsSyncing(false);
      // Reload to get fresh state
      await loadOfflineOrders();
    }

    return { success, failed };
  // syncSingleOrder is an unstable local async function. Wrapping it in useCallback
  // would require deep dependency chains (supabase, idb, queryClient, state setters).
  // Omitting it here is safe because syncOfflineOrders always reads the latest
  // offlineOrders and calls the current syncSingleOrder closure.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineOrders, isSyncing, loadOfflineOrders]);

  // Keep the ref current so event listeners always call the latest version
  useEffect(() => { syncOfflineOrdersRef.current = syncOfflineOrders; }, [syncOfflineOrders]);

  // Remove an offline order
  const removeOfflineOrder = useCallback(async (id: string): Promise<void> => {
    try {
      // Remove from IndexedDB - mark as synced to effectively remove
      const order = offlineOrders.find((o) => o.id === id);
      if (order) {
        const removedOrder = { ...order, status: 'synced' as const };
        await idb.saveOrder(removedOrder as unknown as Record<string, unknown> & { id: string; createdAt?: number | string });
      }
      setOfflineOrders((prev) => prev.filter((o) => o.id !== id));
      toast.success('Offline order removed');
    } catch (error) {
      logger.error('Failed to remove offline order', error instanceof Error ? error : new Error(String(error)), { component: 'useOfflineOrderCreation' });
      toast.error('Failed to remove order', { description: humanizeError(error) });
    }
  }, [offlineOrders]);

  // Retry a failed order
  const retryOrder = useCallback(async (id: string): Promise<void> => {
    const order = offlineOrders.find((o) => o.id === id);
    if (!order) return;

    if (!getOnlineStatus()) {
      toast.error('Cannot retry while offline');
      return;
    }

    const resetOrder: OfflineOrderData = {
      ...order,
      status: 'pending_sync',
      syncError: undefined,
    };
    await idb.saveOrder(resetOrder as unknown as Record<string, unknown> & { id: string; createdAt?: number | string });
    setOfflineOrders((prev) =>
      prev.map((o) => (o.id === id ? resetOrder : o))
    );

    await syncSingleOrder(resetOrder);
  // syncSingleOrder is an unstable local async function (same rationale as syncOfflineOrders).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineOrders]);

  const getOfflineOrderCount = useCallback(() => {
    return offlineOrders.filter((o) => o.status !== 'synced').length;
  }, [offlineOrders]);

  return {
    offlineOrders,
    isOnline,
    isSyncing,
    createOfflineOrder,
    syncOfflineOrders,
    removeOfflineOrder,
    retryOrder,
    getOfflineOrderCount,
  };
}
