/**
 * Send Order Confirmation Email
 * Sends order receipt to customer after successful order placement
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface OrderItem {
    name: string;
    quantity: number;
    price: number;
}

interface OrderEmailRequest {
    order_id: string;
    customer_email: string;
    customer_name: string;
    order_number: string;
    items: OrderItem[];
    subtotal: number;
    delivery_fee: number;
    total: number;
    store_name: string;
    tracking_url?: string;
    loyalty_points_earned?: number;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const body: OrderEmailRequest = await req.json();
        const {
            customer_email,
            customer_name,
            order_number,
            items,
            subtotal,
            delivery_fee,
            total,
            store_name,
            tracking_url,
            loyalty_points_earned,
        } = body;

        if (!customer_email || !order_number) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build items HTML
        const itemsHtml = items.map((item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

        const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order Confirmation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h1 style="color: #10b981; margin: 0 0 8px 0;">Order Confirmed! 🎉</h1>
            <p style="color: #666; margin: 0 0 24px 0;">Thank you for your order from ${store_name}</p>
            
            <div style="background: #f8f8f8; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #333;"><strong>Order #:</strong> ${order_number}</p>
              <p style="margin: 8px 0 0 0; color: #333;"><strong>Customer:</strong> ${customer_name}</p>
            </div>

            <h3 style="color: #333; border-bottom: 2px solid #10b981; padding-bottom: 8px;">Order Details</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr style="background: #f8f8f8;">
                  <th style="padding: 12px; text-align: left;">Item</th>
                  <th style="padding: 12px; text-align: center;">Qty</th>
                  <th style="padding: 12px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="border-top: 2px solid #eee; padding-top: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #666;">Subtotal:</span>
                <span style="color: #333;">$${subtotal.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #666;">Delivery:</span>
                <span style="color: #333;">${delivery_fee > 0 ? `$${delivery_fee.toFixed(2)}` : 'FREE'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 12px; padding-top: 12px; border-top: 2px solid #10b981;">
                <span style="color: #333;">Total:</span>
                <span style="color: #10b981;">$${total.toFixed(2)}</span>
              </div>
            </div>

            ${loyalty_points_earned && loyalty_points_earned > 0 ? `
              <div style="margin-top: 24px; background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); border-radius: 12px; padding: 20px; text-align: center;">
                <div style="color: white; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🎉 Loyalty Points Earned</div>
                <div style="color: white; font-size: 32px; font-weight: bold;">+${loyalty_points_earned}</div>
                <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 8px;">Points added to your account!</div>
              </div>
            ` : ''}

            ${tracking_url ? `
              <div style="margin-top: 24px; text-align: center;">
                <a href="${tracking_url}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Track Your Order
                </a>
              </div>
            ` : ''}

            <p style="color: #999; font-size: 12px; margin-top: 32px; text-align: center;">
              If you have any questions about your order, please contact ${store_name}.
            </p>
          </div>
        </body>
      </html>
    `;

        // Send via Resend if API key is configured
        if (RESEND_API_KEY) {
            const resendResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: `${store_name} <orders@resend.dev>`,
                    to: [customer_email],
                    subject: `Order Confirmed - #${order_number}`,
                    html: emailHtml,
                }),
            });

            if (!resendResponse.ok) {
                const errorData = await resendResponse.json();
                console.error("Resend error:", errorData);
                throw new Error(`Email send failed: ${JSON.stringify(errorData)}`);
            }

            const result = await resendResponse.json();
            return new Response(
                JSON.stringify({ success: true, email_id: result.id }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // If no email provider configured, just log and return success
        console.log("No email provider configured. Would send to:", customer_email);
        return new Response(
            JSON.stringify({ success: true, message: "Email provider not configured" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Send order confirmation error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
