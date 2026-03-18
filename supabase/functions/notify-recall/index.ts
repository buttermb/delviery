import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateNotifyRecall } from './validation.ts';
import { sendEmail } from '../_shared/email.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const rawBody = await req.json();
    const { recall_id, notification_method } = validateNotifyRecall(rawBody);

    // Get recall details
    const { data: recall, error: recallError } = await supabaseClient
      .from('batch_recalls')
      .select('*')
      .eq('id', recall_id)
      .maybeSingle();

    if (recallError || !recall) {
      return new Response(
        JSON.stringify({ error: 'Recall not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get affected customers based on scope
    let affectedCustomers: Record<string, unknown>[] = [];
    
    if (recall.scope === 'all') {
      const { data: customers } = await supabaseClient
        .from('wholesale_clients')
        .select('id, name, email, phone')
        .eq('tenant_id', recall.tenant_id)
        .eq('status', 'active');
      
      affectedCustomers = customers || [];
    } else if (recall.scope === 'batch' && recall.batch_number) {
      // Find customers who purchased this batch
      const { data: orders } = await supabaseClient
        .from('wholesale_orders')
        .select('client_id, wholesale_clients(id, name, email, phone)')
        .eq('tenant_id', recall.tenant_id)
        .contains('metadata', { batch_number: recall.batch_number });
      
      affectedCustomers = orders?.map(o => o.wholesale_clients).filter(Boolean) || [];
    }

    // Create notification records
    const notifications = affectedCustomers.map(customer => ({
      tenant_id: recall.tenant_id,
      recall_id: recall.id,
      customer_id: customer.id,
      notification_method: notification_method || 'email',
      status: 'pending'
    }));

    const { error: notifError } = await supabaseClient
      .from('recall_notifications')
      .insert(notifications);

    if (notifError) throw notifError;

    // Send notifications to affected customers
    let sentCount = 0;
    for (const customer of affectedCustomers) {
      const customerEmail = customer.email as string | undefined;
      if (customerEmail && notification_method !== 'sms') {
        await sendEmail({
          to: customerEmail,
          subject: `Product Recall Notice - ${recall.product_name || 'Product'}`,
          html: `<p>Dear ${customer.name || 'Customer'},</p>
            <p>We are issuing a recall for <strong>${recall.product_name || 'a product'}</strong>${recall.batch_number ? ` (Batch: ${recall.batch_number})` : ''}.</p>
            <p><strong>Reason:</strong> ${recall.reason || 'Safety concern'}</p>
            <p>Please stop using this product and contact us for a replacement or refund.</p>`,
        });
      }

      await supabaseClient
        .from('recall_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('recall_id', recall_id)
        .eq('customer_id', customer.id);

      sentCount++;
    }

    // Update recall with affected customer count
    await supabaseClient
      .from('batch_recalls')
      .update({ 
        affected_customers: affectedCustomers.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', recall_id);

    console.error(`Recall notification sent to ${sentCount} customers`);

    return new Response(
      JSON.stringify({
        success: true,
        recall_id: recall.id,
        customers_notified: sentCount,
        message: `Recall notifications sent to ${sentCount} customers`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending recall notifications:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
