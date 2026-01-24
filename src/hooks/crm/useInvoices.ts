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

const normalizeInvoice = (row: unknown): CRMInvoice => {
    const data = row as Record<string, unknown>;
    return {
        ...(data as unknown as CRMInvoice),
        line_items: Array.isArray(data.line_items) ? (data.line_items as unknown as LineItem[]) : [],
        issue_date: data.invoice_date as string,
        tax: data.tax_amount as number,
    };
};

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
            if (!accountId) throw new Error('Account ID required');
            const { data, error } = await supabase.from('crm_invoices').select('*, client:crm_clients(*)').eq('id', id).eq('account_id', accountId).maybeSingle();
            if (error) throw error;
            return normalizeInvoice(data);
        },
        enabled: !!id && !!accountId,
    });

    const useMarkInvoicePaid = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: async (invoiceId: string) => {
                if (!accountId) throw new Error('Account ID required');
                const { data, error } = await supabase.from('crm_invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId).eq('account_id', accountId).select('*, client:crm_clients(*)').maybeSingle();
                if (error) throw error;
                return normalizeInvoice(data);
            },
            onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all }); toast.success('Invoice marked as paid'); },
            onError: (error: Error) => { logger.error('Failed to mark invoice as paid', { error }); toast.error('Failed to mark invoice as paid'); },
        });
    };

    const useDeleteInvoice = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: async (invoiceId: string) => {
                if (!accountId) throw new Error('Account ID required');
                const { error } = await supabase.from('crm_invoices').delete().eq('id', invoiceId).eq('account_id', accountId);
                if (error) throw error;
            },
            onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all }); toast.success('Invoice deleted'); },
            onError: (error: Error) => { logger.error('Failed to delete invoice', { error }); toast.error('Failed to delete invoice'); },
        });
    };

    const useMarkInvoiceSent = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: async (invoiceId: string) => {
                if (!accountId) throw new Error('Account ID required');
                const { data, error } = await supabase
                    .from('crm_invoices')
                    .update({ status: 'sent' })
                    .eq('id', invoiceId)
                    .eq('account_id', accountId)
                    .select('*, client:crm_clients(*)')
                    .maybeSingle();
                if (error) throw error;
                return normalizeInvoice(data);
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all });
                toast.success('Invoice marked as sent');
            },
            onError: (error: Error) => {
                logger.error('Failed to mark invoice as sent', { error });
                toast.error('Failed to mark invoice as sent');
            },
        });
    };

    const useVoidInvoice = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: async (invoiceId: string) => {
                if (!accountId) throw new Error('Account ID required');
                const { data, error } = await supabase
                    .from('crm_invoices')
                    .update({ status: 'cancelled' })
                    .eq('id', invoiceId)
                    .eq('account_id', accountId)
                    .select('*, client:crm_clients(*)')
                    .maybeSingle();
                if (error) throw error;
                return normalizeInvoice(data);
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all });
                toast.success('Invoice voided');
            },
            onError: (error: Error) => {
                logger.error('Failed to void invoice', { error });
                toast.error('Failed to void invoice');
            },
        });
    };

    const useDuplicateInvoice = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: async (invoiceId: string) => {
                if (!accountId) throw new Error('Account ID required');
                // First fetch the original invoice
                const { data: original, error: fetchError } = await supabase
                    .from('crm_invoices')
                    .select('*')
                    .eq('id', invoiceId)
                    .eq('account_id', accountId)
                    .maybeSingle();

                if (fetchError) throw fetchError;
                if (!original) throw new Error('Invoice not found');

                // Create a new invoice with the same data but reset status and dates
                const today = new Date().toISOString().split('T')[0];
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 30);

                const { data, error } = await (supabase as any)
                    .from('crm_invoices')
                    .insert({
                        account_id: original.account_id,
                        client_id: original.client_id,
                        invoice_date: today,
                        due_date: dueDate.toISOString().split('T')[0],
                        line_items: original.line_items,
                        subtotal: original.subtotal,
                        tax_rate: original.tax_rate,
                        tax_amount: original.tax_amount,
                        total: original.total,
                        notes: (original as any).notes,
                        status: 'draft',
                    })
                    .select('*, client:crm_clients(*)')
                    .maybeSingle();

                if (error) throw error;
                return normalizeInvoice(data);
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all });
                toast.success('Invoice duplicated');
            },
            onError: (error: Error) => {
                logger.error('Failed to duplicate invoice', { error });
                toast.error('Failed to duplicate invoice');
            },
        });
    };

    return {
        useInvoicesQuery,
        useInvoiceQuery,
        useMarkInvoicePaid,
        useMarkInvoiceSent,
        useVoidInvoice,
        useDuplicateInvoice,
        useDeleteInvoice
    };
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
        mutationFn: async (values: InvoiceFormValues & { account_id?: string }) => {
            const finalAccountId = values.account_id || accountId;
            if (!finalAccountId) throw new Error('Account ID required');
            const { data, error } = await (supabase as any).from('crm_invoices').insert({ ...values, account_id: finalAccountId, line_items: values.line_items as unknown as Json[] }).select('*, client:crm_clients(*)').maybeSingle();
            if (error) throw error;
            return normalizeInvoice(data as unknown as Record<string, unknown>);
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all }); toast.success('Invoice created'); },
        onError: (error: Error) => { logger.error('Create failed', error); toast.error(error.message); },
    });
}
