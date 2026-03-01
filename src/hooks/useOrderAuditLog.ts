/**
 * useOrderAuditLog Hook
 * Provides access to the order audit log for viewing all changes made to an order.
 * Supports filtering and manual logging of changes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export type OrderAuditAction =
  | 'created'
  | 'status_changed'
  | 'payment_updated'
  | 'shipping_updated'
  | 'items_modified'
  | 'notes_updated'
  | 'assigned_courier'
  | 'cancelled'
  | 'refunded'
  | 'delivered'
  | 'field_updated';

export type OrderAuditSource =
  | 'admin'
  | 'storefront'
  | 'pos'
  | 'api'
  | 'webhook'
  | 'system'
  | 'customer_portal';

export type ActorType = 'user' | 'system' | 'webhook' | 'api' | 'customer';

export interface OrderAuditLogEntry {
  id: string;
  tenant_id: string;
  order_id: string;
  order_table: string;
  order_number: string | null;
  action: OrderAuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changes: Record<string, unknown>;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_type: ActorType;
  ip_address: string | null;
  user_agent: string | null;
  source: OrderAuditSource;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface LogOrderAuditParams {
  orderId: string;
  orderTable?: 'orders' | 'unified_orders' | 'marketplace_orders' | 'wholesale_orders';
  orderNumber?: string;
  action: OrderAuditAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  changes?: Record<string, unknown>;
  actorType?: ActorType;
  source?: OrderAuditSource;
  reason?: string;
  notes?: string;
}

interface UseOrderAuditLogOptions {
  orderId?: string;
  limit?: number;
  enabled?: boolean;
}

export function useOrderAuditLog(options: UseOrderAuditLogOptions = {}) {
  const { orderId, limit = 50, enabled = true } = options;
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const queryKey = orderId
    ? queryKeys.orderAuditLog.byOrder(orderId)
    : queryKeys.orderAuditLog.list({ tenantId, limit });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<OrderAuditLogEntry[]> => {
      if (!tenantId) return [];

      try {
        let query = supabase
          .from('order_audit_log')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (orderId) {
          query = query.eq('order_id', orderId);
        }

        const { data: entries, error: queryError } = await query;

        if (queryError) {
          // Table might not exist yet
          if (queryError.code === '42P01') {
            return [];
          }
          throw queryError;
        }

        return (entries ?? []) as unknown as OrderAuditLogEntry[];
      } catch (err) {
        // Handle table not existing gracefully
        if ((err as { code?: string })?.code === '42P01') {
          return [];
        }
        logger.error('Failed to fetch order audit log', err as Error, {
          component: 'useOrderAuditLog',
          orderId,
          tenantId,
        });
        throw err;
      }
    },
    enabled: !!tenantId && enabled,
    staleTime: 30000, // 30 seconds
  });

  const logAudit = useMutation({
    mutationFn: async (params: LogOrderAuditParams) => {
      if (!tenantId) throw new Error('No tenant context');

      const { data: result, error: rpcError } = await supabase.rpc(
        'log_order_audit',
        {
          p_tenant_id: tenantId,
          p_order_id: params.orderId,
          p_order_table: params.orderTable ?? 'orders',
          p_order_number: params.orderNumber ?? null,
          p_action: params.action,
          p_field_name: params.fieldName ?? null,
          p_old_value: params.oldValue ?? null,
          p_new_value: params.newValue ?? null,
          p_changes: params.changes ?? {},
          p_actor_type: params.actorType ?? 'user',
          p_source: params.source ?? 'admin',
          p_reason: params.reason ?? null,
          p_notes: params.notes ?? null,
        }
      );

      if (rpcError) throw rpcError;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.orderAuditLog.all,
      });
    },
    onError: (err) => {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to log order audit', err as Error, {
        component: 'useOrderAuditLog',
      });
      toast.error('Failed to log change', { description: errorMessage });
    },
  });

  return {
    entries: data ?? [],
    isLoading,
    error,
    refetch,
    logAudit,
  };
}

/**
 * Get a human-readable description for an audit action
 */
export function getAuditActionLabel(action: OrderAuditAction): string {
  const labels: Record<OrderAuditAction, string> = {
    created: 'Order Created',
    status_changed: 'Status Changed',
    payment_updated: 'Payment Updated',
    shipping_updated: 'Shipping Updated',
    items_modified: 'Items Modified',
    notes_updated: 'Notes Updated',
    assigned_courier: 'Courier Assigned',
    cancelled: 'Order Cancelled',
    refunded: 'Order Refunded',
    delivered: 'Order Delivered',
    field_updated: 'Field Updated',
  };
  return labels[action] || action;
}

/**
 * Get icon configuration for an audit action
 */
export function getAuditActionConfig(action: OrderAuditAction): {
  color: string;
  bgColor: string;
  borderColor: string;
} {
  const configs: Record<OrderAuditAction, { color: string; bgColor: string; borderColor: string }> = {
    created: { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    status_changed: { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    payment_updated: { color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    shipping_updated: { color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
    items_modified: { color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
    notes_updated: { color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
    assigned_courier: { color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    cancelled: { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    refunded: { color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
    delivered: { color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
    field_updated: { color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
  };
  return configs[action] || configs.field_updated;
}
