import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error('Order ID is required');
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('menu_orders')
      .select(`
        *,
        disposable_menus (
          id,
          title,
          business_name
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    const menu = order.disposable_menus;
    const orderData = order.order_data as any;
    const items = orderData?.items || [];

    // Get business name with fallback hierarchy
    const businessName = menu.business_name || menu.title || 'Our Business';

    // Prepare customer notification
    const customerMessage = `
Order Confirmation

Thank you for your order from ${businessName}!

Order Details:
${items.map((item: any) => `- ${item.product_name} x${item.quantity} - $${item.total_price.toFixed(2)}`).join('\n')}

Total: $${order.total_amount.toFixed(2)}

Delivery Address:
${order.delivery_address || 'Pickup'}

${order.customer_notes ? `Notes: ${order.customer_notes}` : ''}

We'll contact you shortly at ${order.contact_phone} to confirm your order.

Status: ${order.status}
    `.trim();

    // Prepare admin notification
    const adminMessage = `
New Order Received!

Business: ${businessName}
Menu: ${menu.title}
Customer: ${orderData.contact_name || 'Unknown'}
Phone: ${order.contact_phone}
Email: ${orderData.contact_email || 'N/A'}

Order Items:
${items.map((item: any) => `- ${item.product_name} x${item.quantity} - $${item.total_price.toFixed(2)}`).join('\n')}

Total: $${order.total_amount.toFixed(2)}

Delivery Address:
${order.delivery_address || 'Pickup'}

${order.customer_notes ? `Customer Notes: ${order.customer_notes}` : ''}

Please review and process this order.
    `.trim();

    console.log('Customer notification:', {
      to: orderData.contact_email,
      phone: order.contact_phone,
      message: customerMessage,
    });

    console.log('Admin notification:', {
      message: adminMessage,
    });

    // Log notifications
    await supabase.from('account_logs').insert([
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
    await supabase.from('menu_security_events').insert({
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
  } catch (error: any) {
    console.error('Error sending order notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
