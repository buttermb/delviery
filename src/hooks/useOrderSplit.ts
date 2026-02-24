/**
 * useOrderSplit Hook
 * Handles splitting an order into multiple shipments
 * Creates new orders from the original order with allocated items
 */
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { triggerHaptic } from '@/lib/utils/mobile';
import { queryKeys } from '@/lib/queryKeys';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface ShipmentAllocation {
  shipmentIndex: number;
  items: {
    itemId: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
}

interface OrderData {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string;
  delivery_borough: string;
  delivery_notes: string | null;
  payment_method: string;
  payment_status: string | null;
  tenant_id: string | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number | null;
  tip_amount: number | null;
  total_amount: number;
}

interface UseOrderSplitOptions {
  tenantId: string | undefined;
  onSuccess?: (newOrderIds: string[]) => void;
}

interface SplitState {
  isLoading: boolean;
  error: string | null;
}

export function useOrderSplit({ tenantId, onSuccess }: UseOrderSplitOptions) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SplitState>({
    isLoading: false,
    error: null,
  });

  const splitOrder = useCallback(async (
    originalOrder: OrderData,
    allocations: ShipmentAllocation[]
  ): Promise<string[]> => {
    if (!tenantId) {
      toast.error('No tenant context available');
      throw new Error('No tenant context');
    }

    if (allocations.length < 2) {
      toast.error('Must create at least 2 shipments to split an order');
      throw new Error('Must create at least 2 shipments');
    }

    // Validate all items are allocated
    const totalAllocatedQty = allocations.reduce((acc, alloc) =>
      acc + alloc.items.reduce((sum, item) => sum + item.quantity, 0), 0
    );

    if (totalAllocatedQty === 0) {
      toast.error('No items allocated to shipments');
      throw new Error('No items allocated');
    }

    setState({ isLoading: true, error: null });

    try {
      const newOrderIds: string[] = [];
      const baseOrderNumber = originalOrder.order_number || originalOrder.id.slice(0, 8);

      // Calculate fee distribution (split evenly or proportionally)
      const totalShipments = allocations.filter(a => a.items.length > 0).length;
      const deliveryFeePerShipment = originalOrder.delivery_fee / totalShipments;
      const discountPerShipment = (originalOrder.discount_amount ?? 0) / totalShipments;
      const tipPerShipment = (originalOrder.tip_amount ?? 0) / totalShipments;

      // Create new orders for each allocation (skip empty allocations)
      for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        if (allocation.items.length === 0) continue;

        // Calculate subtotal for this shipment
        const shipmentSubtotal = allocation.items.reduce(
          (sum, item) => sum + (item.price * item.quantity),
          0
        );

        // Calculate total for this shipment
        const shipmentTotal = shipmentSubtotal + deliveryFeePerShipment - discountPerShipment + tipPerShipment;

        // Create new order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: `${baseOrderNumber}-${i + 1}`,
            customer_id: originalOrder.customer_id,
            customer_name: originalOrder.customer_name,
            customer_phone: originalOrder.customer_phone,
            delivery_address: originalOrder.delivery_address,
            delivery_borough: originalOrder.delivery_borough,
            delivery_notes: originalOrder.delivery_notes
              ? `${originalOrder.delivery_notes} [Split ${i + 1}/${totalShipments} from ${baseOrderNumber}]`
              : `[Split ${i + 1}/${totalShipments} from ${baseOrderNumber}]`,
            payment_method: originalOrder.payment_method,
            payment_status: originalOrder.payment_status,
            tenant_id: tenantId,
            subtotal: shipmentSubtotal,
            delivery_fee: deliveryFeePerShipment,
            discount_amount: discountPerShipment,
            tip_amount: tipPerShipment,
            total_amount: shipmentTotal,
            status: 'pending',
          })
          .select('id')
          .maybeSingle();

        if (orderError || !newOrder) {
          throw new Error(`Failed to create shipment ${i + 1}: ${orderError?.message}`);
        }

        newOrderIds.push(newOrder.id);

        // Create order items for this shipment
        const orderItems = allocation.items.map(item => ({
          order_id: newOrder.id,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          price: item.price,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          // Cleanup: delete the created order
          await (supabase as any).from('orders').delete().eq('id', newOrder.id);
          throw new Error(`Failed to create items for shipment ${i + 1}: ${itemsError.message}`);
        }
      }

      // Update original order status to indicate it was split
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'split',
          delivery_notes: originalOrder.delivery_notes
            ? `${originalOrder.delivery_notes} [Split into ${newOrderIds.length} shipments]`
            : `[Split into ${newOrderIds.length} shipments]`,
        })
        .eq('id', originalOrder.id)
        .eq('tenant_id', tenantId);

      if (updateError) {
        logger.warn('Failed to update original order status after split', {
          orderId: originalOrder.id,
          error: updateError.message,
        });
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });

      setState({ isLoading: false, error: null });

      toast.success(`Order split into ${newOrderIds.length} shipments`);
      triggerHaptic('light');

      onSuccess?.(newOrderIds);
      return newOrderIds;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to split order';
      setState({ isLoading: false, error: errorMessage });

      logger.error('Order split failed', error instanceof Error ? error : new Error(errorMessage), {
        component: 'useOrderSplit',
        orderId: originalOrder.id,
        tenantId,
      });

      toast.error(errorMessage);
      triggerHaptic('heavy');
      throw error;
    }
  }, [tenantId, queryClient, onSuccess]);

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null });
  }, []);

  return {
    ...state,
    splitOrder,
    reset,
  };
}
