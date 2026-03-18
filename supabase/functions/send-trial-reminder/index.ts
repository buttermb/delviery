/**
 * Send Trial Reminder Email
 * Called by check-trial-reminders cron to notify tenants about expiring trials.
 * Sends customized emails based on days remaining and payment method status.
 *
 * Auth: Service role key (cron-only, not publicly callable)
 */

import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";

const TrialReminderSchema = z.object({
  tenant_id: z.string().uuid(),
  days_remaining: z.number().int().min(0).max(14),
  has_payment_method: z.boolean(),
});

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@floraiq.com";
const SITE_URL = Deno.env.get("SITE_URL") || "https://app.floraiq.com";

/** Map days_remaining to the tenant column flag name */
function getReminderFlagColumn(days: number): string | null {
  switch (days) {
    case 7: return "trial_reminder_7_days_sent";
    case 3: return "trial_reminder_3_days_sent";
    case 1: return "trial_reminder_1_day_sent";
    case 0: return "trial_reminder_0_day_sent";
    default: return null;
  }
}

/** Build email subject based on days remaining and payment status */
function buildSubject(daysRemaining: number, hasPaymentMethod: boolean): string {
  if (daysRemaining === 0) {
    return hasPaymentMethod
      ? "Your trial ends today"
      : "Your trial has ended — Account suspended";
  }
  const dayLabel = daysRemaining === 1 ? "tomorrow" : `in ${daysRemaining} days`;
  if (hasPaymentMethod) {
    return `Your trial ends ${dayLabel}`;
  }
  const urgency = daysRemaining <= 1 ? "FINAL WARNING" : daysRemaining <= 3 ? "URGENT" : "Action Required";
  return `${urgency}: Add payment method — Trial ends ${dayLabel}`;
}

/** Build branded HTML email for trial reminder */
function buildHtmlEmail(
  ownerName: string,
  businessName: string,
  slug: string,
  plan: string,
  trialEndsAt: string,
  daysRemaining: number,
  hasPaymentMethod: boolean,
): string {
  const billingUrl = `${SITE_URL}/${slug}/admin/billing`;
  const expiryDate = new Date(trialEndsAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const displayName = ownerName || "there";

  const urgencyColor = daysRemaining <= 1 ? "#dc2626" : daysRemaining <= 3 ? "#f59e0b" : "#22c55e";
  const headerText = hasPaymentMethod
    ? `Your trial ends ${daysRemaining === 0 ? "today" : daysRemaining === 1 ? "tomorrow" : `in ${daysRemaining} days`}`
    : daysRemaining === 0
      ? "Your trial has ended"
      : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left on your trial`;

  let bodyContent: string;

  if (hasPaymentMethod) {
    bodyContent = `
      <p>Hi ${displayName},</p>
      <p>Your 14-day trial of <strong>${businessName}</strong> ends on <strong>${expiryDate}</strong>.</p>
      <p>Your subscription will automatically activate and your card on file will be charged for the <strong>${plan}</strong> plan. No action is needed from you.</p>
      ${daysRemaining <= 1 ? '<p>Last chance to cancel or change plans before billing begins!</p>' : ""}
      <div style="text-align: center; margin: 24px 0;">
        <a href="${billingUrl}" style="display: inline-block; background: ${urgencyColor}; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Manage Subscription
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">Questions? Contact our support team for help.</p>
    `;
  } else if (daysRemaining === 0) {
    bodyContent = `
      <p>Hi ${displayName},</p>
      <p>Your trial of <strong>${businessName}</strong> has ended and your account has been <strong>suspended</strong>.</p>
      <p>You did not add a payment method during your trial period. To reactivate your account and continue using all features, add a payment method now.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${billingUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reactivate Account
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">Your data is safe and will be retained for 30 days.</p>
    `;
  } else {
    bodyContent = `
      <p>Hi ${displayName},</p>
      <p>Your trial of <strong>${businessName}</strong> ends on <strong>${expiryDate}</strong> — that's only <strong>${daysRemaining} day${daysRemaining === 1 ? "" : "s"}</strong> away.</p>
      <p>You haven't added a payment method yet. Without one, your account will be <strong>suspended</strong> when the trial ends and you'll lose access to your dashboard.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${billingUrl}" style="display: inline-block; background: ${urgencyColor}; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Add Payment Method
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">Don't lose access to your data — add a payment method today.</p>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: ${urgencyColor}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">${headerText}</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          ${bodyContent}
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            You're receiving this because you signed up for a trial at ${businessName}.
          </p>
        </div>
      </body>
    </html>
  `;
}

/** Build plain text fallback */
function buildTextEmail(
  ownerName: string,
  businessName: string,
  slug: string,
  plan: string,
  trialEndsAt: string,
  daysRemaining: number,
  hasPaymentMethod: boolean,
): string {
  const billingUrl = `${SITE_URL}/${slug}/admin/billing`;
  const expiryDate = new Date(trialEndsAt).toLocaleDateString();
  const displayName = ownerName || "there";

  if (hasPaymentMethod) {
    return [
      `Hi ${displayName},`,
      "",
      `Your 14-day trial of ${businessName} ends on ${expiryDate}.`,
      `Your subscription will automatically activate and your card on file will be charged for the ${plan} plan.`,
      "",
      `Manage your subscription: ${billingUrl}`,
    ].join("\n");
  }

  if (daysRemaining === 0) {
    return [
      `Hi ${displayName},`,
      "",
      `Your trial of ${businessName} has ended and your account has been suspended.`,
      "Add a payment method to reactivate your account.",
      "",
      `Reactivate: ${billingUrl}`,
      "",
      "Your data will be retained for 30 days.",
    ].join("\n");
  }

  return [
    `Hi ${displayName},`,
    "",
    `Your trial of ${businessName} ends on ${expiryDate} — ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left.`,
    "You haven't added a payment method yet. Without one, your account will be suspended.",
    "",
    `Add payment method: ${billingUrl}`,
  ].join("\n");
}

serve(withZenProtection(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require service role key (this function is called by check-trial-reminders cron)
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      console.error("[TRIAL-REMINDER] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey
    );

    // Validate request body
    const body = await req.json();
    const parseResult = TrialReminderSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tenant_id, days_remaining, has_payment_method } = parseResult.data;

    console.error(`[TRIAL-REMINDER] Processing tenant=${tenant_id}, days=${days_remaining}, payment=${has_payment_method}`);

    // Get tenant details
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id, business_name, owner_name, owner_email, slug, subscription_plan, trial_ends_at")
      .eq("id", tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error("[TRIAL-REMINDER] Tenant not found:", tenantError?.message);
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenant.owner_email) {
      console.error(`[TRIAL-REMINDER] No owner email for tenant ${tenant_id}`);
      return new Response(
        JSON.stringify({ error: "Tenant has no owner email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = buildSubject(days_remaining, has_payment_method);
    const htmlContent = buildHtmlEmail(
      tenant.owner_name || "",
      tenant.business_name || "FloraIQ",
      tenant.slug || "",
      tenant.subscription_plan || "starter",
      tenant.trial_ends_at || "",
      days_remaining,
      has_payment_method,
    );
    const textContent = buildTextEmail(
      tenant.owner_name || "",
      tenant.business_name || "FloraIQ",
      tenant.slug || "",
      tenant.subscription_plan || "starter",
      tenant.trial_ends_at || "",
      days_remaining,
      has_payment_method,
    );

    let emailSent = false;
    let emailId: string | null = null;
    let sendError: string | null = null;

    // Send via Resend if configured
    if (RESEND_API_KEY) {
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${tenant.business_name || "FloraIQ"} <${FROM_EMAIL}>`,
            to: [tenant.owner_email],
            subject,
            html: htmlContent,
            text: textContent,
          }),
        });

        if (resendResponse.ok) {
          const result = await resendResponse.json();
          emailSent = true;
          emailId = result.id || null;
          console.error(`[TRIAL-REMINDER] Email sent via Resend to ${tenant.owner_email}, id=${emailId}`);
        } else {
          const errorData = await resendResponse.text();
          sendError = `Resend API error: ${resendResponse.status} ${errorData}`;
          console.error(`[TRIAL-REMINDER] Resend error:`, sendError);
        }
      } catch (err: unknown) {
        sendError = err instanceof Error ? err.message : "Unknown Resend error";
        console.error("[TRIAL-REMINDER] Resend exception:", sendError);
      }
    } else {
      console.error(`[TRIAL-REMINDER] No email provider configured. Would send to: ${tenant.owner_email}`);
      console.error(`[TRIAL-REMINDER] Subject: ${subject}`);
    }

    // Log to email_logs table
    await supabaseClient.from("email_logs").insert({
      tenant_id: tenant.id,
      template: "trial_reminder",
      recipient: tenant.owner_email,
      status: emailSent ? "sent" : RESEND_API_KEY ? "failed" : "skipped",
      metadata: {
        days_remaining,
        has_payment_method,
        subject,
        email_id: emailId,
        error: sendError,
      },
      sent_at: emailSent ? new Date().toISOString() : null,
    }).then(({ error }) => {
      if (error) console.error("[TRIAL-REMINDER] Failed to log email:", error.message);
    });

    // Queue for retry if sending failed
    if (RESEND_API_KEY && !emailSent) {
      await supabaseClient.from("failed_emails").insert({
        tenant_id: tenant.id,
        template: "trial_reminder",
        recipient: tenant.owner_email,
        email_data: { subject, html: htmlContent, text: textContent, days_remaining, has_payment_method },
        error_message: sendError,
        retry_count: 0,
        next_retry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }).then(({ error }) => {
        if (error) console.error("[TRIAL-REMINDER] Failed to queue for retry:", error.message);
      });
    }

    // Log trial event
    await supabaseClient.from("trial_events").insert({
      tenant_id: tenant.id,
      event_type: "trial_reminder_sent",
      event_data: {
        days_remaining,
        has_payment_method,
        subject,
        sent_to: tenant.owner_email,
        email_sent: emailSent,
        email_id: emailId,
      },
    });

    // Update reminder flag on tenant
    const flagColumn = getReminderFlagColumn(days_remaining);
    if (flagColumn) {
      await supabaseClient
        .from("tenants")
        .update({ [flagColumn]: true })
        .eq("id", tenant_id);
    }

    console.error(`[TRIAL-REMINDER] Completed for ${tenant.owner_email}, sent=${emailSent}`);

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        email_id: emailId,
        message: emailSent ? "Reminder sent" : "Reminder logged (email provider not configured or send failed)",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[TRIAL-REMINDER] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
