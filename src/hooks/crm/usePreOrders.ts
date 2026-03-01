import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMPreOrder, LineItem, CRMInvoice } from '@/types/crm';
import { toast } from 'sonner';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';
import { invalidateOnEvent } from '@/lib/invalidation';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

const normalizePreOrder = (row: Record<string, unknown>): CRMPreOrder => ({ ...(row as unknown as CRMPreOrder), line_items: Array.isArray(row.line_items) ? (row.line_items as unknown as LineItem[]) : [] });
const normalizeInvoice = (row: Record<string, unknown>): CRMInvoice => ({ ...(row as unknown as CRMInvoice), line_items: Array.isArray(row.line_items) ? (row.line_items as unknown as LineItem[]) : [], issue_date: row.invoice_date as string, tax: row.tax_amount as number });

export function usePreOrders() {
    const accountId = useAccountIdSafe();
    return useQuery({
        queryKey: queryKeys.crm.preOrders.lists(),
        queryFn: async () => {
            if (!accountId) return [];
            const { data, error } = await supabase.from('crm_pre_orders').select('id, account_id, client_id, pre_order_number, line_items, subtotal, tax, total, status, converted_to_invoice_id, converted_at, expected_date, notes, created_at, updated_at, client:crm_clients(id, name, email, phone)').eq('account_id', accountId).order('created_at', { ascending: false }).limit(200);
            if (error) throw error;
            return (data ?? []).map(normalizePreOrder);
        },
        enabled: !!accountId,
    });
}

export function useClientPreOrders(clientId: string | undefined) {
    const accountId = useAccountIdSafe();
    return useQuery({
        queryKey: queryKeys.crm.preOrders.byClient(clientId ?? ''),
        queryFn: async () => {
            if (!clientId || !accountId) return [];
            const { data, error } = await supabase.from('crm_pre_orders').select('id, account_id, client_id, pre_order_number, line_items, subtotal, tax, total, status, converted_to_invoice_id, converted_at, expected_date, notes, created_at, updated_at').eq('client_id', clientId).eq('account_id', accountId).order('created_at', { ascending: false }).limit(200);
            if (error) throw error;
            return (data ?? []).map(normalizePreOrder);
        },
        enabled: !!clientId && !!accountId,
    });
}

export function usePreOrder(preOrderId: string | undefined) {
    const accountId = useAccountIdSafe();
    return useQuery({
        queryKey: queryKeys.crm.preOrders.detail(preOrderId ?? ''),
        queryFn: async () => {
            if (!preOrderId || !accountId) return null;
            const { data, error } = await supabase.from('crm_pre_orders').select('id, account_id, client_id, pre_order_number, line_items, subtotal, tax, total, status, converted_to_invoice_id, converted_at, expected_date, notes, created_at, updated_at, client:crm_clients(id, name, email, phone)').eq('id', preOrderId).eq('account_id', accountId).maybeSingle();
            if (error) throw error;
            return normalizePreOrder(data);
        },
        enabled: !!preOrderId && !!accountId,
    });
}

export function useCreatePreOrder() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();
    return useMutation({
        mutationFn: async (values: Record<string, unknown> & { account_id?: string; line_items?: LineItem[] }) => {
            const finalAccountId = values.account_id || accountId;
            if (!finalAccountId) throw new Error('Account ID required');
            const { data, error } = await supabase.from('crm_pre_orders').insert({ ...values, account_id: finalAccountId, line_items: values.line_items }).select('id, account_id, client_id, pre_order_number, line_items, subtotal, tax, total, status, converted_to_invoice_id, converted_at, expected_date, notes, created_at, updated_at, client:crm_clients(id, name, email, phone)').maybeSingle();
            if (error) throw error;
            return normalizePreOrder(data);
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: queryKeys.crm.preOrders.lists() });
            const previousPreOrders = queryClient.getQueryData(queryKeys.crm.preOrders.lists());
            return { previousPreOrders };
        },
        onError: (error: unknown, _variables: unknown, context: { previousPreOrders?: unknown } | undefined) => {
            if (context?.previousPreOrders) {
                queryClient.setQueryData(queryKeys.crm.preOrders.lists(), context.previousPreOrders);
            }
            logger.error('Pre-order creation failed', error, { component: 'useCreatePreOrder' });
            toast.error('Pre-order creation failed', { description: humanizeError(error, 'Failed to create pre-order') });
        },
        onSuccess: () => { toast.success('Pre-order created'); },
        onSettled: () => { queryClient.invalidateQueries({ queryKey: queryKeys.crm.preOrders.all() }); },
    });
}

export function useCancelPreOrder() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();
    return useMutation({
        mutationFn: async (preOrderId: string) => {
            if (!accountId) throw new Error('Account ID required');
            const { data, error } = await supabase.from('crm_pre_orders').update({ status: 'cancelled' }).eq('id', preOrderId).eq('account_id', accountId).select('id, account_id, client_id, pre_order_number, line_items, subtotal, tax, total, status, converted_to_invoice_id, converted_at, expected_date, notes, created_at, updated_at').maybeSingle();
            if (error) throw error;
            return normalizePreOrder(data);
        },
        onMutate: async (preOrderId) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.crm.preOrders.lists() });
            const previousPreOrders = queryClient.getQueryData<CRMPreOrder[]>(queryKeys.crm.preOrders.lists());

            queryClient.setQueryData<CRMPreOrder[]>(
                queryKeys.crm.preOrders.lists(),
                (old) => old?.map(po => po.id === preOrderId ? { ...po, status: 'cancelled' } : po)
            );

            return { previousPreOrders };
        },
        onError: (error: unknown, _variables: unknown, context: { previousPreOrders?: CRMPreOrder[] } | undefined) => {
            if (context?.previousPreOrders) {
                queryClient.setQueryData(queryKeys.crm.preOrders.lists(), context.previousPreOrders);
            }
            logger.error('Pre-order cancellation failed', error, { component: 'useCancelPreOrder' });
            toast.error('Pre-order cancellation failed', { description: humanizeError(error, 'Failed to cancel pre-order') });
        },
        onSuccess: () => { toast.success('Pre-order cancelled'); },
        onSettled: () => { queryClient.invalidateQueries({ queryKey: queryKeys.crm.preOrders.all() }); },
    });
}

export function useConvertPreOrderToInvoice() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();
    return useMutation({
        mutationFn: async ({ preOrderId, invoiceData }: { preOrderId: string; invoiceData: Record<string, unknown> & { tax_rate?: number } }) => {
            if (!accountId) throw new Error('Account ID required');
            const { data: preOrder, error: fetchError } = await supabase.from('crm_pre_orders').select('id, account_id, client_id, pre_order_number, line_items, subtotal, tax, total, status, converted_to_invoice_id, converted_at, expected_date, notes, created_at, updated_at').eq('id', preOrderId).eq('account_id', accountId).maybeSingle();
            if (fetchError) throw fetchError;
            const subtotal = preOrder.subtotal;
            const tax_rate = invoiceData.tax_rate ?? 0;
            const tax_amount = subtotal * (tax_rate / 100);
            const total = subtotal + tax_amount;
            const { data: invoice, error: invoiceError } = await supabase.from('crm_invoices').insert({ ...invoiceData, account_id: accountId, client_id: preOrder.client_id, line_items: preOrder.line_items, subtotal, tax_rate, tax_amount, total, status: 'draft', created_from_pre_order_id: preOrderId }).select('id, account_id, client_id, invoice_number, invoice_date, due_date, status, subtotal, tax_rate, tax_amount, total, amount_paid, payment_history, line_items, paid_at, created_at, updated_at').maybeSingle();
            if (invoiceError) throw invoiceError;
            const { error: updateError } = await supabase.from('crm_pre_orders').update({ status: 'converted', converted_to_invoice_id: invoice.id, converted_at: new Date().toISOString() }).eq('id', preOrderId).eq('account_id', accountId);
            if (updateError) throw updateError;
            return { invoice: normalizeInvoice(invoice), preOrder: normalizePreOrder(preOrder) };
        },
        onMutate: async ({ preOrderId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.crm.preOrders.lists() });
            const previousPreOrders = queryClient.getQueryData<CRMPreOrder[]>(queryKeys.crm.preOrders.lists());

            queryClient.setQueryData<CRMPreOrder[]>(
                queryKeys.crm.preOrders.lists(),
                (old) => old?.map(po => po.id === preOrderId ? { ...po, status: 'converting' as const } : po) as CRMPreOrder[]
            );

            return { previousPreOrders };
        },
        onError: (error: unknown, _variables: unknown, context: { previousPreOrders?: CRMPreOrder[] } | undefined) => {
            if (context?.previousPreOrders) {
                queryClient.setQueryData(queryKeys.crm.preOrders.lists(), context.previousPreOrders);
            }
            logger.error('Pre-order conversion failed', error, { component: 'useConvertPreOrderToInvoice' });
            toast.error('Conversion failed', { description: humanizeError(error, 'Failed to convert pre-order') });
        },
        onSuccess: (result) => {
            toast.success('Converted successfully');
            // Cross-panel invalidation — finance hub, dashboard, collections
            if (accountId) {
                invalidateOnEvent(queryClient, 'INVOICE_CREATED', accountId, {
                    invoiceId: result?.invoice?.id,
                    customerId: result?.invoice?.client_id,
                });
            }
        },
        onSettled: () => { queryClient.invalidateQueries({ queryKey: queryKeys.crm.preOrders.all() }); queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() }); },
    });
}
