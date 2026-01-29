/**
 * useCustomerInvoices Hook
 *
 * Fetches invoices for a specific customer from the customer_invoices table.
 * Used in the customer profile to display their invoice history.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface CustomerInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  status: string | null;
  subtotal: number;
  tax: number | null;
  discount: number | null;
  total: number;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  order_id: string | null;
  created_at: string | null;
}

export function useCustomerInvoices(customerId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.customers.invoices(customerId ?? ''),
    queryFn: async (): Promise<CustomerInvoice[]> => {
      if (!tenant?.id || !customerId) {
        throw new Error('Missing tenant or customer ID');
      }

      // Query customer_invoices table filtered by customer_id
      // The table uses tenant_id for multi-tenant isolation
      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: string) => {
                order: (column: string, options: { ascending: boolean }) => Promise<{
                  data: CustomerInvoice[] | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      })
        .from('customer_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch customer invoices', { error, customerId });
        throw new Error(error.message);
      }

      return data ?? [];
    },
    enabled: !!tenant?.id && !!customerId,
    staleTime: 60000,
  });
}
