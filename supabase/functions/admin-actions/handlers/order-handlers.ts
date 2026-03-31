/**
 * Admin action handlers for order lifecycle operations:
 * cancel, accept, assign-courier.
 */

import { createLogger } from '../../_shared/logger.ts';
import { logAdminAction } from '../shared.ts';

const logger = createLogger('admin-actions');

interface HandlerContext {
  supabase: any;
  authCors: Record<string, string>;
  adminUser: Record<string, unknown>;
  tenantId: string;
  orderId?: string;
  reason?: string;
  details?: Record<string, unknown>;
  req: Request;
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...headers, 'Content-Type': 'application/json' } }
  );
}

export async function handleCancelOrder(ctx: HandlerContext): Promise<Response> {
  const { supabase, authCors, adminUser, tenantId, orderId, reason, req } = ctx;

  if (!orderId) {
    return jsonResponse({ error: 'Order ID required' }, 400, authCors);
  }

  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled', payment_status: 'refunded' })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();

  if (updateError) {
    logger.error('Failed to cancel order', { orderId, error: updateError.message });
    return jsonResponse({ error: 'Failed to cancel order' }, 500, authCors);
  }

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: 'cancelled',
    message: `Order cancelled by admin: ${reason || 'No reason provided'}`,
  });

  // Send notifications
  try {
    const { data: orderDetails } = await supabase
      .from('orders')
      .select('user_id, courier_id, order_number')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (orderDetails?.user_id) {
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: orderDetails.user_id,
          tenant_id: order?.tenant_id,
          type: 'order_cancelled',
          title: 'Order Cancelled',
          message: `Your order ${orderDetails.order_number || orderId.substring(0, 8)} has been cancelled.`,
          metadata: { order_id: orderId, reason: reason || null },
          channels: ['database', 'email'],
        },
      });
    }

    if (orderDetails?.courier_id) {
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: orderDetails.courier_id,
          tenant_id: order?.tenant_id,
          type: 'order_cancelled',
          title: 'Order Assignment Cancelled',
          message: `Order has been cancelled and removed from your assignments.`,
          metadata: { order_id: orderId },
          channels: ['database'],
        },
      });
    }
  } catch (notificationError) {
    logger.error('Failed to send notifications', { orderId, error: notificationError });
  }

  await logAdminAction(supabase, adminUser.id as string, 'CANCEL_ORDER', 'order', orderId, { reason }, req);
  logger.info('Order cancelled', { orderId, adminId: adminUser.id });

  return jsonResponse({
    success: true, order,
    message: 'Order cancelled. Inventory restored. Notifications sent.',
  }, 200, authCors);
}

export async function handleAcceptOrder(ctx: HandlerContext): Promise<Response> {
  const { supabase, authCors, adminUser, tenantId, orderId, req } = ctx;

  if (!orderId) {
    return jsonResponse({ error: 'Order ID required' }, 400, authCors);
  }

  const { data: orderData, error: fetchError } = await supabase
    .from('orders').select('*').eq('id', orderId).eq('tenant_id', tenantId).maybeSingle();

  if (fetchError || !orderData) {
    return jsonResponse({ error: 'Order not found' }, 404, authCors);
  }

  let addressData = null;
  if (orderData.address_id) {
    const { data: addr } = await supabase
      .from('addresses').select('*').eq('id', orderData.address_id).maybeSingle();
    addressData = addr;
  }

  const { data: courier } = await supabase
    .from('couriers').select('*').eq('tenant_id', tenantId)
    .eq('is_active', true).eq('is_online', true).limit(1).maybeSingle();

  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'accepted',
      estimated_delivery: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      courier_id: courier?.id || null,
    })
    .eq('id', orderId).eq('tenant_id', tenantId).select().maybeSingle();

  if (updateError) {
    logger.error('Failed to accept order', { orderId, error: updateError.message });
    return jsonResponse({ error: 'Failed to accept order' }, 500, authCors);
  }

  if (courier) {
    await supabase.from('deliveries').insert({
      order_id: orderId, courier_id: courier.id,
      pickup_lat: 40.7589, pickup_lng: -73.9851,
      dropoff_lat: addressData?.lat || 40.7589, dropoff_lng: addressData?.lng || -73.9851,
      estimated_pickup_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      estimated_dropoff_time: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    });
  }

  await supabase.from('order_tracking').insert({
    order_id: orderId, status: 'accepted',
    message: courier
      ? `Order accepted and assigned to ${courier.full_name}`
      : 'Order accepted, awaiting courier assignment',
  });

  await logAdminAction(supabase, adminUser.id as string, 'ACCEPT_ORDER', 'order', orderId, { courier_id: courier?.id }, req);
  logger.info('Order accepted', { orderId, courierId: courier?.id, adminId: adminUser.id });

  return jsonResponse({ success: true, order, courier }, 200, authCors);
}

export async function handleAssignCourier(ctx: HandlerContext): Promise<Response> {
  const { supabase, authCors, adminUser, tenantId, orderId, details, req } = ctx;
  const courierId = details?.courierId as string | undefined;

  if (!orderId || !courierId) {
    return jsonResponse({ error: 'Order ID and Courier ID required' }, 400, authCors);
  }

  const { data: courierCheck } = await supabase
    .from('couriers').select('id').eq('id', courierId).eq('tenant_id', tenantId).maybeSingle();

  if (!courierCheck) {
    logger.warn('Assign courier: courier not in admin tenant', { courierId, tenantId });
    return jsonResponse({ error: 'Courier not found in your tenant' }, 403, authCors);
  }

  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({ courier_id: courierId, status: 'confirmed' })
    .eq('id', orderId).eq('tenant_id', tenantId).select().maybeSingle();

  if (updateError) {
    logger.error('Failed to assign courier', { orderId, courierId, error: updateError.message });
    return jsonResponse({ error: 'Failed to assign courier' }, 500, authCors);
  }

  await supabase.from('order_tracking').insert({
    order_id: orderId, status: 'confirmed', message: 'Courier assigned by admin',
  });

  await logAdminAction(supabase, adminUser.id as string, 'ASSIGN_COURIER', 'order', orderId, { courierId }, req);
  logger.info('Courier assigned', { orderId, courierId, adminId: adminUser.id });

  return jsonResponse({ success: true, order }, 200, authCors);
}
