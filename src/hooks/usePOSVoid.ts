import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoidTransactionParams {
  transactionId: string;
  reason: string;
  restoreInventory?: boolean;
}

interface VoidResult {
  success: boolean;
  void_id?: string;
  amount_restored?: number;
  error?: string;
}

export function usePOSVoid() {
  const queryClient = useQueryClient();

  const voidTransaction = useMutation({
    mutationFn: async ({ transactionId, reason, restoreInventory = true }: VoidTransactionParams): Promise<VoidResult> => {
      const { data, error } = await supabase.rpc('void_pos_transaction', {
        p_transaction_id: transactionId,
        p_reason: reason,
        p_restore_inventory: restoreInventory
      });

      if (error) throw error;
      return data as unknown as VoidResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Transaction voided successfully', {
          description: data.amount_restored 
            ? `$${data.amount_restored.toFixed(2)} restored to inventory`
            : undefined
        });
        queryClient.invalidateQueries({ queryKey: ['pos-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['pos-shifts'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else {
        toast.error('Failed to void transaction', {
          description: data.error
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to void transaction', {
        description: error.message
      });
    }
  });

  return {
    voidTransaction: voidTransaction.mutate,
    voidTransactionAsync: voidTransaction.mutateAsync,
    isVoiding: voidTransaction.isPending
  };
}
