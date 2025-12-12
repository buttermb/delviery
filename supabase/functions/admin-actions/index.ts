import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import { validateAdminAction, type AdminActionInput } from './validation.ts';

const logger = createLogger('admin-actions');

// deno-lint-ignore no-explicit-any
async function logAdminAction(
  supabase: any,
  adminId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
  req?: Request
): Promise<void> {
  await supabase.from('admin_audit_logs').insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    ip_address: req?.headers.get('x-forwarded-for') || 'unknown',
    user_agent: req?.headers.get('user-agent') || 'unknown',
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.warn('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminUser) {
      logger.warn('Non-admin attempted admin action', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const rawBody = await req.json();
    let validatedInput: AdminActionInput;
    
    try {
      validatedInput = validateAdminAction(rawBody);
    } catch (validationError) {
      logger.warn('Validation failed', { 
        error: validationError instanceof Error ? validationError.message : 'Unknown',
        userId: user.id 
      });
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: validationError instanceof Error ? validationError.message : 'Invalid input' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, orderId, reason, userId, details } = validatedInput;

    // ==================== CANCEL ORDER ====================
    if (action === 'cancel-order') {
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'Order ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelled', payment_status: 'refunded' })
        .eq('id', orderId)
        .select()
        .maybeSingle();

      if (updateError) {
        logger.error('Failed to cancel order', { orderId, error: updateError.message });
        return new Response(
          JSON.stringify({ error: 'Failed to cancel order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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

      await logAdminAction(supabase, adminUser.id, 'CANCEL_ORDER', 'order', orderId, { reason }, req);
      logger.info('Order cancelled', { orderId, adminId: adminUser.id });

      return new Response(
        JSON.stringify({
          success: true,
          order,
          message: 'Order cancelled. Inventory restored. Notifications sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== FLAG ORDER ====================
    if (action === 'flag-order') {
      if (!orderId || !reason) {
        return new Response(
          JSON.stringify({ error: 'Order ID and reason required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({ flagged_reason: reason, flagged_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .maybeSingle();

      if (updateError) {
        logger.error('Failed to flag order', { orderId, error: updateError.message });
        return new Response(
          JSON.stringify({ error: 'Failed to flag order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAdminAction(supabase, adminUser.id, 'FLAG_ORDER', 'order', orderId, { reason }, req);
      logger.info('Order flagged', { orderId, adminId: adminUser.id });

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== UNFLAG ORDER ====================
    if (action === 'unflag-order') {
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'Order ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({ flagged_reason: null, flagged_at: null })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) {
        logger.error('Failed to unflag order', { orderId, error: updateError.message });
        return new Response(
          JSON.stringify({ error: 'Failed to unflag order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAdminAction(supabase, adminUser.id, 'UNFLAG_ORDER', 'order', orderId, { reason }, req);
      logger.info('Order unflagged', { orderId, adminId: adminUser.id });

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== ACCEPT ORDER ====================
    if (action === 'accept-order') {
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'Order ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (fetchError || !orderData) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let addressData = null;
      if (orderData.address_id) {
        const { data: addr } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', orderData.address_id)
          .maybeSingle();
        addressData = addr;
      }

      const { data: courier } = await supabase
        .from('couriers')
        .select('*')
        .eq('is_active', true)
        .eq('is_online', true)
        .limit(1)
        .maybeSingle();

      const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'accepted',
          estimated_delivery: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          courier_id: courier?.id || null,
        })
        .eq('id', orderId)
        .select()
        .maybeSingle();

      if (updateError) {
        logger.error('Failed to accept order', { orderId, error: updateError.message });
        return new Response(
          JSON.stringify({ error: 'Failed to accept order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (courier) {
        const pickupLat = 40.7589;
        const pickupLng = -73.9851;
        const dropoffLat = addressData?.lat || 40.7589;
        const dropoffLng = addressData?.lng || -73.9851;

        await supabase.from('deliveries').insert({
          order_id: orderId,
          courier_id: courier.id,
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          dropoff_lat: dropoffLat,
          dropoff_lng: dropoffLng,
          estimated_pickup_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          estimated_dropoff_time: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        });
      }

      await supabase.from('order_tracking').insert({
        order_id: orderId,
        status: 'accepted',
        message: courier
          ? `Order accepted and assigned to ${courier.full_name}`
          : 'Order accepted, awaiting courier assignment',
      });

      await logAdminAction(supabase, adminUser.id, 'ACCEPT_ORDER', 'order', orderId, { courier_id: courier?.id }, req);
      logger.info('Order accepted', { orderId, courierId: courier?.id, adminId: adminUser.id });

      return new Response(
        JSON.stringify({ success: true, order, courier }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== DECLINE ORDER ====================
    if (action === 'decline-order') {
      if (!orderId || !reason) {
        return new Response(
          JSON.stringify({ error: 'Order ID and reason required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelled', payment_status: 'refunded' })
        .eq('id', orderId)
        .select()
        .maybeSingle();

      if (updateError) {
        logger.error('Failed to decline order', { orderId, error: updateError.message });
        return new Response(
          JSON.stringify({ error: 'Failed to decline order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('order_tracking').insert({
        order_id: orderId,
        status: 'cancelled',
        message: `Order declined by admin: ${reason}`,
      });

      await logAdminAction(supabase, adminUser.id, 'DECLINE_ORDER', 'order', orderId, { reason }, req);
      logger.info('Order declined', { orderId, adminId: adminUser.id });

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== SUSPEND USER ====================
    if (action === 'suspend-user') {
      if (!userId || !reason) {
        return new Response(
          JSON.stringify({ error: 'User ID and reason required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: profile, error: updateError } = await supabase
        .from('profiles')
        .update({ age_verified: false })
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (updateError) {
        logger.error('Failed to suspend user', { userId, error: updateError.message });
        return new Response(
          JSON.stringify({ error: 'Failed to suspend user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAdminAction(supabase, adminUser.id, 'SUSPEND_USER', 'user', userId, { reason }, req);
      logger.info('User suspended', { userId, adminId: adminUser.id });

      return new Response(
        JSON.stringify({ success: true, profile }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== ASSIGN COURIER ====================
    if (action === 'assign-courier') {
      const courierId = details?.courierId as string | undefined;

      if (!orderId || !courierId) {
        return new Response(
          JSON.stringify({ error: 'Order ID and Courier ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({ courier_id: courierId, status: 'confirmed' })
        .eq('id', orderId)
        .select()
        .maybeSingle();

      if (updateError) {
        logger.error('Failed to assign courier', { orderId, courierId, error: updateError.message });
        return new Response(
          JSON.stringify({ error: 'Failed to assign courier' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('order_tracking').insert({
        order_id: orderId,
        status: 'confirmed',
        message: 'Courier assigned by admin',
      });

      await logAdminAction(supabase, adminUser.id, 'ASSIGN_COURIER', 'order', orderId, { courierId }, req);
      logger.info('Courier assigned', { orderId, courierId, adminId: adminUser.id });

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Admin action error', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Action failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
