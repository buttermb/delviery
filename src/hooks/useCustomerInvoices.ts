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

// Helper to cast Supabase client to avoid deep type instantiation
const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    insert: (data: unknown) => unknown;
    update: (data: unknown) => unknown;
    delete: () => unknown;
  };
  rpc: (fn: string, params?: unknown) => Promise<{ data: unknown; error: Error | null }>;
};

export function useCustomerInvoices() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const useInvoicesQuery = (filters?: { status?: string; search?: string }) =>
    useQuery({
      queryKey: queryKeys.customerInvoices.list(tenant?.id, filters),
      queryFn: async () => {
        if (!tenant?.id) return [];

        let query = (db.from('customer_invoices').select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `) as unknown as {
          eq: (col: string, val: string) => unknown;
          order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }>;
        }).eq('tenant_id', tenant.id);

        if (filters?.status && filters.status !== 'all') {
          query = (query as unknown as { eq: (col: string, val: string) => unknown }).eq('status', filters.status) as typeof query;
        }

        const result = await (query as unknown as { order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }> }).order('created_at', { ascending: false });
        if (result.error) throw result.error;
        return (result.data || []) as unknown as CustomerInvoice[];
      },
      enabled: !!tenant?.id,
      staleTime: 30_000,
      gcTime: 300_000,
    });

  const useInvoiceQuery = (id: string) =>
    useQuery({
      queryKey: queryKeys.customerInvoices.detail(id),
      queryFn: async () => {
        const query = db.from('customer_invoices').select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `) as unknown as {
          eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown | null; error: Error | null }> };
        };
        const result = await query.eq('id', id).maybeSingle();
        if (result.error) throw result.error;
        return result.data as unknown as CustomerInvoice | null;
      },
      enabled: !!id,
      staleTime: 30_000,
    });

  const useInvoiceStatsQuery = () =>
    useQuery({
      queryKey: queryKeys.customerInvoices.stats(tenant?.id),
      queryFn: async () => {
        if (!tenant?.id) return null;

        const query = db.from('customer_invoices').select('id, status, total, paid_at, created_at') as unknown as {
          eq: (col: string, val: string) => Promise<{ data: unknown[] | null; error: Error | null }>;
        };
        const result = await query.eq('tenant_id', tenant.id);

        if (result.error) throw result.error;

        const invoicesList = (result.data || []) as Array<{
          id: string;
          status: string;
          total: number;
          paid_at: string | null;
          created_at: string;
        }>;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalRevenue = invoicesList
          .filter((i) => i.status === 'paid')
          .reduce((sum, i) => sum + (i.total || 0), 0);

        const paidThisMonth = invoicesList
          .filter((i) => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= monthStart)
          .reduce((sum, i) => sum + (i.total || 0), 0);

        const paidThisMonthCount = invoicesList.filter(
          (i) => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= monthStart
        ).length;

        const outstandingAmount = invoicesList
          .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
          .reduce((sum, i) => sum + ((i.total || 0)), 0);

        const overdueCount = invoicesList.filter((i) => i.status === 'overdue').length;
        const unpaidCount = invoicesList.filter((i) => i.status === 'unpaid').length;
        const draftCount = invoicesList.filter((i) => i.status === 'draft').length;
        const paidCount = invoicesList.filter((i) => i.status === 'paid').length;

        return {
          totalRevenue,
          paidThisMonth,
          paidThisMonthCount,
          outstandingAmount,
          overdueCount,
          unpaidCount,
          draftCount,
          paidCount,
          totalInvoices: invoicesList.length,
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
          const genResult = await db.rpc('generate_invoice_number', { tenant_id: tenant.id });
          if (!genResult.error && typeof genResult.data === 'string' && genResult.data.trim()) {
            invoiceNumber = genResult.data;
          }
        } catch {
          // Fallback to timestamp-based number
        }

        const insertQuery = db.from('customer_invoices').insert({
          tenant_id: tenant.id,
          customer_id: input.customer_id,
          invoice_number: invoiceNumber,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          amount_paid: 0,
          amount_due: input.total,
          status: 'unpaid',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: input.due_date || null,
          notes: input.notes || null,
          line_items: input.line_items || null,
        }) as unknown as {
          select: (cols: string) => { maybeSingle: () => Promise<{ data: unknown | null; error: Error | null }> };
        };

        const result = await insertQuery.select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `).maybeSingle();

        if (result.error) throw result.error;
        return result.data as unknown as CustomerInvoice;
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

        // First update status
        const updateQuery = db.from('customer_invoices').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        }) as unknown as {
          eq: (col: string, val: string) => unknown;
        };

        const updateChain = (updateQuery.eq('id', invoiceId) as unknown as {
          eq: (col: string, val: string) => {
            select: (cols: string) => { maybeSingle: () => Promise<{ data: unknown | null; error: Error | null }> };
          };
        }).eq('tenant_id', tenant.id);

        const result = await updateChain.select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `).maybeSingle();

        if (result.error) throw result.error;

        // Update amount_paid to equal total
        const data = result.data as unknown as { total?: number } | null;
        if (data?.total) {
          const updatePaidQuery = db.from('customer_invoices').update({
            amount_paid: data.total,
            amount_due: 0,
          }) as unknown as {
            eq: (col: string, val: string) => Promise<{ error: Error | null }>;
          };
          const updatePaidResult = await updatePaidQuery.eq('id', invoiceId);
          if (updatePaidResult.error) throw updatePaidResult.error;
        }

        return result.data as unknown as CustomerInvoice;
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
        const fetchQuery = db.from('customer_invoices').select('*') as unknown as {
          eq: (col: string, val: string) => unknown;
        };
        const fetchChain = (fetchQuery.eq('id', invoiceId) as unknown as {
          eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown | null; error: Error | null }> };
        }).eq('tenant_id', tenant.id);
        const fetchResult = await fetchChain.maybeSingle();

        if (fetchResult.error) throw fetchResult.error;
        if (!fetchResult.data) throw new Error('Invoice not found');

        const invoice = fetchResult.data as unknown as {
          amount_paid?: number;
          total?: number;
          status?: string;
          paid_at?: string | null;
          notes?: string | null;
        };

        const newAmountPaid = (invoice.amount_paid || 0) + amount;
        const newAmountDue = (invoice.total || 0) - newAmountPaid;
        const isPaidInFull = newAmountDue <= 0;

        const updateQuery = db.from('customer_invoices').update({
          amount_paid: newAmountPaid,
          amount_due: Math.max(0, newAmountDue),
          status: isPaidInFull ? 'paid' : invoice.status,
          paid_at: isPaidInFull ? new Date().toISOString() : invoice.paid_at,
          notes: notes ? `${invoice.notes || ''}\n\nPayment recorded: $${amount.toFixed(2)}` : invoice.notes,
        }) as unknown as {
          eq: (col: string, val: string) => unknown;
        };

        const updateChain = (updateQuery.eq('id', invoiceId) as unknown as {
          eq: (col: string, val: string) => {
            select: (cols: string) => { maybeSingle: () => Promise<{ data: unknown | null; error: Error | null }> };
          };
        }).eq('tenant_id', tenant.id);

        const result = await updateChain.select(`
            *,
            customer:customers(id, first_name, last_name, email, phone)
          `).maybeSingle();

        if (result.error) throw result.error;
        return result.data as unknown as CustomerInvoice;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
        const invoice = data as unknown as { status?: string } | null;
        if (invoice?.status === 'paid') {
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

        const updateQuery = db.from('customer_invoices').update({ status: 'unpaid' }) as unknown as {
          eq: (col: string, val: string) => unknown;
        };

        const updateChain = (updateQuery.eq('id', invoiceId) as unknown as {
          eq: (col: string, val: string) => {
            select: () => { maybeSingle: () => Promise<{ data: unknown | null; error: Error | null }> };
          };
        }).eq('tenant_id', tenant.id);

        const result = await updateChain.select().maybeSingle();

        if (result.error) throw result.error;
        return result.data as unknown as CustomerInvoice;
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

        const updateQuery = db.from('customer_invoices').update({ status: 'cancelled' }) as unknown as {
          eq: (col: string, val: string) => unknown;
        };

        const updateChain = (updateQuery.eq('id', invoiceId) as unknown as {
          eq: (col: string, val: string) => {
            select: () => { maybeSingle: () => Promise<{ data: unknown | null; error: Error | null }> };
          };
        }).eq('tenant_id', tenant.id);

        const result = await updateChain.select().maybeSingle();

        if (result.error) throw result.error;
        return result.data as unknown as CustomerInvoice;
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

        const deleteQuery = db.from('customer_invoices').delete() as unknown as {
          eq: (col: string, val: string) => unknown;
        };

        const deleteChain = (deleteQuery.eq('id', invoiceId) as unknown as {
          eq: (col: string, val: string) => Promise<{ error: Error | null }>;
        }).eq('tenant_id', tenant.id);

        const result = await deleteChain;

        if (result.error) throw result.error;
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
