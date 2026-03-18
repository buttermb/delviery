import { logger } from '@/lib/logger';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { logActivityAuto, ActivityActions } from "@/lib/activityLogger";
import { toast } from "sonner";
import { humanizeError } from '@/lib/humanizeError';

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
  const { tenant } = useTenantAdminAuth();
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

      // Log activity for audit trail
      if (tenant?.id && data.purchase_order) {
        logActivityAuto(
          tenant.id,
          ActivityActions.CREATE_PURCHASE_ORDER,
          'purchase_order',
          data.purchase_order.id,
          {
            po_number: data.purchase_order.po_number,
            vendor_id: data.purchase_order.vendor_id,
            total: data.purchase_order.total,
            items_count: data.purchase_order.items?.length ?? 0,
          }
        );
      }
    },
    onError: (error: Error) => {
      logger.error('Failed to create purchase order', error, { component: 'usePurchaseOrders' });
      toast.error(humanizeError(error, 'Failed to create purchase order'));
    },
  });

  const updatePurchaseOrderStatus = useMutation({
    mutationFn: async ({ id, status, poNumber }: { id: string; status: string; poNumber?: string }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      return { id, status, poNumber };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      toast.success('Purchase order status updated');

      // Log activity for audit trail
      if (tenant?.id) {
        logActivityAuto(
          tenant.id,
          ActivityActions.UPDATE_PURCHASE_ORDER_STATUS,
          'purchase_order',
          data.id,
          {
            po_number: data.poNumber,
            new_status: data.status,
          }
        );
      }
    },
    onError: (error: Error) => {
      logger.error('Failed to update purchase order status', error, { component: 'usePurchaseOrders' });
      toast.error('Failed to update status', { description: humanizeError(error) });
    },
  });

  const deletePurchaseOrder = useMutation({
    mutationFn: async ({ id, poNumber }: { id: string; poNumber?: string }) => {
      if (!tenant?.id) throw new Error('No tenant');
      // First, delete items scoped to tenant's PO
      await supabase
        .from('purchase_order_items').delete().eq('purchase_order_id', id);

      // Then delete the PO
      const { error } = await supabase
        .from('purchase_orders').delete().eq('id', id).eq('tenant_id', tenant.id);
      if (error) throw error;
      return { id, poNumber };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      toast.success('Purchase order deleted successfully');

      // Log activity for audit trail
      if (tenant?.id) {
        logActivityAuto(
          tenant.id,
          ActivityActions.DELETE_PURCHASE_ORDER,
          'purchase_order',
          data.id,
          {
            po_number: data.poNumber,
            deleted_at: new Date().toISOString(),
          }
        );
      }
    },
    onError: (error: Error) => {
      logger.error('Failed to delete purchase order', error, { component: 'usePurchaseOrders' });
      toast.error('Failed to delete purchase order', { description: humanizeError(error) });
    },
  });

  return {
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    deletePurchaseOrder,
  };
}
