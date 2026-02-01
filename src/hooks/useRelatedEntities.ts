import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccountIdSafe } from '@/hooks/crm/useAccountId';
import { queryKeys } from '@/lib/queryKeys';
import type { RelatedEntityItem } from '@/components/admin/RelatedEntitiesPanel';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';

/**
 * Hook for lazy-loading related entity data.
 * Data is only fetched when `enable()` is called (i.e., when the accordion section is expanded).
 */
function useLazyQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  deps: { accountId: string | null; entityId: string | undefined }
) {
  const [enabled, setEnabled] = useState(false);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: enabled && !!deps.accountId && !!deps.entityId,
  });

  const enable = useCallback(() => {
    setEnabled(true);
  }, []);

  return { ...query, enable };
}

/**
 * Related invoices for a client
 */
export function useRelatedClientInvoices(clientId: string | undefined) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.crm.invoices.byClient(clientId || ''), 'related'] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: invoices, error } = await supabase
        .from('crm_invoices')
        .select('id, invoice_number, status, total, invoice_date')
        .eq('client_id', clientId!)
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (invoices || []).map((inv) => ({
        id: inv.id,
        title: `Invoice #${inv.invoice_number}`,
        subtitle: format(new Date(inv.invoice_date), 'MMM d, yyyy'),
        status: inv.status,
        statusVariant: inv.status === 'paid' ? 'default' as const
          : inv.status === 'overdue' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(inv.total),
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related pre-orders for a client
 */
export function useRelatedClientPreOrders(clientId: string | undefined) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.crm.preOrders.byClient(clientId || ''), 'related'] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: preOrders, error } = await supabase
        .from('crm_pre_orders')
        .select('id, pre_order_number, status, total, created_at')
        .eq('client_id', clientId!)
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (preOrders || []).map((po) => ({
        id: po.id,
        title: `Pre-Order #${po.pre_order_number}`,
        subtitle: format(new Date(po.created_at), 'MMM d, yyyy'),
        status: po.status,
        statusVariant: po.status === 'converted' ? 'default' as const
          : po.status === 'cancelled' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(po.total),
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related orders for a customer
 */
export function useRelatedCustomerOrders(customerId: string | undefined) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.orders.all, 'related', 'customer', customerId || ''] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (orders || []).map((order) => ({
        id: order.id,
        title: `Order #${order.id.slice(0, 8)}`,
        subtitle: format(new Date(order.created_at), 'MMM d, yyyy'),
        status: order.status,
        statusVariant: order.status === 'completed' ? 'default' as const
          : order.status === 'cancelled' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(order.total_amount || 0),
      }));
    },
    { accountId, entityId: customerId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related invoices for a pre-order (by same client)
 */
export function useRelatedPreOrderInvoices(clientId: string | undefined, excludeId?: string) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.crm.invoices.byClient(clientId || ''), 'related', 'pre-order', excludeId || ''] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: invoices, error } = await supabase
        .from('crm_invoices')
        .select('id, invoice_number, status, total, invoice_date')
        .eq('client_id', clientId!)
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (invoices || []).map((inv) => ({
        id: inv.id,
        title: `Invoice #${inv.invoice_number}`,
        subtitle: format(new Date(inv.invoice_date), 'MMM d, yyyy'),
        status: inv.status,
        statusVariant: inv.status === 'paid' ? 'default' as const
          : inv.status === 'overdue' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(inv.total),
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related pre-orders for an invoice (by same client)
 */
export function useRelatedInvoicePreOrders(clientId: string | undefined, excludeId?: string) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.crm.preOrders.byClient(clientId || ''), 'related', 'invoice', excludeId || ''] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: preOrders, error } = await supabase
        .from('crm_pre_orders')
        .select('id, pre_order_number, status, total, created_at')
        .eq('client_id', clientId!)
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (preOrders || []).map((po) => ({
        id: po.id,
        title: `Pre-Order #${po.pre_order_number}`,
        subtitle: format(new Date(po.created_at), 'MMM d, yyyy'),
        status: po.status,
        statusVariant: po.status === 'converted' ? 'default' as const
          : po.status === 'cancelled' ? 'destructive' as const
          : 'secondary' as const,
        meta: formatCurrency(po.total),
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}

/**
 * Related payments for a client
 */
export function useRelatedClientPayments(clientId: string | undefined) {
  const accountId = useAccountIdSafe();

  const { data, isLoading, error, enable } = useLazyQuery(
    [...queryKeys.payments.byClient(clientId || ''), 'related'] as const,
    async (): Promise<RelatedEntityItem[]> => {
      const { data: payments, error } = await supabase
        .from('customer_payments')
        .select('id, amount, payment_method, payment_status, created_at')
        .eq('customer_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (payments || []).map((payment) => ({
        id: payment.id,
        title: formatCurrency(payment.amount || 0),
        subtitle: `${payment.payment_method || 'Unknown'} - ${format(new Date(payment.created_at), 'MMM d, yyyy')}`,
        status: payment.payment_status,
        statusVariant: payment.payment_status === 'completed' ? 'default' as const
          : 'secondary' as const,
      }));
    },
    { accountId, entityId: clientId }
  );

  return { items: data, isLoading, error, fetchItems: enable };
}
