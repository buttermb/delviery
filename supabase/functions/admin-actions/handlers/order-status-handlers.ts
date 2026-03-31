/**
 * Admin action handlers for order status changes:
 * flag, unflag, decline.
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
  req: Request;
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...headers, 'Content-Type': 'application/json' } }
  );
}

export async function handleFlagOrder(ctx: HandlerContext): Promise<Response> {
  const { supabase, authCors, adminUser, tenantId, orderId, reason, req } = ctx;

  if (!orderId || !reason) {
    return jsonResponse({ error: 'Order ID and reason required' }, 400, authCors);
  }

  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({ flagged_reason: reason, flagged_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();

  if (updateError) {
    logger.error('Failed to flag order', { orderId, error: updateError.message });
    return jsonResponse({ error: 'Failed to flag order' }, 500, authCors);
  }

  await logAdminAction(supabase, adminUser.id as string, 'FLAG_ORDER', 'order', orderId, { reason }, req);
  logger.info('Order flagged', { orderId, adminId: adminUser.id });

  return jsonResponse({ success: true, order }, 200, authCors);
}

export async function handleUnflagOrder(ctx: HandlerContext): Promise<Response> {
  const { supabase, authCors, adminUser, tenantId, orderId, reason, req } = ctx;

  if (!orderId) {
    return jsonResponse({ error: 'Order ID required' }, 400, authCors);
  }

  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({ flagged_reason: null, flagged_at: null })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();

  if (updateError) {
    logger.error('Failed to unflag order', { orderId, error: updateError.message });
    return jsonResponse({ error: 'Failed to unflag order' }, 500, authCors);
  }

  await logAdminAction(supabase, adminUser.id as string, 'UNFLAG_ORDER', 'order', orderId, { reason }, req);
  logger.info('Order unflagged', { orderId, adminId: adminUser.id });

  return jsonResponse({ success: true, order }, 200, authCors);
}

export async function handleDeclineOrder(ctx: HandlerContext): Promise<Response> {
  const { supabase, authCors, adminUser, tenantId, orderId, reason, req } = ctx;

  if (!orderId || !reason) {
    return jsonResponse({ error: 'Order ID and reason required' }, 400, authCors);
  }

  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled', payment_status: 'refunded' })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();

  if (updateError) {
    logger.error('Failed to decline order', { orderId, error: updateError.message });
    return jsonResponse({ error: 'Failed to decline order' }, 500, authCors);
  }

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: 'cancelled',
    message: `Order declined by admin: ${reason}`,
  });

  await logAdminAction(supabase, adminUser.id as string, 'DECLINE_ORDER', 'order', orderId, { reason }, req);
  logger.info('Order declined', { orderId, adminId: adminUser.id });

  return jsonResponse({ success: true, order }, 200, authCors);
}
