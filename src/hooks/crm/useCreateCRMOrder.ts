import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LineItem, CRMPreOrder, CRMInvoice } from '@/types/crm';
import { toast } from 'sonner';
import { useAccountIdSafe } from './useAccountId';
import { logger } from '@/lib/logger';
import { invalidateOnEvent } from '@/lib/invalidation';
import { publish } from '@/lib/eventBus';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

export interface CreateCRMOrderInput {
    client_id: string;
    order_type: 'standard' | 'pre_order' | 'invoice';
    line_items: LineItem[];
    subtotal: number;
    tax: number;
    total: number;
    expected_date?: Date;
    notes?: string;
}

export interface CreateCRMOrderResult {
    type: 'pre_order' | 'invoice';
    data: CRMPreOrder | CRMInvoice;
}

/**
 * Hook for creating CRM orders (as pre-orders or invoices)
 */
export function useCreateCRMOrder() {
    const queryClient = useQueryClient();
    const accountId = useAccountIdSafe();

    return useMutation({
        mutationFn: async (input: CreateCRMOrderInput): Promise<CreateCRMOrderResult> => {
            const finalAccountId = accountId;
            if (!finalAccountId) {
                throw new Error('Account ID is required');
            }

            // Handle different order types
            if (input.order_type === 'invoice') {
                // Create invoice directly
                const today = new Date().toISOString().split('T')[0];
                const dueDate = input.expected_date
                    ? input.expected_date.toISOString().split('T')[0]
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                const { data, error } = await supabase
                    .from('crm_invoices')
                    .insert({
                        client_id: input.client_id,
                        invoice_date: today,
                        due_date: dueDate,
                        line_items: input.line_items,
                        subtotal: input.subtotal,
                        tax_rate: 0,
                        tax_amount: input.tax,
                        total: input.total,
                        status: 'draft',
                        notes: input.notes || null,
                    })
                    .select('*, client:crm_clients(*)')
                    .maybeSingle();

                if (error) {
                    logger.error('Failed to create invoice', error, { component: 'useCreateCRMOrder' });
                    throw error;
                }

                return {
                    type: 'invoice',
                    data: {
                        ...data,
                        line_items: Array.isArray(data.line_items) ? data.line_items as unknown as LineItem[] : [],
                        issue_date: data.invoice_date,
                        tax: data.tax_amount,
                    } as CRMInvoice,
                };
            } else {
                // Create pre-order (for both standard and pre_order types)
                const { data, error } = await supabase
                    .from('crm_pre_orders')
                    .insert({
                        client_id: input.client_id,
                        line_items: input.line_items,
                        subtotal: input.subtotal,
                        tax: input.tax,
                        total: input.total,
                        status: 'pending',
                        expected_date: input.expected_date?.toISOString() || null,
                        notes: input.notes || null,
                    })
                    .select('*, client:crm_clients(*)')
                    .maybeSingle();

                if (error) {
                    logger.error('Failed to create pre-order', error, { component: 'useCreateCRMOrder' });
                    throw error;
                }

                return {
                    type: 'pre_order',
                    data: {
                        ...data,
                        line_items: Array.isArray(data.line_items) ? data.line_items as unknown as LineItem[] : [],
                    } as CRMPreOrder,
                };
            }
        },
        onMutate: async () => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.crm.preOrders.all() });
            await queryClient.cancelQueries({ queryKey: queryKeys.crm.invoices.all() });
        },
        onError: (error: unknown) => {
            logger.error('CRM order creation failed', error, { component: 'useCreateCRMOrder' });
            toast.error('Order creation failed', { description: humanizeError(error, 'Failed to create order') });
        },
        onSuccess: (result) => {
            if (result.type === 'invoice') {
                toast.success('Invoice created successfully');
                // Cross-panel invalidation — finance hub, dashboard, collections
                if (accountId) {
                    invalidateOnEvent(queryClient, 'INVOICE_CREATED', accountId, {
                        invoiceId: result.data?.id,
                        customerId: (result.data as CRMInvoice)?.client_id,
                    });
                }
            } else {
                toast.success('Order created successfully');
                // Cross-panel invalidation — pre-order affects orders, dashboard, badge counts
                if (accountId) {
                    invalidateOnEvent(queryClient, 'ORDER_CREATED', accountId, {
                        customerId: (result.data as CRMPreOrder)?.client_id,
                    });
                }
            }

            // Publish eventBus event so Hotbox, notifications, and toasts fire
            if (accountId) {
                publish('order_created', {
                    orderId: result.data?.id ?? '',
                    tenantId: accountId,
                    customerId: result.type === 'invoice'
                        ? (result.data as CRMInvoice)?.client_id
                        : (result.data as CRMPreOrder)?.client_id,
                });
            }

            // Telegram notification for admin-created orders
            if (accountId && result.data?.id) {
                supabase.functions.invoke('forward-order-telegram', {
                    body: { orderId: result.data.id, tenantId: accountId },
                }).catch(() => { /* best-effort */ });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.crm.preOrders.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
        },
    });
}
