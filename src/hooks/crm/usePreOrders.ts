import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMPreOrder, PreOrderFormValues, InvoiceFormValues, LineItem } from '@/types/crm';
import { toast } from 'sonner';
import { crmClientKeys } from './useClients';
import { crmInvoiceKeys } from './useInvoices';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';

/**
 * Query key factory for CRM pre-orders
 */
export const crmPreOrderKeys = {
    all: ['crm-pre-orders'] as const,
    lists: () => [...crmPreOrderKeys.all, 'list'] as const,
    list: (filters: string) => [...crmPreOrderKeys.lists(), { filters }] as const,
    details: () => [...crmPreOrderKeys.all, 'detail'] as const,
    detail: (id: string) => [...crmPreOrderKeys.details(), id] as const,
    byClient: (clientId: string) => [...crmPreOrderKeys.all, 'client', clientId] as const,
};

/**
 * Fetch all pre-orders for current account
 */
export function usePreOrders(status?: CRMPreOrder['status']) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmPreOrderKeys.list(status || 'all'),
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            let query = supabase
                .from('crm_pre_orders')
                .select('*, client:crm_clients(*)')
                .eq('account_id', accountId)
                .order('created_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch pre-orders', error, { component: 'usePreOrders', accountId, status });
                throw error;
            }
            return (data || []).map((row: any) => ({
                ...row,
                line_items: ((row.line_items as any) || []) as LineItem[],
            })) as CRMPreOrder[];
        },
        enabled: !!accountId,
    });
}

/**
 * Fetch pre-orders for a specific client
 */
export function useClientPreOrders(clientId: string | undefined) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmPreOrderKeys.byClient(clientId || ''),
        queryFn: async () => {
            if (!clientId || !accountId) return [];

            const { data, error } = await supabase
                .from('crm_pre_orders')
                .select('*')
                .eq('client_id', clientId)
                .eq('account_id', accountId)
                .order('created_at', { ascending: false });

            if (error) {
                logger.error('Failed to fetch client pre-orders', error, { component: 'useClientPreOrders', clientId, accountId });
                throw error;
            }
            return (data || []).map((row: any) => ({
                ...row,
                line_items: ((row.line_items as any) || []) as LineItem[],
            })) as CRMPreOrder[];
        },
        enabled: !!clientId && !!accountId,
    });
}

/**
 * Fetch a single pre-order by ID
 */
export function usePreOrder(preOrderId: string | undefined) {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: crmPreOrderKeys.detail(preOrderId || ''),
        queryFn: async () => {
            if (!preOrderId || !accountId) return null;

            const { data, error } = await supabase
                .from('crm_pre_orders')
                .select('*, client:crm_clients(*)')
                .eq('id', preOrderId)
                .eq('account_id', accountId)
                .single();

            if (error) {
                logger.error('Failed to fetch pre-order', error, { component: 'usePreOrder', preOrderId, accountId });
                throw error;
            }
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMPreOrder;
        },
        enabled: !!preOrderId && !!accountId,
    });
}

/**
 * Create a new pre-order
 */
export function useCreatePreOrder() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (values: PreOrderFormValues & { account_id?: string }) => {
            const finalAccountId = values.account_id || accountId;
            
            if (!finalAccountId) {
                throw new Error('Account ID is required to create a pre-order');
            }

            // Calculate totals
            const subtotal = values.line_items.reduce((sum, item) => sum + item.line_total, 0);
            const tax = values.tax || 0;
            const total = subtotal + tax;

            const { data, error } = await supabase
                .from('crm_pre_orders')
                .insert({
                    account_id: finalAccountId,
                    client_id: values.client_id,
                    line_items: values.line_items,
                    subtotal,
                    tax,
                    total,
                    status: values.status || 'pending',
                })
                .select('*, client:crm_clients(*)')
                .single();

            if (error) {
                logger.error('Failed to create pre-order', error, { component: 'useCreatePreOrder', accountId: finalAccountId, clientId: values.client_id });
                throw error;
            }
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMPreOrder;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.byClient(data.client_id) });
            toast.success('Pre-order created successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Pre-order creation failed', error, { component: 'useCreatePreOrder' });
            toast.error(`Failed to create pre-order: ${errorMessage}`);
        },
    });
}

/**
 * Update an existing pre-order
 */
export function useUpdatePreOrder() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async ({ id, values }: { id: string; values: Partial<PreOrderFormValues> }) => {
            if (!accountId) {
                throw new Error('Account ID is required to update a pre-order');
            }

            const updateData: Record<string, unknown> = {};

            if (values.status) updateData.status = values.status;

            if (values.line_items) {
                updateData.line_items = values.line_items;
                const subtotal = values.line_items.reduce((sum, item) => sum + item.line_total, 0);
                const tax = values.tax || 0;
                const total = subtotal + tax;

                updateData.subtotal = subtotal;
                updateData.tax = tax;
                updateData.total = total;
            }

            const { data, error } = await supabase
                .from('crm_pre_orders')
                .update(updateData)
                .eq('id', id)
                .eq('account_id', accountId)
                .select('*, client:crm_clients(*)')
                .single();

            if (error) {
                logger.error('Failed to update pre-order', error, { component: 'useUpdatePreOrder', preOrderId: id, accountId });
                throw error;
            }
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMPreOrder;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.byClient(data.client_id) });
            toast.success('Pre-order updated successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Pre-order update failed', error, { component: 'useUpdatePreOrder' });
            toast.error(`Failed to update pre-order: ${errorMessage}`);
        },
    });
}

/**
 * Convert pre-order to invoice
 */
export function useConvertPreOrderToInvoice() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async ({
            preOrderId,
            invoiceData
        }: {
            preOrderId: string;
            invoiceData?: Partial<InvoiceFormValues>
        }) => {
            if (!accountId) {
                throw new Error('Account ID is required to convert pre-order');
            }

            // Fetch the pre-order
            const { data: preOrder, error: fetchError } = await supabase
                .from('crm_pre_orders')
                .select('*')
                .eq('id', preOrderId)
                .eq('account_id', accountId)
                .single();

            if (fetchError) {
                logger.error('Failed to fetch pre-order for conversion', fetchError, { component: 'useConvertPreOrderToInvoice', preOrderId, accountId });
                throw fetchError;
            }

            // Create invoice from pre-order
            const subtotal = preOrder.subtotal;
            const tax_rate = invoiceData?.tax_rate || 0;
            const tax_amount = subtotal * (tax_rate / 100);
            const total = subtotal + tax_amount;

            const { data: invoice, error: createError } = await supabase
                .from('crm_invoices')
                .insert({
                    account_id: accountId,
                    client_id: preOrder.client_id,
                    invoice_date: invoiceData?.invoice_date || new Date().toISOString().split('T')[0],
                    due_date: invoiceData?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
                    line_items: preOrder.line_items,
                    subtotal,
                    tax_rate,
                    tax_amount,
                    total,
                    status: 'draft',
                    created_from_pre_order_id: preOrderId,
                })
                .select('*')
                .single();

            if (createError) {
                logger.error('Failed to create invoice from pre-order', createError, { component: 'useConvertPreOrderToInvoice', preOrderId, accountId });
                throw createError;
            }

            // Update pre-order status
            const { error: updateError } = await supabase
                .from('crm_pre_orders')
                .update({
                    status: 'converted',
                    converted_to_invoice_id: invoice.id,
                    converted_at: new Date().toISOString(),
                })
                .eq('id', preOrderId)
                .eq('account_id', accountId);

            if (updateError) {
                logger.error('Failed to update pre-order after conversion', updateError, { component: 'useConvertPreOrderToInvoice', preOrderId, accountId });
                throw updateError;
            }

            return { preOrder, invoice };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.detail(data.preOrder.id) });
            queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmClientKeys.detail(data.preOrder.client_id) });
            toast.success('Pre-order converted to invoice successfully');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Pre-order conversion failed', error, { component: 'useConvertPreOrderToInvoice' });
            toast.error(`Failed to convert pre-order: ${errorMessage}`);
        },
    });
}

/**
 * Cancel a pre-order
 */
export function useCancelPreOrder() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (preOrderId: string) => {
            if (!accountId) {
                throw new Error('Account ID is required to cancel a pre-order');
            }

            const { data, error } = await supabase
                .from('crm_pre_orders')
                .update({ status: 'cancelled' })
                .eq('id', preOrderId)
                .eq('account_id', accountId)
                .select('*, client:crm_clients(*)')
                .single();

            if (error) {
                logger.error('Failed to cancel pre-order', error, { component: 'useCancelPreOrder', preOrderId, accountId });
                throw error;
            }
            return {
                ...data,
                line_items: ((data.line_items as any) || []) as LineItem[],
            } as CRMPreOrder;
        },
        onSuccess: (data, preOrderId) => {
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.lists() });
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.detail(preOrderId) });
            queryClient.invalidateQueries({ queryKey: crmPreOrderKeys.byClient(data.client_id) });
            toast.success('Pre-order cancelled');
        },
        onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Pre-order cancellation failed', error, { component: 'useCancelPreOrder' });
            toast.error(`Failed to cancel pre-order: ${errorMessage}`);
        },
    });
}

/**
 * Get count of pending pre-orders (for dashboard)
 */
export function usePendingPreOrdersCount() {
    const accountId = useAccountIdSafe();

    return useQuery({
        queryKey: [...crmPreOrderKeys.lists(), 'count', 'pending'],
        queryFn: async () => {
            if (!accountId) {
                throw new Error('Account ID is required');
            }

            const { count, error } = await supabase
                .from('crm_pre_orders')
                .select('*', { count: 'exact', head: true })
                .eq('account_id', accountId)
                .eq('status', 'pending');

            if (error) {
                logger.error('Failed to fetch pending pre-orders count', error, { component: 'usePendingPreOrdersCount', accountId });
                throw error;
            }
            return count || 0;
        },
        enabled: !!accountId,
    });
}
