import { logger } from '@/lib/logger';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

interface ProcessReturnParams {
  tenant_id: string;
  customer_id: string;
  order_id?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity_lbs: number;
    quantity_units?: number;
    price_per_lb: number;
    subtotal: number;
    reason?: string;
    condition?: 'unopened' | 'opened' | 'damaged' | 'defective' | 'expired';
    disposition?: 'restock' | 'dispose' | 'return_to_supplier' | 'quarantine';
  }>;
  reason: string;
  notes?: string;
}

export function useReturnActions() {
  const queryClient = useQueryClient();

  const processReturn = useMutation({
    mutationFn: async (params: ProcessReturnParams) => {
      const { data, error } = await supabase.functions.invoke('process-return', {
        body: params
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.returns.lists() });
      toast.success(`Return ${data.ra_number} processed successfully. Refund: $${data.refund_amount}`);
    },
    onError: (error: any) => {
      logger.error('Failed to process return', error, { component: 'useReturnActions' });
      toast.error(error.message || 'Failed to process return');
    },
  });

  return {
    processReturn,
  };
}
