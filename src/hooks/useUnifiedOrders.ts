/**
 * Unified Orders Hook
 * 
 * Single hook for all order types (retail, wholesale, menu, pos)
 * with real-time subscriptions and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';

// Types
export type OrderType = 'retail' | 'wholesale' | 'menu' | 'pos' | 'all';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'in_transit' | 'delivered' | 'completed' | 'cancelled' | 'rejected' | 'refunded';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type OrderPriorityLevel = 'urgent' | 'high' | 'normal' | 'low';

export interface UnifiedOrder {
  id: string;
  tenant_id: string;
  order_number: string;
  order_type: Exclude<OrderType, 'all'>;
  source: string;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string | null;
  payment_status: PaymentStatus;
  customer_id: string | null;
  wholesale_client_id: string | null;
  menu_id: string | null;
  shift_id: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  courier_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  // Priority fields
  priority: OrderPriorityLevel;
  priority_set_at: string | null;
  priority_set_by: string | null;
  priority_auto_set: boolean;
  // Relations
  items?: UnifiedOrderItem[];
  customer?: { id: string; first_name: string; last_name: string; email: string } | null;
  client?: { id: string; business_name: string; contact_name: string } | null;
  courier?: { id: string; full_name: string; phone: string } | null;
  menu?: { id: string; name: string } | null;
}

export interface UnifiedOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  inventory_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  quantity_unit: string;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  metadata: Record<string, unknown>;
}

export interface CreateOrderInput {
  order_type: Exclude<OrderType, 'all'>;
  source: string;
  items: {
    product_id?: string;
    inventory_id?: string;
    product_name: string;
    sku?: string;
    quantity: number;
    quantity_unit?: string;
    unit_price: number;
    metadata?: Record<string, unknown>;
  }[];
  customer_id?: string;
  wholesale_client_id?: string;
  menu_id?: string;
  shift_id?: string;
  delivery_address?: string;
  delivery_notes?: string;
  payment_method?: string;
  courier_id?: string;
  contact_name?: string;
  contact_phone?: string;
  metadata?: Record<string, unknown>;
}

interface UseUnifiedOrdersOptions {
  orderType?: OrderType;
  status?: OrderStatus;
  priority?: OrderPriorityLevel | OrderPriorityLevel[];
  sortByPriority?: boolean;
  limit?: number;
  offset?: number;
  enabled?: boolean;
  realtime?: boolean;
}

// Query key factory
export const unifiedOrdersKeys = {
  all: ['unified-orders'] as const,
  lists: () => [...unifiedOrdersKeys.all, 'list'] as const,
  list: (tenantId: string, filters: Record<string, unknown>) =>
    [...unifiedOrdersKeys.lists(), tenantId, filters] as const,
  details: () => [...unifiedOrdersKeys.all, 'detail'] as const,
  detail: (id: string) => [...unifiedOrdersKeys.details(), id] as const,
};

/**
 * Hook to fetch unified orders with optional filtering
 */
export function useUnifiedOrders(options: UseUnifiedOrdersOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const {
    orderType = 'all',
    status,
    priority,
    sortByPriority = false,
    limit = 50,
    offset = 0,
    enabled = true,
    realtime = true,
  } = options;

  const queryKey = unifiedOrdersKeys.list(tenant?.id ?? '', { orderType, status, priority, sortByPriority, limit, offset });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      let query = supabase
        .from('unified_orders')
        .select(`
          *,
          items:unified_order_items(*),
          customer:customers(id, first_name, last_name, email),
          client:wholesale_clients(id, business_name, contact_name),
          courier:couriers(id, full_name, phone),
          menu:disposable_menus(id, name)
        `)
        .eq('tenant_id', tenant.id);

      // Apply order type filter
      if (orderType !== 'all') {
        query = query.eq('order_type', orderType);
      }

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Apply priority filter
       if (priority) {
        if (Array.isArray(priority)) {
          query = query.in('priority', priority);
        } else {
          query = query.eq('priority', priority);
        }
      }

      // Apply sorting - if sortByPriority, sort by priority first then created_at
      // Priority order: urgent (1) > high (2) > normal (3) > low (4)
      if (sortByPriority) {
        // Note: Supabase doesn't support CASE in order, so we fetch and sort client-side
        // or use a view/computed column. For now, sort by created_at and sort in JS
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch unified orders', { error });
        throw error;
      }

      let orders = data as unknown as UnifiedOrder[];

      // Sort by priority client-side if requested
      if (sortByPriority && orders.length > 0) {
        orders = sortOrdersByPriority(orders);
      }

      return orders;
    },
    enabled: enabled && !!tenant?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  /**
   * Sort orders by priority (urgent first, then high, normal, low)
   */
  function sortOrdersByPriority(orders: UnifiedOrder[]): UnifiedOrder[] {
    const priorityOrder: Record<OrderPriorityLevel, number> = {
      urgent: 1,
      high: 2,
      normal: 3,
      low: 4,
    };

    return [...orders].sort((a, b) => {
      const priorityA = priorityOrder[a.priority || 'normal'];
      const priorityB = priorityOrder[b.priority || 'normal'];

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Secondary sort by created_at (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  // Real-time subscription
  useEffect(() => {
    if (!realtime || !tenant?.id) return;

    const channel = supabase
      .channel(`unified-orders-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unified_orders',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, realtime, queryClient]);

  return query;
}

/**
 * Hook to fetch a single order by ID
 */
export function useUnifiedOrder(orderId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: unifiedOrdersKeys.detail(orderId ?? ''),
    queryFn: async () => {
      if (!tenant?.id || !orderId) throw new Error('Missing tenant or order ID');

      const { data, error } = await supabase
        .from('unified_orders')
        .select(`
          *,
          items:unified_order_items(*),
          customer:customers(*),
          client:wholesale_clients(*),
          courier:couriers(*),
          menu:disposable_menus(id, name)
        `)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch order', { orderId, error });
        throw error;
      }

      if (!data) {
        throw new Error('Order not found');
      }

      return data as unknown as UnifiedOrder;
    },
    enabled: !!tenant?.id && !!orderId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to create a new order
 */
export function useCreateUnifiedOrder() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Use RPC for atomic creation
      const rpcParams = {
        p_tenant_id: tenant.id,
        p_order_type: input.order_type,
        p_source: input.source,
        p_items: JSON.parse(JSON.stringify(input.items)),
        p_customer_id: input.customer_id,
        p_wholesale_client_id: input.wholesale_client_id,
        p_menu_id: input.menu_id,
        p_shift_id: input.shift_id,
        p_delivery_address: input.delivery_address,
        p_delivery_notes: input.delivery_notes,
        p_payment_method: input.payment_method,
        p_courier_id: input.courier_id,
        p_contact_name: input.contact_name,
        p_contact_phone: input.contact_phone,
        p_metadata: JSON.parse(JSON.stringify(input.metadata || {})),
      };

      const { data: orderId, error } = await supabase.rpc('create_unified_order', rpcParams);

      if (error) {
        logger.error('Failed to create order', { error });
        throw error;
      }

      // Fetch the created order
      const { data: order, error: fetchError } = await supabase
        .from('unified_orders')
        .select('*, items:unified_order_items(*)')
        .eq('id', orderId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      return order as unknown as UnifiedOrder;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.lists() });
      const previousOrders = queryClient.getQueriesData<UnifiedOrder[]>({ queryKey: unifiedOrdersKeys.lists() });

      // Create optimistic order
      const optimisticOrder: UnifiedOrder = {
        id: `temp-${Date.now()}`,
        tenant_id: tenant?.id ?? '',
        order_number: 'Creating...',
        order_type: input.order_type,
        source: input.source,
        status: 'pending',
        subtotal: input.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
        tax_amount: 0,
        discount_amount: 0,
        total_amount: input.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
        payment_method: input.payment_method || null,
        payment_status: 'unpaid',
        customer_id: input.customer_id || null,
        wholesale_client_id: input.wholesale_client_id || null,
        menu_id: input.menu_id || null,
        shift_id: input.shift_id || null,
        delivery_address: input.delivery_address || null,
        delivery_notes: input.delivery_notes || null,
        courier_id: input.courier_id || null,
        contact_name: input.contact_name || null,
        contact_phone: input.contact_phone || null,
        metadata: input.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cancelled_at: null,
        cancellation_reason: null,
        // Priority defaults (will be set by DB trigger)
        priority: 'normal',
        priority_set_at: null,
        priority_set_by: null,
        priority_auto_set: false,
      };

      // Add to all matching list caches
      queryClient.setQueriesData<UnifiedOrder[]>(
        { queryKey: unifiedOrdersKeys.lists() },
        (old) => old ? [optimisticOrder, ...old] : [optimisticOrder]
      );

      return { previousOrders };
    },
    onError: (error, _input, context) => {
      // Rollback
      if (context?.previousOrders) {
        context.previousOrders.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to create order';
      logger.error('Failed to create order', error, { component: 'useCreateUnifiedOrder' });
      toast.error('Order creation failed', { description: message });
    },
    onSuccess: (data) => {
      toast.success('Order created successfully');
      // Cross-panel invalidation
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'ORDER_CREATED', tenant.id, {
          customerId: data.customer_id || undefined,
          orderId: data.id,
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      // Inventory is decremented by database trigger when order is confirmed
      // Invalidate inventory queries to reflect stock changes
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Hook to update order status
 */
export function useUpdateOrderStatus() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: OrderStatus; notes?: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // For delivered status, check if stock was already decremented (by DB trigger on confirmation)
      let shouldDecrementStock = false;
      if (status === 'delivered') {
        const { data: currentOrder } = await supabase
          .from('unified_orders')
          .select('status')
          .eq('id', orderId)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        // DB trigger decrements stock when status changes to 'confirmed'.
        // Only decrement at delivery if the order was never confirmed (e.g., pending → delivered)
        const confirmedStatuses: string[] = ['confirmed', 'processing', 'in_transit', 'delivered', 'completed'];
        shouldDecrementStock = !currentOrder || !confirmedStatuses.includes(currentOrder.status);
      }

      const updateData: Record<string, unknown> = { status };
      if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = notes;
      }
      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('unified_orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update order status', { orderId, status, error });
        throw error;
      }

      // Restore stock for cancelled orders
      if (status === 'cancelled') {
        try {
          const { data: cancelledItems } = await supabase
            .from('unified_order_items')
            .select('id, product_id, quantity, product_name')
            .eq('order_id', orderId);

          if (cancelledItems && cancelledItems.length > 0) {
            for (const item of cancelledItems) {
              if (!item.product_id) continue;

              const { data: product } = await supabase
                .from('products')
                .select('id, stock_quantity')
                .eq('id', item.product_id)
                .eq('tenant_id', tenant.id)
                .maybeSingle();

              if (!product) continue;

              const previousQuantity = product.stock_quantity ?? 0;
              const newQuantity = previousQuantity + item.quantity;

              await supabase
                .from('products')
                .update({
                  stock_quantity: newQuantity,
                  available_quantity: newQuantity,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.product_id)
                .eq('tenant_id', tenant.id);

              // Log to inventory_history
              await supabase
                .from('inventory_history')
                .insert({
                  tenant_id: tenant.id,
                  product_id: item.product_id,
                  change_type: 'return',
                  previous_quantity: previousQuantity,
                  new_quantity: newQuantity,
                  change_amount: item.quantity,
                  reference_type: 'order_cancelled',
                  reference_id: orderId,
                  reason: 'order_cancelled',
                  notes: `Order cancelled - inventory restored`,
                  performed_by: null,
                  metadata: {
                    order_id: orderId,
                    order_item_id: item.id,
                    cancellation_reason: notes,
                    source: 'unified_status_update',
                  },
                });
            }

            logger.info('Stock restored for cancelled order', {
              component: 'useUpdateOrderStatus',
              orderId,
              itemCount: cancelledItems.length,
            });
          }
        } catch (err) {
          // Log but don't fail the status update — stock adjustment is secondary
          logger.error('Failed to restore stock for cancelled order', err, {
            component: 'useUpdateOrderStatus',
            orderId,
          });
        }
      }

      // Decrement stock for delivered orders that skipped confirmation
      if (status === 'delivered' && shouldDecrementStock) {
        try {
          const { data: orderItems } = await supabase
            .from('unified_order_items')
            .select('id, product_id, quantity, product_name')
            .eq('order_id', orderId);

          if (orderItems && orderItems.length > 0) {
            for (const item of orderItems) {
              if (!item.product_id) continue;

              const { data: product } = await supabase
                .from('products')
                .select('id, stock_quantity')
                .eq('id', item.product_id)
                .eq('tenant_id', tenant.id)
                .maybeSingle();

              if (!product) continue;

              const previousQuantity = product.stock_quantity ?? 0;
              const newQuantity = Math.max(0, previousQuantity - item.quantity);

              await supabase
                .from('products')
                .update({
                  stock_quantity: newQuantity,
                  available_quantity: newQuantity,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.product_id)
                .eq('tenant_id', tenant.id);

              // Log to inventory_history
              await supabase
                .from('inventory_history')
                .insert({
                  tenant_id: tenant.id,
                  product_id: item.product_id,
                  change_type: 'sale',
                  previous_quantity: previousQuantity,
                  new_quantity: newQuantity,
                  change_amount: -item.quantity,
                  reference_type: 'order_delivered',
                  reference_id: orderId,
                  reason: 'order_delivered',
                  notes: `Order delivered - inventory decremented`,
                  performed_by: null,
                  metadata: {
                    order_id: orderId,
                    order_item_id: item.id,
                    source: 'status_update',
                  },
                });
            }

            logger.info('Stock decremented for delivered order', {
              component: 'useUpdateOrderStatus',
              orderId,
              itemCount: orderItems.length,
            });
          }
        } catch (err) {
          // Log but don't fail the status update — stock adjustment is secondary
          logger.error('Failed to decrement stock for delivered order', err, {
            component: 'useUpdateOrderStatus',
            orderId,
          });
        }
      }

      return data as unknown as UnifiedOrder;
    },
    onMutate: async ({ orderId, status, notes }) => {
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.lists() });
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.detail(orderId) });

      const previousLists = queryClient.getQueriesData<UnifiedOrder[]>({ queryKey: unifiedOrdersKeys.lists() });
      const previousDetail = queryClient.getQueryData<UnifiedOrder>(unifiedOrdersKeys.detail(orderId));

      const updateFields: Partial<UnifiedOrder> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'cancelled') {
        updateFields.cancelled_at = new Date().toISOString();
        updateFields.cancellation_reason = notes;
      }

      // Update list caches
      queryClient.setQueriesData<UnifiedOrder[]>(
        { queryKey: unifiedOrdersKeys.lists() },
        (old) => old?.map(order => order.id === orderId ? { ...order, ...updateFields } : order)
      );

      // Update detail cache
      if (previousDetail) {
        queryClient.setQueryData<UnifiedOrder>(
          unifiedOrdersKeys.detail(orderId),
          { ...previousDetail, ...updateFields }
        );
      }

      return { previousLists, previousDetail, orderId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail && context.orderId) {
        queryClient.setQueryData(unifiedOrdersKeys.detail(context.orderId), context.previousDetail);
      }
      const message = error instanceof Error ? error.message : 'Failed to update order status';
      logger.error('Failed to update order status', error, { component: 'useUpdateOrderStatus' });
      toast.error('Status update failed', { description: message });
    },
    onSuccess: (data, variables) => {
      toast.success(`Order status updated to ${data.status}`);
      // Cross-panel invalidation
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenant.id, {
          orderId: data.id,
          customerId: data.customer_id || undefined,
        });

        // Status-specific targeted invalidation for optimal panel refresh
        const status = variables.status;

        // pending -> confirmed: invalidate orders, dashboard
        if (status === 'confirmed') {
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.queue(tenant.id) });
        }

        // confirmed -> preparing: invalidate fulfillment queue
        if (status === 'processing') {
          queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.queue(tenant.id) });
        }

        // preparing -> ready: invalidate fulfillment, dashboard
        if (status === 'completed' || status === 'delivered') {
          // Order complete - invalidate everything
          queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });
          // Stock may have been adjusted for delivered orders
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
          // Update customer stats on order completion
          if (data.customer_id) {
            queryClient.invalidateQueries({
             queryKey: queryKeys.customers.stats(tenant?.id ?? '', data.customer_id),
            });
          }
        }

        // ANY -> cancelled: invalidate orders, inventory (stock return), finance, customers
        if (status === 'cancelled') {
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });
          if (data.customer_id) {
            queryClient.invalidateQueries({
             queryKey: queryKeys.customers.stats(tenant?.id ?? '', data.customer_id),
            });
          }
        }

        // ANY -> refunded: similar to cancelled plus returns
        if (status === 'refunded') {
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.returns.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });
        }
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.detail(variables.orderId) });
      // Inventory is synced by database trigger when status changes to confirmed/cancelled
      // Also sync on delivery for orders that may have skipped confirmation
      if (variables.status === 'confirmed' || variables.status === 'cancelled' || variables.status === 'delivered') {
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      }
    },
  });
}

/**
 * Hook to cancel an order
 */
export function useCancelOrder() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, reason, reverseBalance = false }: {
      orderId: string;
      reason: string;
      reverseBalance?: boolean;
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Get order details first
      const { data: order, error: fetchError } = await supabase
        .from('unified_orders')
        .select('order_type, wholesale_client_id, total_amount')
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!order) throw new Error('Order not found');

      // Update order status
      const { data, error } = await supabase
        .from('unified_orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to cancel order', { orderId, error });
        throw error;
      }

      // Reverse balance if requested and is wholesale order
      if (reverseBalance && order.order_type === 'wholesale' && order.wholesale_client_id) {
        await supabase.rpc('update_contact_balance', {
          p_contact_id: order.wholesale_client_id,
          p_amount: order.total_amount,
          p_operation: 'subtract',
        });
      }

      // Restore stock for cancelled order items
      try {
        const { data: orderItems } = await supabase
          .from('unified_order_items')
          .select('id, product_id, quantity, product_name')
          .eq('order_id', orderId);

        if (orderItems && orderItems.length > 0) {
          for (const item of orderItems) {
            if (!item.product_id) continue;

            const { data: product } = await supabase
              .from('products')
              .select('id, stock_quantity')
              .eq('id', item.product_id)
              .eq('tenant_id', tenant.id)
              .maybeSingle();

            if (!product) continue;

            const previousQuantity = product.stock_quantity ?? 0;
            const newQuantity = previousQuantity + item.quantity;

            await supabase
              .from('products')
              .update({
                stock_quantity: newQuantity,
                available_quantity: newQuantity,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.product_id)
              .eq('tenant_id', tenant.id);

            // Log to inventory_history
            await supabase
              .from('inventory_history')
              .insert({
                tenant_id: tenant.id,
                product_id: item.product_id,
                change_type: 'return',
                previous_quantity: previousQuantity,
                new_quantity: newQuantity,
                change_amount: item.quantity,
                reference_type: 'order_cancelled',
                reference_id: orderId,
                reason: 'order_cancelled',
                notes: `Order cancelled - inventory restored`,
                performed_by: null,
                metadata: {
                  order_id: orderId,
                  order_item_id: item.id,
                  cancellation_reason: reason,
                  source: 'unified_cancel_order',
                },
              });
          }

          logger.info('Stock restored for cancelled order', {
            component: 'useCancelOrder',
            orderId,
            itemCount: orderItems.length,
          });
        }
      } catch (err) {
        // Log but don't fail the cancellation — stock adjustment is secondary
        logger.error('Failed to restore stock for cancelled order', err, {
          component: 'useCancelOrder',
          orderId,
        });
      }

      return data as unknown as UnifiedOrder;
    },
    onMutate: async ({ orderId, reason }) => {
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.lists() });
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.detail(orderId) });

      const previousLists = queryClient.getQueriesData<UnifiedOrder[]>({ queryKey: unifiedOrdersKeys.lists() });
      const previousDetail = queryClient.getQueryData<UnifiedOrder>(unifiedOrdersKeys.detail(orderId));

      const cancelFields: Partial<UnifiedOrder> = {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueriesData<UnifiedOrder[]>(
        { queryKey: unifiedOrdersKeys.lists() },
        (old) => old?.map(order => order.id === orderId ? { ...order, ...cancelFields } : order)
      );

      if (previousDetail) {
        queryClient.setQueryData<UnifiedOrder>(
          unifiedOrdersKeys.detail(orderId),
          { ...previousDetail, ...cancelFields }
        );
      }

      return { previousLists, previousDetail, orderId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail && context.orderId) {
        queryClient.setQueryData(unifiedOrdersKeys.detail(context.orderId), context.previousDetail);
      }
      const message = error instanceof Error ? error.message : 'Failed to cancel order';
      logger.error('Failed to cancel order', error, { component: 'useCancelOrder' });
      toast.error('Order cancellation failed', { description: message });
    },
    onSuccess: (data) => {
      toast.success('Order cancelled successfully');
      // Cross-panel invalidation - cancellation affects order lists, customer stats, inventory, finance
      if (tenant?.id) {
        // Fire ORDER_STATUS_CHANGED (cancellation is a status change)
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenant.id, {
          orderId: data.id,
          customerId: data.customer_id || undefined,
        });

        // Cancellation-specific: return stock, reverse finance
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });

        // Update customer stats if attached
        if (data.customer_id) {
          queryClient.invalidateQueries({
             queryKey: queryKeys.customers.stats(tenant?.id ?? '', data.customer_id),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.customers.detail(tenant?.id ?? '', data.customer_id),
          });
        }
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.detail(variables.orderId) });
      // Inventory is restored by database trigger when order is cancelled
      // Invalidate inventory queries to reflect stock restoration
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Hook to get order statistics
 */
export function useOrderStats(orderType: OrderType = 'all') {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.orders.all, 'stats', tenant?.id, orderType],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      let query = supabase
        .from('unified_orders')
        .select('status, total_amount')
        .eq('tenant_id', tenant.id);

      if (orderType !== 'all') {
        query = query.eq('order_type', orderType);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch order stats', { error });
        throw error;
      }

      // Calculate stats
      const stats = {
        total: data.length,
        pending: data.filter(o => o.status === 'pending').length,
        confirmed: data.filter(o => o.status === 'confirmed').length,
        processing: data.filter(o => o.status === 'processing').length,
        in_transit: data.filter(o => o.status === 'in_transit').length,
        delivered: data.filter(o => o.status === 'delivered').length,
        completed: data.filter(o => o.status === 'completed').length,
        cancelled: data.filter(o => o.status === 'cancelled').length,
        revenue: data
          .filter(o => ['completed', 'delivered'].includes(o.status))
          .reduce((sum, o) => sum + (o.total_amount ?? 0), 0),
      };

      return stats;
    },
    enabled: !!tenant?.id,
    staleTime: 30000, // 30 seconds
  });
}

