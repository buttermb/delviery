import { logger } from '@/lib/logger';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

interface CreatePOParams {
  tenant_id: string;
  supplier_id: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity_lbs: number;
    quantity_units?: number;
    price_per_lb: number;
  }>;
  delivery_date?: string;
  notes?: string;
}

export function usePurchaseOrderActions() {
  const queryClient = useQueryClient();

  const createPurchaseOrder = useMutation({
    mutationFn: async (params: CreatePOParams) => {
      const { data, error } = await supabase.functions.invoke('create-purchase-order', {
        body: params
      });

      if (error) throw error;
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      const previousPOs = queryClient.getQueryData(queryKeys.purchaseOrders.lists());
      return { previousPOs };
    },
    onError: (error: unknown, _variables: unknown, context: { previousPOs?: unknown } | undefined) => {
      if (context?.previousPOs) {
        queryClient.setQueryData(queryKeys.purchaseOrders.lists(), context.previousPOs);
      }
      const message = error instanceof Error ? error.message : 'Failed to create purchase order';
      logger.error('Failed to create purchase order', error, { component: 'usePurchaseOrderActions' });
      toast.error('Purchase order creation failed', { description: message });
    },
    onSuccess: (data) => {
      toast.success(`Purchase Order ${data.po_number} created successfully`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
    },
  });

  return {
    createPurchaseOrder,
  };
}
