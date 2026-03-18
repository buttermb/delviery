import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts';

const logger = createLogger("check-expired-trials");

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function buildExpirationEmailHtml(businessName: string, ownerName: string): string {
  const greeting = ownerName || 'there';
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Trial Expired</title></head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Trial Expired</h1>
      </div>
      <div style="padding: 32px;">
        <p style="font-size: 16px; color: #374151;">Hi ${greeting},</p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Your trial for <strong>${businessName}</strong> has expired and your account has been temporarily suspended.
        </p>
        <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #991b1b; font-size: 14px;">
            <strong>Account Suspended:</strong> All features are currently locked. Subscribe now to regain access.
          </p>
        </div>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          All your data has been saved. Subscribe today to continue using:
        </p>
        <ul style="font-size: 15px; color: #4b5563; line-height: 2;">
          <li>Your customers and orders</li>
          <li>Product catalog and inventory</li>
          <li>Analytics and reports</li>
          <li>Team member access</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://floraiq.com" style="background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
            Reactivate Now
          </a>
        </div>
        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">
            <strong>Special Offer:</strong> Subscribe within 7 days and get 20% off your first month!
          </p>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
          Questions? Our support team is here to help.
        </p>
        <p style="font-size: 14px; color: #6b7280;">
          Best regards,<br>The FloraIQ Team
        </p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendExpirationEmail(
  ownerEmail: string,
  businessName: string,
  ownerName: string,
): Promise<{ sent: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error(`No email provider configured. Would send expiration email to: ${ownerEmail}`);
    return { sent: false, error: 'Email provider not configured' };
  }

  const html = buildExpirationEmailHtml(businessName, ownerName);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "FloraIQ <noreply@resend.dev>",
      to: [ownerEmail],
      subject: `Your trial has expired - ${businessName}`,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const errorData = await resendResponse.json();
    console.error(`Resend error for ${ownerEmail}:`, errorData);
    return { sent: false, error: `Email send failed: ${JSON.stringify(errorData)}` };
  }

  console.error(`Expiration email sent to ${ownerEmail}`);
  return { sent: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    logger.info("Checking for expired trials...");

    // Find tenants with expired trials
    const { data: expiredTrials, error: selectError } = await supabaseClient
      .from('tenants')
      .select('id, business_name, owner_email, owner_name, trial_ends_at')
      .eq('subscription_status', 'trial')
      .lt('trial_ends_at', new Date().toISOString());

    if (selectError) {
      logger.error("Error fetching expired trials", { error: selectError.message });
      throw selectError;
    }

    logger.info(`Found ${expiredTrials?.length ?? 0} expired trials`);

    // Update status to 'suspended' for expired trials
    const results = [];
    for (const tenant of expiredTrials || []) {
      console.error(`Suspending tenant: ${tenant.business_name} (${tenant.id})`);

      const { error: updateError } = await supabaseClient
        .from('tenants')
        .update({ subscription_status: 'suspended' })
        .eq('id', tenant.id);

    for (const tenant of expiredTrials ?? []) {
      const hasPaymentMethod = tenant.payment_method_added === true;

      if (hasPaymentMethod) {
        // Auto-convert to active if payment method exists
        logger.info("Converting tenant to active (payment method exists)", {
          tenantId: tenant.id,
        });

        const { error: updateError } = await supabaseClient
          .from("tenants")
          .update({
            subscription_status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenant.id);

        if (updateError) {
          logger.error("Error converting tenant", {
            tenantId: tenant.id,
            error: updateError.message,
          });
          results.push({ tenant_id: tenant.id, success: false, error: updateError.message });
        } else {
          // Log conversion event
          await supabaseClient.from("subscription_events").insert({
            tenant_id: tenant.id,
            event_type: "trial_converted",
            metadata: { business_name: tenant.business_name },
          });

          results.push({
            tenant_id: tenant.id,
            business_name: tenant.business_name,
            success: true,
            action: "converted_to_active",
          });
        }
      } else {
        // Send trial expiration notification email
        const emailResult = await sendExpirationEmail(
          tenant.owner_email,
          tenant.business_name,
          tenant.owner_name ?? '',
        );

        results.push({
          tenant_id: tenant.id,
          business_name: tenant.business_name,
          success: true,
          email_sent: emailResult.sent,
          email_error: emailResult.error,
        });

        console.error(`Successfully suspended tenant ${tenant.business_name}`);
      }
    }

    const suspended = results.filter((r) => r.action === "suspended").length;
    const converted = results.filter((r) => r.action === "converted_to_active").length;
    const failed = results.filter((r) => !r.success).length;

    logger.info("Check expired trials complete", {
      processed: String(expiredTrials?.length ?? 0),
      suspended: String(suspended),
      converted: String(converted),
      failed: String(failed),
    });

    return new Response(
      JSON.stringify({
        processed: expiredTrials?.length || 0,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    logger.error("Error in check-expired-trials", { error: errorMessage });
    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
}));
