import { logger } from '@/lib/logger';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface POItem {
  product_id: string;
  quantity_lbs: number;
  unit_cost: number;
}

interface CreatePORequest {
  supplier_id: string;
  expected_delivery_date?: string;
  notes?: string;
  items: POItem[];
}

export function usePurchaseOrders() {
  const queryClient = useQueryClient();

  const createPurchaseOrder = useMutation({
    mutationFn: async (request: CreatePORequest) => {
      logger.info('Creating purchase order via edge function', { component: 'usePurchaseOrders', items: request.items.length });
      
      const { data, error } = await supabase.functions.invoke('create-purchase-order', {
        body: request,
      });

      if (error) {
        logger.error('Edge function error', error, { component: 'usePurchaseOrders' });
        throw error;
      }

      if (data?.error) {
        logger.error('Purchase order creation failed', new Error(data.error), { component: 'usePurchaseOrders' });
        throw new Error(data.error);
      }

      logger.info('Purchase order created successfully', { component: 'usePurchaseOrders', poId: data.purchase_order?.id });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      toast.success(`Purchase order ${data.purchase_order?.po_number || 'created'} successfully`);
    },
    onError: (error: Error) => {
      logger.error('Failed to create purchase order', error, { component: 'usePurchaseOrders' });
      toast.error(error.message || 'Failed to create purchase order');
    },
  });

  const updatePurchaseOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      toast.success('Purchase order status updated');
    },
    onError: (error: Error) => {
      logger.error('Failed to update purchase order status', error, { component: 'usePurchaseOrders' });
      toast.error('Failed to update status');
    },
  });

  const deletePurchaseOrder = useMutation({
    mutationFn: async (id: string) => {
      // First, delete items
      await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id);
      
      // Then delete the PO
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      toast.success('Purchase order deleted successfully');
    },
    onError: (error: Error) => {
      logger.error('Failed to delete purchase order', error, { component: 'usePurchaseOrders' });
      toast.error('Failed to delete purchase order');
    },
  });

  return {
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    deletePurchaseOrder,
  };
}
