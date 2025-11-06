import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

type DeliveryType = 'courier' | 'runner';

export function useDeliveryStatus() {
  const [updating, setUpdating] = useState(false);

  const updateCourierOrderStatus = async (orderId: string, newStatus: string) => {
    const updates: any = { status: newStatus };

    if (newStatus === 'picked_up') {
      updates.courier_picked_up_at = new Date().toISOString();
    } else if (newStatus === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) throw error;
  };

  const updateRunnerDeliveryStatus = async (deliveryId: string, newStatus: string) => {
    const { error } = await supabase.functions.invoke('wholesale-delivery-update', {
      body: {
        delivery_id: deliveryId,
        status: newStatus,
      },
    });

    if (error) throw error;
  };

  const updateStatus = async (
    id: string,
    newStatus: string,
    type: DeliveryType
  ) => {
    setUpdating(true);
    try {
      if (type === 'courier') {
        await updateCourierOrderStatus(id, newStatus);
      } else {
        await updateRunnerDeliveryStatus(id, newStatus);
      }

      const statusMessages: Record<string, string> = {
        picked_up: 'Picked Up',
        in_transit: 'In Transit',
        delivered: 'Delivered',
      };

      showSuccessToast(
        'Status Updated',
        `${type === 'courier' ? 'Order' : 'Delivery'} marked as ${statusMessages[newStatus] || newStatus}`
      );

      return true;
    } catch (error) {
      console.error('Failed to update status:', error);
      showErrorToast(
        'Update Failed',
        'Failed to update status. Please try again.'
      );
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return { updateStatus, updating };
}
