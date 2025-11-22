import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMInvoice, InvoiceFormValues, LineItem } from '@/types/crm';
import { toast } from 'sonner';
import { crmClientKeys } from './useClients';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';

/**
 * Query key factory for CRM invoices
 */
export const crmInvoiceKeys = {
    all: ['crm-invoices'] as const,
    lists: () => [...crmInvoiceKeys.all, 'list'] as const,
    list: (filters: string) => [...crmInvoiceKeys.lists(), { filters }] as const,
    details: () => [...crmInvoiceKeys.all, 'detail'] as const,
    detail: (id: string) => [...crmInvoiceKeys.details(), id] as const,
    byToken: (token: string) => [...crmInvoiceKeys.all, 'token', token] as const,
    byClient: (clientId: string) => [...crmInvoiceKeys.all, 'client', clientId] as const,
};

/**
 * Fetch all invoices for current account
 */
export function useInvoices(status?: CRMInvoice['status']) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmInvoiceKeys.list(status || 'all'),
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            let query = supabase
                .from('crm_invoices')
                .select('*, client:crm_clients(*)')
                .eq('account_id', accountId)
                .order('created_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch invoices', error, { component: 'useInvoices', accountId, status });
                throw error;
            }
            return (data || []).map((row: any) => ({
                ...row,
                line_items: ((row.line_items as any) || []) as LineItem[],
            })) as CRMInvoice[];
        },
        enabled: !!accountId,
    });
}

/**
 * Fetch invoices for a specific client
 */
export function useClientInvoices(clientId: string | undefined) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmInvoiceKeys.byClient(clientId || ''),
        queryFn: async () => {
            if (!clientId || !accountId) return [];

            const { data, error } = await supabase
                .from('crm_invoices')
                .select('*')
                .eq('client_id', clientId)
                .eq('account_id', accountId)
                .order('created_at', { ascending: false });

            if (error) {
                logger.error('Failed to fetch client invoices', error, { component: 'useClientInvoices', clientId, accountId });
                throw error;
            }
            return (data || []).map((row: any) => ({
                ...row,
                line_items: ((row.line_items as any) || []) as LineItem[],
            })) as CRMInvoice[];
        },
        enabled: !!clientId && !!accountId,
    });
}

/**
 * Fetch a single invoice by ID
 */
export function useInvoice(invoiceId: string | undefined) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmInvoiceKeys.detail(invoiceId || ''),
        queryFn: async () => {
            if (!invoiceId || !accountId) return null;

            const { data, error } = await supabase
                .from('crm_invoices')
                .select('*, client:crm_clients(*)')
                .eq('id', invoiceId)
                .eq('account_id', accountId)
                .single();

            if (error) {
                logger.error('Failed to fetch invoice', error, { component: 'useInvoice', invoiceId, accountId });
                throw error;
            }
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMInvoice;
        },
        enabled: !!invoiceId && !!accountId,
    });
}

/**
 * Fetch invoice by public token (for client portal)
 */
export function useInvoiceByToken(token: string | undefined) {
    return useQuery({
        queryKey: crmInvoiceKeys.byToken(token || ''),
        queryFn: async () => {
            if (!token) return null;

            const { data, error } = await supabase
                .from('crm_invoices')
                .select('*, client:crm_clients(*)')
                .eq('public_token', token)
                .single();

            if (error) throw error;
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMInvoice;
        },
        enabled: !!token,
    });
}

/**
 * Create a new invoice
 */
export function useCreateInvoice() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (values: InvoiceFormValues & { account_id?: string }) => {
            const finalAccountId = values.account_id || accountId;
            
            if (!finalAccountId) {
                throw new Error('Account ID is required to create an invoice');
            }

            // Calculate totals
            const subtotal = values.line_items.reduce((sum, item) => sum + item.line_total, 0);
            const tax_rate = values.tax_rate || 0;
            const tax_amount = subtotal * (tax_rate / 100);
            const total = subtotal + tax_amount;

            const { data, error } = await supabase
                .from('crm_invoices')
                .insert({
                    account_id: finalAccountId,
                    client_id: values.client_id,
                    invoice_date: values.invoice_date,
                    due_date: values.due_date,
                    line_items: values.line_items,
                    subtotal,
                    tax_rate,
                    tax_amount,
                    total,
                    status: values.status || 'draft',
                })
                .select('*, client:crm_clients(*)')
                .single();

            if (error) {
                logger.error('Failed to create invoice', error, { component: 'useCreateInvoice', accountId: finalAccountId, clientId: values.client_id });
                throw error;
            }
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMInvoice;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.byClient(data.client_id) });
            queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(data.client_id) });
            toast.success('Invoice created successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Invoice creation failed', error, { component: 'useCreateInvoice' });
            toast.error(`Failed to create invoice: ${errorMessage}`);
        },
    });
}

/**
 * Update an existing invoice
 */
export function useUpdateInvoice() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async ({ id, values }: { id: string; values: Partial<InvoiceFormValues> }) => {
            if (!accountId) {
                throw new Error('Account ID is required to update an invoice');
            }

            const updateData: Record<string, unknown> = {};

            if (values.invoice_date) updateData.invoice_date = values.invoice_date;
            if (values.due_date) updateData.due_date = values.due_date;
            if (values.status) updateData.status = values.status;

            if (values.line_items) {
                updateData.line_items = values.line_items;
                const subtotal = values.line_items.reduce((sum, item) => sum + item.line_total, 0);
                const tax_rate = values.tax_rate || 0;
                const tax_amount = subtotal * (tax_rate / 100);
                const total = subtotal + tax_amount;

                updateData.subtotal = subtotal;
                updateData.tax_rate = tax_rate;
                updateData.tax_amount = tax_amount;
                updateData.total = total;
            }

            const { data, error } = await supabase
                .from('crm_invoices')
                .update(updateData)
                .eq('id', id)
                .eq('account_id', accountId)
                .select('*, client:crm_clients(*)')
                .single();

            if (error) {
                logger.error('Failed to update invoice', error, { component: 'useUpdateInvoice', invoiceId: id, accountId });
                throw error;
            }
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMInvoice;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.byClient(data.client_id) });
            queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(data.client_id) });
            toast.success('Invoice updated successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Invoice update failed', error, { component: 'useUpdateInvoice' });
            toast.error(`Failed to update invoice: ${errorMessage}`);
        },
    });
}

/**
 * Mark invoice as paid
 */
export function useMarkInvoicePaid() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (invoiceId: string) => {
            if (!accountId) {
                throw new Error('Account ID is required to mark invoice as paid');
            }

            const { data, error } = await supabase
                .from('crm_invoices')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                })
                .eq('id', invoiceId)
                .eq('account_id', accountId)
                .select('*, client:crm_clients(*)')
                .single();

            if (error) {
                logger.error('Failed to mark invoice as paid', error, { component: 'useMarkInvoicePaid', invoiceId, accountId });
                throw error;
            }
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMInvoice;
        },
        onSuccess: (data, invoiceId) => {
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.detail(invoiceId) });
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.byClient(data.client_id) });
            queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(data.client_id) });
            toast.success('Invoice marked as paid');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Mark invoice paid failed', error, { component: 'useMarkInvoicePaid' });
            toast.error(`Failed to mark invoice as paid: ${errorMessage}`);
        },
    });
}

/**
 * Delete an invoice (only if draft)
 */
export function useDeleteInvoice() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (invoiceId: string) => {
            if (!accountId) {
                throw new Error('Account ID is required to delete an invoice');
            }

            const { error } = await supabase
                .from('crm_invoices')
                .delete()
                .eq('id', invoiceId)
                .eq('account_id', accountId)
                .eq('status', 'draft'); // Only allow deleting drafts

            if (error) {
                logger.error('Failed to delete invoice', error, { component: 'useDeleteInvoice', invoiceId, accountId });
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.lists() });
            toast.success('Invoice deleted successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Invoice deletion failed', error, { component: 'useDeleteInvoice' });
            toast.error(`Failed to delete invoice: ${errorMessage}`);
        },
    });
}

/**
 * Get recent invoices for dashboard
 */
export function useRecentInvoices(limit: number = 10) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: [...crmInvoiceKeys.lists(), 'recent', limit],
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            const { data, error } = await supabase
                .from('crm_invoices')
                .select('*, client:crm_clients(name)')
                .eq('account_id', accountId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                logger.error('Failed to fetch recent invoices', error, { component: 'useRecentInvoices', accountId, limit });
                throw error;
            }
            return (data || []).map((row: any) => ({
                ...row,
                line_items: ((row.line_items as any) || []) as LineItem[],
            })) as CRMInvoice[];
        },
        enabled: !!accountId,
    });
}
