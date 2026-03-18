import { logger } from '@/lib/logger';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import { humanizeError } from '@/lib/humanizeError';

interface ReceiveItemRequest {
  item_id: string;
  quantity_received: number;
}

interface ReceivePORequest {
  purchase_order_id: string;
  items: ReceiveItemRequest[];
  received_date?: string;
  notes?: string;
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();

  const receivePurchaseOrder = useMutation({
    mutationFn: async (request: ReceivePORequest) => {
      logger.info('Receiving purchase order via edge function', { 
        component: 'useReceivePurchaseOrder', 
        poId: request.purchase_order_id,
        itemCount: request.items.length 
      });
      
      const { data, error } = await supabase.functions.invoke('receive-purchase-order', {
        body: request,
      });

      if (error) {
        logger.error('Edge function error', error, { component: 'useReceivePurchaseOrder' });
        throw error;
      }

      if (data?.error) {
        logger.error('Purchase order receiving failed', new Error(data.error), { component: 'useReceivePurchaseOrder' });
        throw new Error(data.error);
      }

      logger.info('Purchase order received successfully', { 
        component: 'useReceivePurchaseOrder', 
        poId: data.purchase_order?.id 
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(data.purchase_order?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      toast.success('Purchase order received and inventory updated');
    },
    onError: (error: Error) => {
      logger.error('Failed to receive purchase order', error, { component: 'useReceivePurchaseOrder' });
      toast.error(humanizeError(error, 'Failed to receive purchase order'));
    },
  });

  return {
    receivePurchaseOrder,
  };
}
