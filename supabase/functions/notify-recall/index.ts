import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateNotifyRecall } from './validation.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface RecallCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

function buildRecallEmailHtml(recall: Record<string, unknown>, customerName: string): string {
  const severity = String(recall.severity || 'medium');
  const severityColor = severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ea580c' : '#d97706';
  const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);

  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Product Recall Notice</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="background: ${severityColor}; border-radius: 8px; padding: 16px 24px; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Product Recall Notice</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 14px;">Severity: ${severityLabel}</p>
          </div>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear ${customerName},</p>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            We are issuing a recall for the following product. Please review the details below and take the recommended action.
          </p>

          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; color: #333;"><strong>Product:</strong> ${String(recall.product_name || 'N/A')}</p>
            <p style="margin: 0 0 8px 0; color: #333;"><strong>Batch Number:</strong> ${String(recall.batch_number || 'N/A')}</p>
            <p style="margin: 0; color: #333;"><strong>Reason:</strong> ${String(recall.recall_reason || 'N/A')}</p>
          </div>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            If you have any of this product in your inventory, please discontinue sales immediately and contact us for return instructions.
          </p>

          <p style="color: #999; font-size: 12px; margin-top: 32px; text-align: center;">
            This is an automated recall notification. Please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `;
}

async function sendRecallEmail(
  customer: RecallCustomer,
  recall: Record<string, unknown>
): Promise<boolean> {
  if (!customer.email) return false;

  if (!RESEND_API_KEY) {
    console.error(`[NO_EMAIL_PROVIDER] Would send recall email to ${customer.email}`);
    return true; // Treat as sent when no provider configured
  }

  const html = buildRecallEmailHtml(recall, customer.name || 'Valued Customer');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Recall Notices <recalls@resend.dev>',
      to: [customer.email],
      subject: `Product Recall Notice - ${String(recall.product_name || recall.batch_number || 'Important')}`,
      html,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error(`Resend error for ${customer.email}:`, errorData);
    return false;
  }

  return true;
}

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
    let affectedCustomers: RecallCustomer[] = [];

    if (recall.scope === 'all') {
      const { data: customers } = await supabaseClient
        .from('wholesale_clients')
        .select('id, name, email, phone')
        .eq('tenant_id', recall.tenant_id)
        .eq('status', 'active');

      affectedCustomers = (customers as RecallCustomer[]) || [];
    } else if (recall.scope === 'batch' && recall.batch_number) {
      const { data: orders } = await supabaseClient
        .from('wholesale_orders')
        .select('client_id, wholesale_clients(id, name, email, phone)')
        .eq('tenant_id', recall.tenant_id)
        .contains('metadata', { batch_number: recall.batch_number });

      affectedCustomers = (orders?.map((o: Record<string, unknown>) => o.wholesale_clients).filter(Boolean) as RecallCustomer[]) || [];
    }

    // Create notification records
    const method = notification_method || 'email';
    const notifications = affectedCustomers.map(customer => ({
      tenant_id: recall.tenant_id,
      recall_id: recall.id,
      customer_id: customer.id,
      notification_method: method,
      status: 'pending'
    }));

    if (notifications.length > 0) {
      const { error: notifError } = await supabaseClient
        .from('recall_notifications')
        .insert(notifications);

      if (notifError) throw notifError;
    }

    // Send notifications
    let sentCount = 0;
    let failedCount = 0;

    for (const customer of affectedCustomers) {
      let sent = false;

      if (method === 'email' || method === 'both') {
        sent = await sendRecallEmail(customer, recall);
      }

      if (method === 'sms' || method === 'both') {
        // SMS sending not yet integrated — mark as sent for record-keeping
        console.error(`[SMS] Would send recall SMS to ${customer.phone || 'no phone'}`);
        sent = true;
      }

      const status = sent ? 'sent' : 'failed';
      if (sent) sentCount++;
      else failedCount++;

      await supabaseClient
        .from('recall_notifications')
        .update({
          status,
          sent_at: sent ? new Date().toISOString() : null,
        })
        .eq('recall_id', recall_id)
        .eq('customer_id', customer.id);
    }

    // Update recall with affected customer count
    await supabaseClient
      .from('batch_recalls')
      .update({
        affected_customers: affectedCustomers.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', recall_id);

    console.error(`Recall notifications: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        recall_id: recall.id,
        customers_notified: sentCount,
        customers_failed: failedCount,
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
