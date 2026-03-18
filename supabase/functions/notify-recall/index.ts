import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import { validateNotifyRecall } from './validation.ts';
import { sendEmail } from '../_shared/email.ts';

interface Customer {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
}

interface SendResult {
  customer_id: string;
  email_sent: boolean;
  sms_sent: boolean;
  error?: string;
}

function buildRecallEmailHtml(recall: Record<string, unknown>, customer: Customer): string {
  const severity = String(recall.severity ?? 'medium').toUpperCase();
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Product Recall Notice — ${severity} Severity</h2>
      <p>Dear ${customer.contact_name || customer.business_name},</p>
      <p>This is an urgent notification regarding a product recall affecting your account.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Product</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${recall.product_name}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Batch Number</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${recall.batch_number}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Reason</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${recall.recall_reason}</td></tr>
      </table>
      <p><strong>Action Required:</strong> Please stop selling or distributing the affected product immediately and contact us for return instructions.</p>
      <p>If you have any questions, please reach out to your account representative.</p>
    </div>
  `.trim();
}

function buildRecallSmsBody(recall: Record<string, unknown>): string {
  return `RECALL NOTICE: ${recall.product_name} (Batch ${recall.batch_number}) has been recalled. Reason: ${recall.recall_reason}. Please stop distribution and contact us immediately.`;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
  if (!klaviyoApiKey) {
    console.error('KLAVIYO_API_KEY not configured, skipping email');
    return false;
  }

  const response = await fetch('https://a.klaviyo.com/api/campaigns/', {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${klaviyoApiKey}`,
      'Content-Type': 'application/json',
      'revision': '2024-10-15',
    },
    body: JSON.stringify({
      data: {
        type: 'campaign',
        attributes: {
          name: `Recall Notice - ${new Date().toISOString()}`,
          audiences: { included: [to] },
          messages: {
            email: {
              subject,
              from_email: 'noreply@nymdelivery.com',
              from_label: 'Product Safety',
              content: { html, plain_text: html.replace(/<[^>]*>/g, '') },
            },
          },
          send_strategy: { method: 'immediate' },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Klaviyo API error:', errorText);
    return false;
  }
  return true;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    console.error('Twilio credentials not configured, skipping SMS');
    return false;
  }

  const formattedPhone = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`;
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append('From', fromNumber);
  formData.append('To', formattedPhone);
  formData.append('Body', body);

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Twilio API error:', errorText);
    return false;
  }
  return true;
}

serve(secureHeadersMiddleware(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get affected customers based on scope
    let affectedCustomers: Customer[] = [];

    if (recall.scope === 'all') {
      const { data: customers } = await supabaseClient
        .from('wholesale_clients')
        .select('id, business_name, contact_name, email, phone')
        .eq('tenant_id', recall.tenant_id)
        .eq('status', 'active');

      affectedCustomers = (customers as Customer[]) || [];
    } else if (recall.scope === 'batch' && recall.batch_number) {
      const { data: orders } = await supabaseClient
        .from('wholesale_orders')
        .select('client_id, wholesale_clients(id, business_name, contact_name, email, phone)')
        .eq('tenant_id', recall.tenant_id)
        .contains('metadata', { batch_number: recall.batch_number });

      affectedCustomers = (orders?.map(
        (o: Record<string, unknown>) => o.wholesale_clients,
      ).filter(Boolean) as Customer[]) || [];
    }

    if (affectedCustomers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, recall_id: recall.id, customers_notified: 0, message: 'No affected customers found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Determine notification types to create
    const typesToSend: string[] = notification_method === 'both'
      ? ['email', 'sms']
      : [notification_method];

    // Create notification records for each type
    const notifications = affectedCustomers.flatMap(customer =>
      typesToSend.map(type => ({
        recall_id: recall.id,
        customer_id: customer.id,
        notification_type: type,
        status: 'pending',
      })),
    );

    const { error: notifError } = await supabaseClient
      .from('recall_notifications')
      .insert(notifications);

    if (notifError) throw notifError;

    // Send notifications and track results
    const emailSubject = `Product Recall Notice: ${recall.product_name} (Batch ${recall.batch_number})`;
    const emailHtml = buildRecallEmailHtml(recall, affectedCustomers[0]);
    const smsBody = buildRecallSmsBody(recall);
    const results: SendResult[] = [];

    for (const customer of affectedCustomers) {
      const result: SendResult = { customer_id: customer.id, email_sent: false, sms_sent: false };
      const personalizedHtml = buildRecallEmailHtml(recall, customer);

      if ((notification_method === 'email' || notification_method === 'both') && customer.email) {
        result.email_sent = await sendEmail(customer.email, emailSubject, personalizedHtml);
        await supabaseClient
          .from('recall_notifications')
          .update({
            status: result.email_sent ? 'sent' : 'failed',
            sent_at: result.email_sent ? new Date().toISOString() : null,
          })
          .eq('recall_id', recall_id)
          .eq('customer_id', customer.id)
          .eq('notification_type', 'email');
      }

      if ((notification_method === 'sms' || notification_method === 'both') && customer.phone) {
        result.sms_sent = await sendSms(customer.phone, smsBody);
        await supabaseClient
          .from('recall_notifications')
          .update({
            status: result.sms_sent ? 'sent' : 'failed',
            sent_at: result.sms_sent ? new Date().toISOString() : null,
          })
          .eq('recall_id', recall_id)
          .eq('customer_id', customer.id)
          .eq('notification_type', 'sms');
      }

      results.push(result);
    }

    const sentCount = results.filter(r => r.email_sent || r.sms_sent).length;

    // Update recall with affected customer count
    await supabaseClient
      .from('batch_recalls')
      .update({ affected_customers: affectedCustomers.length })
      .eq('id', recall_id);

    console.error(`Recall notifications: ${sentCount}/${affectedCustomers.length} customers reached`);

    return new Response(
      JSON.stringify({
        success: true,
        recall_id: recall.id,
        customers_notified: sentCount,
        total_affected: affectedCustomers.length,
        message: `Recall notifications sent to ${sentCount} customers`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error sending recall notifications:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}));
