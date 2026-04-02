/**
 * Notify Order Placed Edge Function
 * Generates customer and admin notification messages for a new menu order.
 *
 * Credit deduction: send_email (10 credits) — no external send, so no refund needed.
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

interface CreditResult {
  success: boolean;
  new_balance: number;
  credits_cost: number;
  error_message: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve tenant
    const { data: tenantUser } = await supabaseClient
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant associated with user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Parse and validate body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderId = body.orderId as string | undefined;
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ----------------------------------------------------------------
    // Credit deduction: consume 10 credits (send_email)
    // ----------------------------------------------------------------
    let creditDeducted = false;
    let creditsCost = 0;
    let creditsRemaining = 0;

    const { data: creditData, error: creditError } = await supabaseClient.rpc(
      'consume_credits',
      {
        p_tenant_id: tenantId,
        p_action_key: 'send_email',
        p_reference_id: orderId,
        p_reference_type: 'order_notification',
        p_description: `Order placed notification for order ${orderId}`,
      }
    );

    if (creditError) {
      console.error('Credit deduction error:', creditError.message);
    } else if (creditData && creditData.length > 0) {
      const result: CreditResult = creditData[0];
      if (!result.success) {
        return new Response(
          JSON.stringify({
            error: 'Insufficient credits',
            code: 'INSUFFICIENT_CREDITS',
            creditsRequired: result.credits_cost,
            currentBalance: result.new_balance,
          }),
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      creditDeducted = true;
      creditsCost = result.credits_cost;
      creditsRemaining = result.new_balance;
    }

    // ----------------------------------------------------------------
    // Get order details (filtered by tenant_id)
    // ----------------------------------------------------------------
    const { data: order, error: orderError } = await supabaseClient
      .from('menu_orders')
      .select(`
        *,
        disposable_menus!inner (
          id,
          title,
          business_name,
          tenant_id
        ),
        synced_order:orders (
          id,
          order_number
        )
      `)
      .eq('id', orderId)
      .eq('disposable_menus.tenant_id', tenantId)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const menu = order.disposable_menus;
    const orderData = (order.order_data ?? {}) as Record<string, unknown>;
    const items = (Array.isArray(orderData?.items) ? orderData.items : []) as Array<Record<string, unknown>>;

    // Get business name with fallback hierarchy
    const businessName = menu.business_name || menu.title || 'Our Business';

    // Use synced order number if available, otherwise fallback to short ID
    const syncedOrder = (order as Record<string, unknown>).synced_order as Record<string, unknown> | undefined;
    const orderNumber = (syncedOrder?.order_number as string) || `MENU-${order.id.slice(0, 8).toUpperCase()}`;

    const totalAmount = Number(order.total_amount) || 0;

    // Prepare customer notification
    const customerMessage = `
Order Confirmation #${orderNumber}

Thank you for your order from ${businessName}!

Order Details:
${items.map((item) => `- ${item.product_name} x${item.quantity} - $${Number(item.total_price || 0).toFixed(2)}`).join('\n')}

Total: $${totalAmount.toFixed(2)}

Delivery Address:
${order.delivery_address || 'Pickup'}

${order.customer_notes ? `Notes: ${order.customer_notes}` : ''}

We'll contact you shortly at ${order.contact_phone || 'N/A'} to confirm your order.

Status: ${order.status}
    `.trim();

    // Prepare admin notification
    const adminMessage = `
New Order Received! #${orderNumber}

Business: ${businessName}
Menu: ${menu.title}
Customer: ${orderData.contact_name || 'Unknown'}
Phone: ${order.contact_phone || 'N/A'}
Email: ${orderData.contact_email || 'N/A'}

Order Items:
${items.map((item) => `- ${item.product_name} x${item.quantity} - $${Number(item.total_price || 0).toFixed(2)}`).join('\n')}

Total: $${totalAmount.toFixed(2)}

Delivery Address:
${order.delivery_address || 'Pickup'}

${order.customer_notes ? `Customer Notes: ${order.customer_notes}` : ''}

Please review and process this order.
    `.trim();

    console.error('Customer notification:', {
      to: orderData.contact_email,
      phone: order.contact_phone,
      message: customerMessage,
    });

    console.error('Admin notification:', {
      message: adminMessage,
    });

    // Create security event for new order
    await supabaseClient.from('menu_security_events').insert({
      menu_id: menu.id,
      event_type: 'new_order',
      severity: 'medium',
      description: `New order received from ${orderData.contact_name || order.contact_phone || 'unknown'}`,
      metadata: {
        order_id: orderId,
        total_amount: totalAmount,
        item_count: items.length,
      },
    });

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };
    if (creditDeducted) {
      responseHeaders['X-Credits-Consumed'] = String(creditsCost);
      responseHeaders['X-Credits-Remaining'] = String(creditsRemaining);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order notifications sent',
        preview: {
          customer: customerMessage,
          admin: adminMessage,
        },
      }),
      { headers: responseHeaders }
    );
  } catch (error: unknown) {
    console.error('Error sending order notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
