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

// Types
export type OrderType = 'retail' | 'wholesale' | 'menu' | 'pos' | 'all';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'in_transit' | 'delivered' | 'completed' | 'cancelled' | 'rejected' | 'refunded';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

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
  // Relations
  items?: UnifiedOrderItem[];
  customer?: { id: string; first_name: string; last_name: string; email: string } | null;
  client?: { id: string; business_name: string; contact_name: string } | null;
  courier?: { id: string; full_name: string; phone: string } | null;
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
    limit = 50,
    offset = 0,
    enabled = true,
    realtime = true,
  } = options;

  const queryKey = unifiedOrdersKeys.list(tenant?.id || '', { orderType, status, limit, offset });

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists after unified architecture migration
      let query = supabase
        .from('unified_orders')
        .select(`
          *,
          items:unified_order_items(*),
          customer:customers(id, first_name, last_name, email),
          client:wholesale_clients(id, business_name, contact_name),
          courier:couriers(id, full_name, phone)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (orderType !== 'all') {
        query = query.eq('order_type', orderType);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch unified orders', { error });
        throw error;
      }

      return data as UnifiedOrder[];
    },
    enabled: enabled && !!tenant?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

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
    queryKey: unifiedOrdersKeys.detail(orderId || ''),
    queryFn: async () => {
      if (!tenant?.id || !orderId) throw new Error('Missing tenant or order ID');

      // @ts-ignore - Table exists after unified architecture migration
      const { data, error } = await supabase
        .from('unified_orders')
        .select(`
          *,
          items:unified_order_items(*),
          customer:customers(*),
          client:wholesale_clients(*),
          courier:couriers(*)
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

      return data as UnifiedOrder;
    },
    enabled: !!tenant?.id && !!orderId,
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

      // @ts-ignore - RPC exists after unified architecture migration
      const { data: orderId, error } = await supabase.rpc('create_unified_order', rpcParams);

      if (error) {
        logger.error('Failed to create order', { error });
        throw error;
      }

      // Fetch the created order
      // @ts-ignore - Table exists after unified architecture migration
      const { data: order, error: fetchError } = await supabase
        .from('unified_orders')
        .select('*, items:unified_order_items(*)')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      return order as UnifiedOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
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

      const updateData: Record<string, unknown> = { status };
      if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = notes;
      }
      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      // @ts-ignore - Table exists after unified architecture migration
      const { data, error } = await supabase
        .from('unified_orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update order status', { orderId, status, error });
        throw error;
      }

      return data as UnifiedOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.detail(data.id) });
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
      // @ts-ignore - Table exists after unified architecture migration
      const { data: order, error: fetchError } = await supabase
        .from('unified_orders')
        .select('order_type, wholesale_client_id, total_amount')
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!order) throw new Error('Order not found');

      // Update order status
      // @ts-ignore - Table exists after unified architecture migration
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
        .single();

      if (error) {
        logger.error('Failed to cancel order', { orderId, error });
        throw error;
      }

      // Reverse balance if requested and is wholesale order
      if (reverseBalance && order.order_type === 'wholesale' && order.wholesale_client_id) {
        // @ts-ignore - RPC exists after unified architecture migration
        await supabase.rpc('update_contact_balance', {
          p_contact_id: order.wholesale_client_id,
          p_amount: order.total_amount,
          p_operation: 'subtract',
        });
      }

      return data as UnifiedOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.detail(data.id) });
    },
  });
}

/**
 * Hook to get order statistics
 */
export function useOrderStats(orderType: OrderType = 'all') {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ['unified-orders-stats', tenant?.id, orderType],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists after unified architecture migration
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
          .reduce((sum, o) => sum + (o.total_amount || 0), 0),
      };

      return stats;
    },
    enabled: !!tenant?.id,
    staleTime: 60000, // 1 minute
  });
}

