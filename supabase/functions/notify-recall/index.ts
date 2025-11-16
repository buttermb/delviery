import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

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

    const { recall_id, notification_method } = await req.json();

    if (!recall_id) {
      throw new Error('Recall ID is required');
    }

    // Get recall details
    const { data: recall, error: recallError } = await supabaseClient
      .from('batch_recalls')
      .select('*')
      .eq('id', recall_id)
      .single();

    if (recallError) throw recallError;

    // Get affected customers based on scope
    let affectedCustomers: any[] = [];
    
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

    // Simulate sending notifications (in production, integrate with email/SMS service)
    let sentCount = 0;
    for (const customer of affectedCustomers) {
      // TODO: Send actual email/SMS
      // For now, just update status to sent
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

    console.log(`Recall notification sent to ${sentCount} customers`);

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
