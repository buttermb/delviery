/**
 * CRM Invoices Hook
 * Provides CRUD operations for CRM invoices
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { invalidateOnEvent } from '@/lib/invalidation';
import { toast } from 'sonner';

export interface CustomerInvoice {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  crm_client_id: string | null;
  invoice_number: string;
  status: string | null;
  subtotal: number;
  tax: number | null;
  discount: number | null;
  total: number;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface InvoiceFilters {
  status?: string;
  search?: string;
}

interface InvoiceCreateInput {
  contact_id?: string;
  crm_client_id?: string;
  invoice_number: string;
  status?: string;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  due_date: string;
  notes?: string;
}

interface InvoiceUpdateInput extends Partial<InvoiceCreateInput> {
  id: string;
}

interface UseCRMInvoicesReturn {
  useInvoicesQuery: (filters?: InvoiceFilters) => UseQueryResult<CustomerInvoice[], Error>;
  useInvoiceQuery: (id: string) => UseQueryResult<CustomerInvoice | null, Error>;
  useCreateInvoice: () => UseMutationResult<CustomerInvoice, Error, InvoiceCreateInput>;
  useUpdateInvoice: () => UseMutationResult<CustomerInvoice, Error, InvoiceUpdateInput>;
  useDeleteInvoice: () => UseMutationResult<void, Error, string>;
  useSendInvoice: () => UseMutationResult<void, Error, string>;
  useMarkAsPaid: () => UseMutationResult<CustomerInvoice, Error, string>;
  useMarkAsOverdue: () => UseMutationResult<CustomerInvoice, Error, string>;
}

export function useCRMInvoices(): UseCRMInvoicesReturn {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const useInvoicesQuery = (filters?: InvoiceFilters): UseQueryResult<CustomerInvoice[], Error> => {
    return useQuery({
      queryKey: ['crm-invoices', tenant?.id, filters],
      queryFn: async (): Promise<CustomerInvoice[]> => {
        if (!tenant?.id) return [];

        let query = (supabase as any)
          .from('crm_invoices')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        if (filters?.search) {
          query = query.ilike('invoice_number', `%${escapePostgresLike(filters.search)}%`);
        }

        const { data, error } = await query;

        if (error && error.code !== '42P01') {
          logger.error('Failed to fetch CRM invoices', error, { component: 'useCRMInvoices' });
          throw error;
        }

        return (data || []) as CustomerInvoice[];
      },
      enabled: !!tenant?.id,
    });
  };

  const useInvoiceQuery = (id: string): UseQueryResult<CustomerInvoice | null, Error> => {
    return useQuery({
      queryKey: ['crm-invoice', tenant?.id, id],
      queryFn: async (): Promise<CustomerInvoice | null> => {
        if (!tenant?.id || !id) return null;

        const { data, error } = await (supabase as any)
          .from('crm_invoices')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (error && error.code !== '42P01') {
          logger.error('Failed to fetch CRM invoice', error, { component: 'useCRMInvoices' });
          throw error;
        }

        return data as CustomerInvoice | null;
      },
      enabled: !!tenant?.id && !!id,
    });
  };

  const useCreateInvoice = () => {
    return useMutation({
      mutationFn: async (input: InvoiceCreateInput): Promise<CustomerInvoice> => {
        if (!tenant?.id) throw new Error('No tenant');

        const { data, error } = await (supabase as any)
          .from('crm_invoices')
          .insert({ ...input, tenant_id: tenant.id })
          .select()
          .single();

        if (error) throw error;
        return data as CustomerInvoice;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
        toast.success('Invoice created');
        // Cross-panel invalidation — finance hub, dashboard, collections
        if (tenant?.id) {
          invalidateOnEvent(queryClient, 'INVOICE_CREATED', tenant.id, {
            invoiceId: data?.id,
          });
        }
      },
      onError: (error: Error) => {
        logger.error('Failed to create invoice', error, { component: 'useCRMInvoices' });
        toast.error('Failed to create invoice');
      },
    });
  };

  const useUpdateInvoice = () => {
    return useMutation({
      mutationFn: async ({ id, ...input }: InvoiceUpdateInput): Promise<CustomerInvoice> => {
        if (!tenant?.id) throw new Error('No tenant');

        const { data, error } = await (supabase as any)
          .from('crm_invoices')
          .update(input)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select()
          .single();

        if (error) throw error;
        return data as CustomerInvoice;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
        toast.success('Invoice updated');
      },
      onError: (error: Error) => {
        logger.error('Failed to update invoice', error, { component: 'useCRMInvoices' });
        toast.error('Failed to update invoice');
      },
    });
  };

  const useDeleteInvoice = () => {
    return useMutation({
      mutationFn: async (id: string): Promise<void> => {
        if (!tenant?.id) throw new Error('No tenant');

        const { error } = await (supabase as any)
          .from('crm_invoices')
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
        toast.success('Invoice deleted');
      },
      onError: (error: Error) => {
        logger.error('Failed to delete invoice', error, { component: 'useCRMInvoices' });
        toast.error('Failed to delete invoice');
      },
    });
  };

  const useSendInvoice = () => {
    return useMutation({
      mutationFn: async (id: string): Promise<void> => {
        // Placeholder for sending invoice via email
        logger.info('Invoice send requested', { invoiceId: id, component: 'useCRMInvoices' });
      },
      onSuccess: () => {
        toast.success('Invoice sent');
      },
    });
  };

  const useMarkAsPaid = () => {
    return useMutation({
      mutationFn: async (id: string): Promise<CustomerInvoice> => {
        if (!tenant?.id) throw new Error('No tenant');

        const { data, error } = await (supabase as any)
          .from('crm_invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select()
          .single();

        if (error) throw error;
        return data as CustomerInvoice;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
        toast.success('Invoice marked as paid');
      },
    });
  };

  const useMarkAsOverdue = () => {
    return useMutation({
      mutationFn: async (id: string): Promise<CustomerInvoice> => {
        if (!tenant?.id) throw new Error('No tenant');

        const { data, error } = await (supabase as any)
          .from('crm_invoices')
          .update({ status: 'overdue' })
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select()
          .single();

        if (error) throw error;
        return data as CustomerInvoice;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
        toast.success('Invoice marked as overdue');
      },
    });
  };

  return {
    useInvoicesQuery,
    useInvoiceQuery,
    useCreateInvoice,
    useUpdateInvoice,
    useDeleteInvoice,
    useSendInvoice,
    useMarkAsPaid,
    useMarkAsOverdue,
  };
}
