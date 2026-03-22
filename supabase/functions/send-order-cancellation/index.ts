/**
 * Send Order Cancellation Email
 * Sends cancellation notification to customer when an order is cancelled.
 * Fire-and-forget — failure does not block the cancellation.
 *
 * Credit deduction: send_email (10 credits) — refunded on send failure.
 */

import { serve, createClient, corsHeaders } from "../_shared/deps.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface CancellationEmailRequest {
  customer_email: string;
  customer_name: string;
  order_number: string;
  cancellation_reason: string;
  store_name: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
}

interface CreditResult {
  success: boolean;
  new_balance: number;
  credits_cost: number;
  error_message: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const body: CancellationEmailRequest = await req.json();
    const {
      customer_email,
      customer_name,
      order_number,
      cancellation_reason,
      store_name,
      items,
      total,
    } = body;

    if (!customer_email || !order_number) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ----------------------------------------------------------------
    // Credit deduction: resolve tenant from JWT, consume 10 credits
    // ----------------------------------------------------------------
    let tenantId: string | null = null;
    let creditDeducted = false;
    let creditsCost = 0;
    let creditsRemaining = 0;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const {
        data: { user },
      } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

      if (user) {
        const { data: tenantUser } = await supabase
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();

        tenantId = tenantUser?.tenant_id ?? null;
      }
    }

    if (tenantId) {
      const { data: creditData, error: creditError } = await supabase.rpc(
        "consume_credits",
        {
          p_tenant_id: tenantId,
          p_action_key: "send_email",
          p_reference_id: order_number,
          p_reference_type: "order_cancellation_email",
          p_description: `Cancellation email for order #${order_number}`,
        }
      );

      if (creditError) {
        console.error("Credit deduction error:", creditError.message);
      } else if (creditData && creditData.length > 0) {
        const result: CreditResult = creditData[0];
        if (!result.success) {
          return new Response(
            JSON.stringify({
              error: "Insufficient credits",
              code: "INSUFFICIENT_CREDITS",
              creditsRequired: result.credits_cost,
              currentBalance: result.new_balance,
            }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        creditDeducted = true;
        creditsCost = result.credits_cost;
        creditsRemaining = result.new_balance;
      }
    }

    // ----------------------------------------------------------------
    // Build email HTML
    // ----------------------------------------------------------------
    const itemsHtml = items
      .map(
        (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `
      )
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Order Cancelled</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <h1 style="color: #ef4444; margin: 0 0 8px 0;">Order Cancelled</h1>
            <p style="color: #666; margin: 0 0 24px 0;">Your order from ${store_name} has been cancelled.</p>

            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #333;"><strong>Order #:</strong> ${order_number}</p>
              <p style="margin: 8px 0 0 0; color: #333;"><strong>Reason:</strong> ${cancellation_reason}</p>
            </div>

            <h3 style="color: #333; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">Cancelled Items</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr style="background: #f8f8f8;">
                  <th style="padding: 8px 12px; text-align: left;">Item</th>
                  <th style="padding: 8px 12px; text-align: center;">Qty</th>
                  <th style="padding: 8px 12px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <div style="border-top: 2px solid #eee; padding-top: 12px;">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span style="color: #333;">Order Total:</span>
                <span style="color: #ef4444; text-decoration: line-through;">$${total.toFixed(2)}</span>
              </div>
            </div>

            <p style="color: #999; font-size: 12px; margin-top: 32px; text-align: center;">
              If you have questions, please contact ${store_name}.
            </p>
          </div>
        </body>
      </html>
    `;

    // ----------------------------------------------------------------
    // Send email via Resend
    // ----------------------------------------------------------------
    if (RESEND_API_KEY) {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${store_name} <orders@resend.dev>`,
          to: [customer_email],
          subject: `Order Cancelled - #${order_number}`,
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json();
        console.error("Resend error:", errorData);

        // Refund credits on send failure
        if (creditDeducted && tenantId) {
          await supabase.rpc("refund_credits", {
            p_tenant_id: tenantId,
            p_amount: creditsCost,
            p_action_key: "send_email",
            p_reason: `Email send failed for order #${order_number}`,
          });
          console.error("Credits refunded after email send failure");
        }

        throw new Error(`Email send failed: ${JSON.stringify(errorData)}`);
      }

      const result = await resendResponse.json();

      const responseHeaders: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": "application/json",
      };
      if (creditDeducted) {
        responseHeaders["X-Credits-Consumed"] = String(creditsCost);
        responseHeaders["X-Credits-Remaining"] = String(creditsRemaining);
      }

      return new Response(
        JSON.stringify({ success: true, email_id: result.id }),
        { status: 200, headers: responseHeaders }
      );
    }

    // No email provider configured — refund credits since no email was sent
    if (creditDeducted && tenantId) {
      await supabase.rpc("refund_credits", {
        p_tenant_id: tenantId,
        p_amount: creditsCost,
        p_action_key: "send_email",
        p_reason: "No email provider configured",
      });
      console.error("Credits refunded: no email provider configured");
    }

    console.error(
      "No email provider configured. Would send cancellation to:",
      customer_email
    );
    return new Response(
      JSON.stringify({
        success: true,
        message: "Email provider not configured",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Send order cancellation error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
