import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { format } from 'date-fns';

export interface CreditNote {
  id: string;
  tenant_id: string;
  invoice_id: string;
  client_id: string;
  credit_note_number: string;
  amount: number;
  reason: string;
  notes: string;
  status: 'draft' | 'issued' | 'applied';
  issued_date: string;
  created_at: string;
  updated_at: string;
}

interface CreateCreditNoteInput {
  invoice_id: string;
  client_id: string;
  amount: number;
  reason: string;
  notes?: string;
  issued_date?: string;
}

/**
 * Fetch credit notes for a specific invoice
 */
export function useCreditNotesByInvoice(invoiceId: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.crm.creditNotes.byInvoice(invoiceId),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('invoice_credit_notes' as 'crm_invoices')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as CreditNote[];
    },
    enabled: !!invoiceId && !!tenant?.id,
    staleTime: 30_000,
    gcTime: 300_000,
  });
}

/**
 * Create a new credit note for an invoice
 */
export function useCreateCreditNote() {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async (input: CreateCreditNoteInput) => {
      if (!tenant?.id) throw new Error('Tenant required');

      // Generate credit note number: CN-{invoiceId_short}-{date}
      const dateStr = format(new Date(), 'yyyyMMdd');
      const shortId = input.invoice_id.slice(0, 8);
      const creditNoteNumber = `CN-${shortId}-${dateStr}-${Date.now().toString(36)}`;

      const { data, error } = await supabase
        .from('invoice_credit_notes' as 'crm_invoices')
        .insert({
          tenant_id: tenant.id,
          invoice_id: input.invoice_id,
          client_id: input.client_id,
          credit_note_number: creditNoteNumber,
          amount: input.amount,
          reason: input.reason,
          notes: input.notes ?? '',
          status: 'issued',
          issued_date: input.issued_date ?? new Date().toISOString(),
        } as Record<string, unknown>)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data as unknown as CreditNote;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.creditNotes.byInvoice(variables.invoice_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.detail(variables.invoice_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.lists() });
    },
    onError: (error: Error) => {
      logger.error('Failed to create credit note', { error });
      toast.error('Failed to create credit note', { description: humanizeError(error) });
    },
  });
}
