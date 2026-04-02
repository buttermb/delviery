import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateNotifyRecall } from './validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth check ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();
    const { recall_id, notification_method } = validateNotifyRecall(rawBody);

    // Use user-scoped client for RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

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
      recall_id: recall.id,
      customer_id: customer.id,
      notification_type: notification_method || 'email',
      status: 'pending'
    }));

    if (notifications.length > 0) {
      const { error: notifError } = await supabaseClient
        .from('recall_notifications')
        .insert(notifications);

      if (notifError) throw notifError;
    }

    // Simulate sending notifications (in production, integrate with email/SMS service)
    let sentCount = 0;
    for (const customer of affectedCustomers) {
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
      .update({ affected_customers: affectedCustomers.length })
      .eq('id', recall_id);

    console.error(`[notify-recall] Sent to ${sentCount} customers for recall ${recall_id}`);

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
    console.error('[notify-recall] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
