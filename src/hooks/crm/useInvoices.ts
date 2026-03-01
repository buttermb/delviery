import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMInvoice, InvoiceFormValues, LineItem } from '@/types/crm';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';
import { invalidateOnEvent } from '@/lib/invalidation';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

// Type-safe client wrapper for crm_invoices (not yet in generated types)
type SupabaseQueryResult<T> = Promise<{ data: T | null; error: { code?: string; message?: string } | null }>;
type SupabaseListResult<T> = Promise<{ data: T[] | null; error: { code?: string; message?: string } | null }>;

interface CrmInvoiceClient {
  from: (table: 'crm_invoices') => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => SupabaseListResult<Record<string, unknown>>;
        } & SupabaseListResult<Record<string, unknown>>;
        order: (col: string, opts: { ascending: boolean }) => SupabaseListResult<Record<string, unknown>>;
        maybeSingle: () => SupabaseQueryResult<Record<string, unknown>>;
      };
      maybeSingle: () => SupabaseQueryResult<Record<string, unknown>>;
    };
    insert: (data: Record<string, unknown>) => {
      select: (cols: string) => {
        maybeSingle: () => SupabaseQueryResult<Record<string, unknown>>;
      };
    };
  };
}

const crmClient = supabase as unknown as CrmInvoiceClient;

const normalizeInvoice = (row: unknown): CRMInvoice => {
    const data = row as Record<string, unknown>;
    return {
        ...(data as unknown as CRMInvoice),
        line_items: Array.isArray(data.line_items) ? (data.line_items as unknown as LineItem[]) : [],
        issue_date: data.invoice_date as string,
        tax: data.tax_amount as number,
    };
};

export type InvoiceSortState = {
    column: string;
    ascending: boolean;
} | null;

const INVOICE_SORT_COLUMN_MAP: Record<string, string> = {
    invoice_date: 'invoice_date',
    due_date: 'due_date',
    total: 'total',
    status: 'status',
    invoice_number: 'invoice_number',
    amount_paid: 'amount_paid',
    created_at: 'created_at',
};

export function useInvoices() {
    const accountId = useAccountIdSafe();

    const useInvoicesQuery = (sort?: InvoiceSortState) => useQuery({
        queryKey: [...queryKeys.crm.invoices.lists(), { sort }],
        queryFn: async () => {
            if (!accountId) return [];
            const sortCol = sort?.column && INVOICE_SORT_COLUMN_MAP[sort.column]
                ? INVOICE_SORT_COLUMN_MAP[sort.column]
                : 'created_at';
            const { data, error } = await supabase
                .from('crm_invoices')
                .select('id, account_id, client_id, invoice_number, invoice_date, due_date, status, subtotal, tax_rate, tax_amount, total, amount_paid, payment_history, line_items, paid_at, created_at, updated_at, client:crm_clients(id, name, email, phone)')
                .eq('account_id', accountId)
                .order(sortCol, { ascending: sort?.ascending ?? false })
                .limit(500);
            if (error) throw error;
            return (data ?? []).map((row: Record<string, unknown>) => normalizeInvoice(row));
        },
        enabled: !!accountId,
        staleTime: 30_000,
        gcTime: 300_000,
    });

    const useInvoiceQuery = (id: string) => useQuery({
        queryKey: queryKeys.crm.invoices.detail(id),
        queryFn: async () => {
            if (!accountId) return null;
            const { data, error } = await supabase
                .from('crm_invoices')
                .select('id, account_id, client_id, invoice_number, invoice_date, due_date, status, subtotal, tax_rate, tax_amount, total, amount_paid, payment_history, line_items, paid_at, created_at, updated_at, client:crm_clients(id, name, email, phone)')
                .eq('id', id)
                .eq('account_id', accountId)
                .maybeSingle();
            if (error) throw error;
            return data ? normalizeInvoice(data as Record<string, unknown>) : null;
        },
        enabled: !!id && !!accountId,
        staleTime: 30_000,
        gcTime: 300_000,
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
            onSuccess: (data) => {
                queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
                toast.success('Invoice marked as paid');
                // Cross-panel invalidation - invoice payment affects finance, collections, dashboard
                if (accountId) {
                    invalidateOnEvent(queryClient, 'INVOICE_PAID', accountId, {
                        invoiceId: data?.id,
                        customerId: data?.client_id,
                    });
                }
            },
            onError: (error: Error) => { logger.error('Failed to mark invoice as paid', { error }); toast.error('Failed to mark invoice as paid', { description: humanizeError(error) }); },
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
            onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() }); toast.success('Invoice deleted'); },
            onError: (error: Error) => { logger.error('Failed to delete invoice', { error }); toast.error('Failed to delete invoice', { description: humanizeError(error) }); },
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
                queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
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
                queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
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

                const { data, error } = await crmClient
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
                        status: 'draft',
                    })
                    .select('*, client:crm_clients(*)')
                    .maybeSingle();

                if (error) throw error;
                return normalizeInvoice(data);
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
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
        queryKey: queryKeys.crm.invoices.byClient(clientId ?? ''),
        queryFn: async () => {
            if (!clientId || !accountId) return [];
            const { data, error } = await crmClient
                .from('crm_invoices')
                .select('id, account_id, client_id, invoice_number, invoice_date, due_date, status, subtotal, tax_rate, tax_amount, total, amount_paid, payment_history, line_items, paid_at, created_at, updated_at')
                .eq('client_id', clientId)
                .eq('account_id', accountId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data ?? []).map((row: unknown) => normalizeInvoice(row));
        },
        enabled: !!clientId && !!accountId,
        staleTime: 30_000,
        gcTime: 300_000,
    });
}

export function useCreateInvoice() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();
    return useMutation({
        mutationFn: async (values: InvoiceFormValues & { account_id?: string }) => {
            const finalAccountId = values.account_id || accountId;
            if (!finalAccountId) throw new Error('Account ID required');
            const { data, error } = await crmClient.from('crm_invoices').insert({ ...values, account_id: finalAccountId, line_items: values.line_items as unknown as Json[] }).select('*, client:crm_clients(*)').maybeSingle();
            if (error) throw error;
            return normalizeInvoice(data as unknown as Record<string, unknown>);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
            toast.success('Invoice created');
            // Cross-panel invalidation - invoice creation affects finance, collections, dashboard
            if (accountId) {
                invalidateOnEvent(queryClient, 'INVOICE_CREATED', accountId, {
                    invoiceId: data?.id,
                    customerId: data?.client_id,
                });
            }
        },
        onError: (error: Error) => { logger.error('Create failed', error); toast.error('Failed to create invoice', { description: humanizeError(error) }); },
    });
}
