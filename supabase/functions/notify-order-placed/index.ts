import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error('Order ID is required');
    }

    // Get order details (filtered by tenant_id)
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
      .eq('disposable_menus.tenant_id', tenantUser.tenant_id)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const menu = order.disposable_menus;
    const orderData = order.order_data as Record<string, unknown>;
    const items = orderData?.items || [];

    // Get business name with fallback hierarchy
    const businessName = menu.business_name || menu.title || 'Our Business';

    // Use synced order number if available, otherwise fallback to short ID
    const syncedOrder = (order as Record<string, unknown>).synced_order as Record<string, unknown> | undefined;
    const orderNumber = syncedOrder?.order_number || `MENU-${order.id.slice(0, 8).toUpperCase()}`;

    // Prepare customer notification
    const customerMessage = `
Order Confirmation #${orderNumber}

Thank you for your order from ${businessName}!

Order Details:
${items.map((item: Record<string, unknown>) => `- ${item.product_name} x${item.quantity} - $${Number(item.total_price).toFixed(2)}`).join('\n')}

Total: $${order.total_amount.toFixed(2)}

Delivery Address:
${order.delivery_address || 'Pickup'}

${order.customer_notes ? `Notes: ${order.customer_notes}` : ''}

We'll contact you shortly at ${order.contact_phone} to confirm your order.

Status: ${order.status}
    `.trim();

    // Prepare admin notification
    const adminMessage = `
New Order Received! #${orderNumber}

Business: ${businessName}
Menu: ${menu.title}
Customer: ${orderData.contact_name || 'Unknown'}
Phone: ${order.contact_phone}
Email: ${orderData.contact_email || 'N/A'}

Order Items:
${items.map((item: Record<string, unknown>) => `- ${item.product_name} x${item.quantity} - $${Number(item.total_price).toFixed(2)}`).join('\n')}

Total: $${order.total_amount.toFixed(2)}

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

    // Log notifications
    await supabaseClient.from('account_logs').insert([
      {
        menu_id: menu.id,
        action: 'order_notification_sent',
        details: {
          order_id: orderId,
          recipient: 'customer',
          contact_phone: order.contact_phone,
          contact_email: orderData.contact_email,
        },
      },
      {
        menu_id: menu.id,
        action: 'order_notification_sent',
        details: {
          order_id: orderId,
          recipient: 'admin',
        },
      },
    ]);

    // Create security event for new order
    await supabaseClient.from('menu_security_events').insert({
      menu_id: menu.id,
      event_type: 'new_order',
      severity: 'medium',
      description: `New order received from ${orderData.contact_name || order.contact_phone}`,
      metadata: {
        order_id: orderId,
        total_amount: order.total_amount,
        item_count: items.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order notifications sent',
        preview: {
          customer: customerMessage,
          admin: adminMessage,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
