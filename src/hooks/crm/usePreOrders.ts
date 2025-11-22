import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMPreOrder, PreOrderFormValues, LineItem, CRMInvoice } from '@/types/crm';
import { toast } from 'sonner';
import { crmInvoiceKeys } from './useInvoices';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';

export const crmPreOrderKeys = {
    all: ['crm-pre-orders'] as const,
    lists: () => [...crmPreOrderKeys.all, 'list'] as const,
    detail: (id: string) => [...crmPreOrderKeys.all, 'detail', id] as const,
};

const normalizePreOrder = (row: any): CRMPreOrder => ({ ...row, line_items: Array.isArray(row.line_items) ? (row.line_items as unknown as LineItem[]) : [] });
const normalizeInvoice = (row: any): CRMInvoice => ({ ...row, line_items: Array.isArray(row.line_items) ? (row.line_items as unknown as LineItem[]) : [], issue_date: row.invoice_date, tax: row.tax_amount });

export function usePreOrders() {
    const accountId = useAccountIdSafe();
    return useQuery({
        queryKey: crmPreOrderKeys.lists(),
        queryFn: async () => {
            if (!accountId) return [];
            const { data, error } = await supabase.from('crm_pre_orders').select('*, client:crm_clients(*)').eq('account_id', accountId).order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(normalizePreOrder);
        },
        enabled: !!accountId,
    });
}

export function useClientPreOrders(clientId: string | undefined) {
    const accountId = useAccountIdSafe();
    return useQuery({
        queryKey: [...crmPreOrderKeys.all, 'client', clientId || ''],
        queryFn: async () => {
            if (!clientId || !accountId) return [];
            const { data, error } = await supabase.from('crm_pre_orders').select('*').eq('client_id', clientId).eq('account_id', accountId).order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(normalizePreOrder);
        },
        enabled: !!clientId && !!accountId,
    });
}

export function usePreOrder(preOrderId: string | undefined) {
    const accountId = useAccountIdSafe();
    return useQuery({
        queryKey: crmPreOrderKeys.detail(preOrderId || ''),
        queryFn: async () => {
            if (!preOrderId || !accountId) return null;
            const { data, error } = await supabase.from('crm_pre_orders').select('*, client:crm_clients(*)').eq('id', preOrderId).eq('account_id', accountId).single();
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
        mutationFn: async (values: any) => {
            const finalAccountId = values.account_id || accountId;
            if (!finalAccountId) throw new Error('Account ID required');
            const { data, error } = await supabase.from('crm_pre_orders').insert({ ...values, account_id: finalAccountId, line_items: values.line_items }).select('*, client:crm_clients(*)').single();
            if (error) throw error;
            return normalizePreOrder(data);
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.all }); toast.success('Pre-order created'); },
        onError: (error: any) => { logger.error('Create failed', error); toast.error(error.message); },
    });
}

export function useCancelPreOrder() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();
    return useMutation({
        mutationFn: async (preOrderId: string) => {
            if (!accountId) throw new Error('Account ID required');
            const { data, error } = await supabase.from('crm_pre_orders').update({ status: 'cancelled' }).eq('id', preOrderId).eq('account_id', accountId).select('*').single();
            if (error) throw error;
            return normalizePreOrder(data);
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.all }); toast.success('Pre-order cancelled'); },
    });
}

export function useConvertPreOrderToInvoice() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();
    return useMutation({
        mutationFn: async ({ preOrderId, invoiceData }: { preOrderId: string; invoiceData: any }) => {
            if (!accountId) throw new Error('Account ID required');
            const { data: preOrder, error: fetchError } = await supabase.from('crm_pre_orders').select('*').eq('id', preOrderId).eq('account_id', accountId).single();
            if (fetchError) throw fetchError;
            const subtotal = preOrder.subtotal;
            const tax_rate = invoiceData.tax_rate || 0;
            const tax_amount = subtotal * (tax_rate / 100);
            const total = subtotal + tax_amount;
            const { data: invoice, error: invoiceError } = await supabase.from('crm_invoices').insert({ ...invoiceData, account_id: accountId, client_id: preOrder.client_id, line_items: preOrder.line_items, subtotal, tax_rate, tax_amount, total, status: 'draft', created_from_pre_order_id: preOrderId }).select('*').single();
            if (invoiceError) throw invoiceError;
            const { error: updateError } = await supabase.from('crm_pre_orders').update({ status: 'converted', converted_to_invoice_id: invoice.id, converted_at: new Date().toISOString() }).eq('id', preOrderId).eq('account_id', accountId);
            if (updateError) throw updateError;
            return { invoice: normalizeInvoice(invoice), preOrder: normalizePreOrder(preOrder) };
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.all }); queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all }); toast.success('Converted successfully'); },
        onError: (error: any) => { logger.error('Convert failed', error); toast.error(error.message); },
    });
}
