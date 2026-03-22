import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';
import { validateSendPurchaseOrder } from './validation.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(
    req,
    CREDIT_ACTIONS.PURCHASE_ORDER_SEND,
    async (tenantId, serviceClient) => {
      try {
        const rawBody = await req.json();
        const { purchase_order_id, supplier_email, message } =
          validateSendPurchaseOrder(rawBody);

        // Fetch PO with supplier details using service client (already authenticated via creditGate)
        const { data: po, error: poError } = await serviceClient
          .from('purchase_orders')
          .select('*, supplier:suppliers(name, email, contact_name)')
          .eq('id', purchase_order_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (poError) throw poError;

        if (!po) {
          return new Response(
            JSON.stringify({ error: 'Purchase order not found' }),
            {
              status: 404,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            },
          );
        }

        // Determine recipient email: explicit param > supplier record
        const recipientEmail =
          supplier_email || po.supplier?.email;

        if (!recipientEmail) {
          return new Response(
            JSON.stringify({
              error: 'No supplier email available. Provide supplier_email or update supplier record.',
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            },
          );
        }

        // Fetch PO items for email content
        const { data: poItems } = await serviceClient
          .from('purchase_order_items')
          .select('product_name, quantity_lbs, quantity_units, price_per_lb, subtotal')
          .eq('purchase_order_id', purchase_order_id);

        // Get tenant info for sender branding
        const { data: tenant } = await serviceClient
          .from('tenants')
          .select('name')
          .eq('id', tenantId)
          .maybeSingle();

        const storeName = tenant?.name || 'FloraIQ';
        const supplierName = po.supplier?.contact_name || po.supplier?.name || 'Supplier';

        // Build email HTML
        const itemsHtml = (poItems || [])
          .map(
            (item: Record<string, unknown>) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity_lbs} lbs</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.price_per_lb).toFixed(2)}/lb</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.subtotal).toFixed(2)}</td>
          </tr>`,
          )
          .join('');

        const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Purchase Order</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: white; border-radius: 12px; padding: 32px;">
              <h1 style="color: #333; margin: 0 0 8px;">Purchase Order ${po.po_number || ''}</h1>
              <p style="color: #666;">From ${storeName}</p>

              <div style="background: #f8f8f8; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0;"><strong>PO #:</strong> ${po.po_number || 'N/A'}</p>
                <p style="margin: 8px 0 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                ${po.expected_delivery_date ? `<p style="margin: 8px 0 0;"><strong>Expected Delivery:</strong> ${po.expected_delivery_date}</p>` : ''}
              </div>

              <p>Dear ${supplierName},</p>
              ${message ? `<p>${message}</p>` : '<p>Please find the purchase order details below.</p>'}

              <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <thead>
                  <tr style="background: #f8f8f8;">
                    <th style="padding: 8px; text-align: left;">Product</th>
                    <th style="padding: 8px; text-align: right;">Quantity</th>
                    <th style="padding: 8px; text-align: right;">Price</th>
                    <th style="padding: 8px; text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>

              <div style="border-top: 2px solid #333; padding-top: 12px; text-align: right;">
                <strong>Total: $${Number(po.total_amount).toFixed(2)}</strong>
              </div>

              ${po.notes ? `<div style="margin-top: 24px; padding: 16px; background: #fffbeb; border-radius: 8px;"><strong>Notes:</strong> ${po.notes}</div>` : ''}
            </div>
          </body>
        </html>`;

        // Send via Resend if configured
        if (RESEND_API_KEY) {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `${storeName} <orders@resend.dev>`,
              to: [recipientEmail],
              subject: `Purchase Order ${po.po_number || ''} from ${storeName}`,
              html: emailHtml,
            }),
          });

          if (!resendResponse.ok) {
            const errorData = await resendResponse.json();
            console.error('Resend error:', errorData);
            throw new Error(`Email send failed: ${JSON.stringify(errorData)}`);
          }

          const emailResult = await resendResponse.json();

          // Update PO status to sent
          await serviceClient
            .from('purchase_orders')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', purchase_order_id)
            .eq('tenant_id', tenantId);

          return new Response(
            JSON.stringify({
              success: true,
              email_id: emailResult.id,
              sent_to: recipientEmail,
              po_number: po.po_number,
            }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            },
          );
        }

        // No email provider: update status and return success
        console.error('No email provider configured. Would send PO to:', recipientEmail);

        await serviceClient
          .from('purchase_orders')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', purchase_order_id)
          .eq('tenant_id', tenantId);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email provider not configured, PO marked as sent',
            sent_to: recipientEmail,
            po_number: po.po_number,
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          },
        );
      } catch (error) {
        console.error('Send purchase order error:', error);
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          },
        );
      }
    },
    {
      referenceType: 'purchase_order',
      description: 'Send purchase order to supplier',
    },
  );
});
