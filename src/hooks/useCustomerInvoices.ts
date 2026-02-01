import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export interface CustomerInvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CustomerInvoice {
  id: string;
  tenant_id: string;
  customer_id: string;
  invoice_number: string;
  status: 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  due_date: string | null;
  issue_date: string | null;
  paid_at: string | null;
  notes: string | null;
  line_items: CustomerInvoiceLineItem[] | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
}

export interface CreateInvoiceInput {
  customer_id: string;
  subtotal: number;
  tax: number;
  total: number;
  due_date?: string;
  notes?: string;
  line_items?: CustomerInvoiceLineItem[];
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
}

export function useCustomerInvoices() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const useInvoicesQuery = (filters?: { status?: string; search?: string }) =>
    useQuery({
      queryKey: queryKeys.customerInvoices.list(tenant?.id, filters),
      queryFn: async () => {
        if (!tenant?.id) return [];

        let query = (supabase as any)
          .from('customer_invoices')
          .select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as unknown as CustomerInvoice[];
      },
      enabled: !!tenant?.id,
      staleTime: 30_000,
      gcTime: 300_000,
    });

  const useInvoiceQuery = (id: string) =>
    useQuery({
      queryKey: queryKeys.customerInvoices.detail(id),
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from('customer_invoices')
          .select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `)
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return data as unknown as CustomerInvoice | null;
      },
      enabled: !!id,
      staleTime: 30_000,
    });

  const useInvoiceStatsQuery = () =>
    useQuery({
      queryKey: queryKeys.customerInvoices.stats(tenant?.id),
      queryFn: async () => {
        if (!tenant?.id) return null;

        const { data, error } = await (supabase as any)
          .from('customer_invoices')
          .select('id, status, total, paid_at, created_at')
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        const invoices = (data || []) as Array<{ id: string; status: string; total: number; paid_at: string | null; created_at: string }>;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalRevenue = invoices
          .filter((i) => i.status === 'paid')
          .reduce((sum, i) => sum + (i.total || 0), 0);

        const paidThisMonth = invoices
          .filter((i) => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= monthStart)
          .reduce((sum, i) => sum + (i.total || 0), 0);

        const paidThisMonthCount = invoices.filter(
          (i) => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= monthStart
        ).length;

        const outstandingAmount = invoices
          .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
          .reduce((sum, i) => sum + (i.total || 0), 0);

        const overdueCount = invoices.filter((i) => i.status === 'overdue').length;
        const unpaidCount = invoices.filter((i) => i.status === 'unpaid').length;
        const draftCount = invoices.filter((i) => i.status === 'draft').length;
        const paidCount = invoices.filter((i) => i.status === 'paid').length;

        return {
          totalRevenue,
          paidThisMonth,
          paidThisMonthCount,
          outstandingAmount,
          overdueCount,
          unpaidCount,
          draftCount,
          paidCount,
          totalInvoices: invoices.length,
        };
      },
      enabled: !!tenant?.id,
      staleTime: 60_000,
    });

  const useCreateInvoice = () =>
    useMutation({
      mutationFn: async (input: CreateInvoiceInput) => {
        if (!tenant?.id) throw new Error('Tenant ID required');

        // Generate invoice number
        let invoiceNumber = `INV-${Date.now()}`;
        try {
          const { data: genNum, error: genErr } = await (supabase as unknown as { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: string | null; error: Error | null }> }).rpc('generate_invoice_number', {
            tenant_id: tenant.id,
          });
          if (!genErr && typeof genNum === 'string' && genNum.trim()) {
            invoiceNumber = genNum;
          }
        } catch {
          // Fallback to timestamp-based number
        }

        const { data, error } = await (supabase as any)
          .from('customer_invoices')
          .insert({
            tenant_id: tenant.id,
            customer_id: input.customer_id,
            invoice_number: invoiceNumber,
            subtotal: input.subtotal,
            tax: input.tax,
            total: input.total,
            status: 'unpaid',
            due_date: input.due_date || null,
            notes: input.notes || null,
          })
          .select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `)
          .maybeSingle();

        if (error) throw error;
        return data as unknown as CustomerInvoice;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
        toast.success('Invoice created successfully');
      },
      onError: (error: Error) => {
        logger.error('Failed to create invoice', error, { component: 'useCustomerInvoices' });
        toast.error('Failed to create invoice', { description: error.message });
      },
    });

  const useMarkAsPaid = () =>
    useMutation({
      mutationFn: async (invoiceId: string) => {
        if (!tenant?.id) throw new Error('Tenant ID required');

        const { data, error } = await (supabase as any)
          .from('customer_invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
          .eq('tenant_id', tenant.id)
          .select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `)
          .maybeSingle();

        if (error) throw error;

        return data as unknown as CustomerInvoice;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
        toast.success('Invoice marked as paid');
      },
      onError: (error: Error) => {
        logger.error('Failed to mark invoice as paid', error, { component: 'useCustomerInvoices' });
        toast.error('Failed to mark invoice as paid');
      },
    });

  const useRecordPayment = () =>
    useMutation({
      mutationFn: async ({ invoiceId, amount, notes }: RecordPaymentInput) => {
        if (!tenant?.id) throw new Error('Tenant ID required');

        // Get current invoice
        const { data: invoice, error: fetchErr } = await (supabase as any)
          .from('customer_invoices')
          .select('*')
          .eq('id', invoiceId)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!invoice) throw new Error('Invoice not found');

        const isPaidInFull = amount >= (invoice.total || 0);

        const { data, error } = await (supabase as any)
          .from('customer_invoices')
          .update({
            status: isPaidInFull ? 'paid' : invoice.status,
            paid_at: isPaidInFull ? new Date().toISOString() : invoice.paid_at,
            notes: notes ? `${invoice.notes || ''}\n\nPayment recorded: $${amount.toFixed(2)}` : invoice.notes,
          })
          .eq('id', invoiceId)
          .eq('tenant_id', tenant.id)
          .select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `)
          .maybeSingle();

        if (error) throw error;
        return data as unknown as CustomerInvoice;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
        if (data?.status === 'paid') {
          toast.success('Payment recorded - Invoice fully paid');
        } else {
          toast.success('Payment recorded successfully');
        }
      },
      onError: (error: Error) => {
        logger.error('Failed to record payment', error, { component: 'useCustomerInvoices' });
        toast.error('Failed to record payment');
      },
    });

  const useMarkAsSent = () =>
    useMutation({
      mutationFn: async (invoiceId: string) => {
        if (!tenant?.id) throw new Error('Tenant ID required');

        const { data, error } = await (supabase as any)
          .from('customer_invoices')
          .update({ status: 'unpaid' })
          .eq('id', invoiceId)
          .eq('tenant_id', tenant.id)
          .select()
          .maybeSingle();

        if (error) throw error;
        return data as unknown as CustomerInvoice;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
        toast.success('Invoice marked as sent');
      },
      onError: (error: Error) => {
        logger.error('Failed to mark invoice as sent', error, { component: 'useCustomerInvoices' });
        toast.error('Failed to mark invoice as sent');
      },
    });

  const useVoidInvoice = () =>
    useMutation({
      mutationFn: async (invoiceId: string) => {
        if (!tenant?.id) throw new Error('Tenant ID required');

        const { data, error } = await (supabase as any)
          .from('customer_invoices')
          .update({ status: 'cancelled' })
          .eq('id', invoiceId)
          .eq('tenant_id', tenant.id)
          .select()
          .maybeSingle();

        if (error) throw error;
        return data as unknown as CustomerInvoice;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
        toast.success('Invoice voided');
      },
      onError: (error: Error) => {
        logger.error('Failed to void invoice', error, { component: 'useCustomerInvoices' });
        toast.error('Failed to void invoice');
      },
    });

  const useDeleteInvoice = () =>
    useMutation({
      mutationFn: async (invoiceId: string) => {
        if (!tenant?.id) throw new Error('Tenant ID required');

        const { error } = await (supabase as any)
          .from('customer_invoices')
          .delete()
          .eq('id', invoiceId)
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
        toast.success('Invoice deleted');
      },
      onError: (error: Error) => {
        logger.error('Failed to delete invoice', error, { component: 'useCustomerInvoices' });
        toast.error('Failed to delete invoice');
      },
    });

  return {
    useInvoicesQuery,
    useInvoiceQuery,
    useInvoiceStatsQuery,
    useCreateInvoice,
    useMarkAsPaid,
    useRecordPayment,
    useMarkAsSent,
    useVoidInvoice,
    useDeleteInvoice,
  };
}

export function useCustomersList() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.customers.list({ tenantId: tenant?.id }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone')
        .eq('tenant_id', tenant.id)
        .order('first_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });
}
