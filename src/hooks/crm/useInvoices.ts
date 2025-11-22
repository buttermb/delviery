import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMInvoice, InvoiceFormValues, LineItem } from '@/types/crm';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { crmClientKeys } from './useClients';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';

export const crmInvoiceKeys = {
    all: ['crm-invoices'] as const,
    lists: () => [...crmInvoiceKeys.all, 'list'] as const,
    detail: (id: string) => [...crmInvoiceKeys.all, 'detail', id] as const,
    byClient: (clientId: string) => [...crmInvoiceKeys.all, 'client', clientId] as const,
};

const normalizeInvoice = (row: any): CRMInvoice => ({
    ...row,
    line_items: Array.isArray(row.line_items) ? (row.line_items as unknown as LineItem[]) : [],
    issue_date: row.invoice_date,
    tax: row.tax_amount,
});

export function useInvoices() {
    const accountId = useAccountIdSafe();

    const useInvoicesQuery = () => useQuery({
        queryKey: crmInvoiceKeys.lists(),
        queryFn: async () => {
            if (!accountId) return [];
            const { data, error } = await supabase.from('crm_invoices').select('*, client:crm_clients(*)').eq('account_id', accountId).order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(normalizeInvoice);
        },
        enabled: !!accountId,
    });

    const useInvoiceQuery = (id: string) => useQuery({
        queryKey: crmInvoiceKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await supabase.from('crm_invoices').select('*, client:crm_clients(*)').eq('id', id).single();
            if (error) throw error;
            return normalizeInvoice(data);
        },
        enabled: !!id,
    });

    const useMarkInvoicePaid = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: async (invoiceId: string) => {
                const { data, error } = await supabase.from('crm_invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId).select('*, client:crm_clients(*)').single();
                if (error) throw error;
                return normalizeInvoice(data);
            },
            onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all }); toast.success('Invoice marked as paid'); },
        });
    };

    const useDeleteInvoice = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: async (invoiceId: string) => { const { error } = await supabase.from('crm_invoices').delete().eq('id', invoiceId); if (error) throw error; },
            onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all }); toast.success('Invoice deleted'); },
        });
    };

    return { useInvoicesQuery, useInvoiceQuery, useMarkInvoicePaid, useDeleteInvoice };
}

export function useClientInvoices(clientId: string | undefined) {
    const accountId = useAccountIdSafe();
    return useQuery({
        queryKey: crmInvoiceKeys.byClient(clientId || ''),
        queryFn: async () => {
            if (!clientId || !accountId) return [];
            const { data, error } = await supabase.from('crm_invoices').select('*').eq('client_id', clientId).eq('account_id', accountId).order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(normalizeInvoice);
        },
        enabled: !!clientId && !!accountId,
    });
}

export function useCreateInvoice() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();
    return useMutation({
        mutationFn: async (values: any) => {
            const finalAccountId = values.account_id || accountId;
            if (!finalAccountId) throw new Error('Account ID required');
            const { data, error } = await supabase.from('crm_invoices').insert({ ...values, account_id: finalAccountId, line_items: values.line_items }).select('*, client:crm_clients(*)').single();
            if (error) throw error;
            return normalizeInvoice(data);
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all }); toast.success('Invoice created'); },
        onError: (error: any) => { logger.error('Create failed', error); toast.error(error.message); },
    });
}
