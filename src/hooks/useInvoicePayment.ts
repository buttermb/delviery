import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecordPaymentParams {
  invoiceId: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
}

interface PaymentResult {
  success: boolean;
  amount_paid?: number;
  overpayment?: number;
  new_status?: string;
  error?: string;
}

export function useInvoicePayment() {
  const queryClient = useQueryClient();

  const recordPayment = useMutation({
    mutationFn: async ({ 
      invoiceId, 
      amount, 
      paymentMethod = 'cash',
      reference 
    }: RecordPaymentParams): Promise<PaymentResult> => {
      const { data, error } = await supabase.rpc('record_invoice_payment', {
        p_invoice_id: invoiceId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_reference: reference || null
      });

      if (error) throw error;
      return data as unknown as PaymentResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        const messages: string[] = [];
        
        if (data.new_status === 'paid') {
          messages.push('Invoice marked as paid');
        } else if (data.new_status === 'partial') {
          messages.push(`Partial payment recorded. Total paid: $${data.amount_paid?.toFixed(2)}`);
        }
        
        if (data.overpayment && data.overpayment > 0) {
          messages.push(`Overpayment of $${data.overpayment.toFixed(2)} recorded as credit`);
        }

        toast.success('Payment recorded', {
          description: messages.join('. ')
        });

        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['crm-clients'] });
      } else {
        toast.error('Failed to record payment', {
          description: data.error
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to record payment', {
        description: error.message
      });
    }
  });

  return {
    recordPayment: recordPayment.mutate,
    recordPaymentAsync: recordPayment.mutateAsync,
    isRecording: recordPayment.isPending
  };
}
