import { serve, createClient, corsHeaders } from "../_shared/deps.ts";

/**
 * SECURITY FIX: Added internal API key authentication.
 * This is a cron/internal-only function that should not be publicly callable.
 */

const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========================
    // SECURITY: Require internal API key for this cron-only function
    // ========================
    const providedKey = req.headers.get("x-internal-api-key");

    if (!INTERNAL_API_KEY) {
      console.error("[TRIAL REMINDER] INTERNAL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Function not properly configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!providedKey || providedKey !== INTERNAL_API_KEY) {
      console.warn("[TRIAL REMINDER] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ========================

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { tenant_id, days_remaining, has_payment_method } = await req.json();

    // Validate required fields
    if (!tenant_id || days_remaining === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenant_id, days_remaining" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[TRIAL REMINDER] Sending for tenant ${tenant_id}, ${days_remaining} days left`);

    // Get tenant details
    const { data: tenant } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Email content based on days remaining and payment method status
    let subject = "";
    let message = "";

    if (days_remaining === 7) {
      subject = has_payment_method
        ? "Your trial ends in 7 days"
        : "Action Required: Add payment method - Trial ends in 7 days";
      message = has_payment_method
        ? `Hi ${tenant.owner_name},\n\nYour 14-day trial of ${tenant.business_name} ends in 7 days (${new Date(tenant.trial_ends_at).toLocaleDateString()}).\n\nYour subscription will automatically activate and your card on file will be charged for the ${tenant.subscription_plan} plan.\n\nQuestions? Contact support.`
        : `Hi ${tenant.owner_name},\n\n⚠️ ACTION REQUIRED: Your trial ends in 7 days but you haven't added a payment method yet.\n\nTo continue using ${tenant.business_name} after ${new Date(tenant.trial_ends_at).toLocaleDateString()}, please add a payment method to your account.\n\nAdd payment method now: [LOGIN_URL]/${tenant.slug}/admin/billing\n\nWithout a payment method, your account will be suspended when the trial ends.`;
    } else if (days_remaining === 3) {
      subject = has_payment_method
        ? "Your trial ends in 3 days"
        : "URGENT: Add payment method - Trial ends in 3 days";
      message = has_payment_method
        ? `Hi ${tenant.owner_name},\n\nYour trial ends in 3 days! Your subscription will activate automatically on ${new Date(tenant.trial_ends_at).toLocaleDateString()}.\n\nYour card will be charged for the ${tenant.subscription_plan} plan.\n\nNeed to make changes? Visit your billing page.`
        : `Hi ${tenant.owner_name},\n\n🚨 URGENT: Your trial ends in 3 days and you still don't have a payment method on file.\n\nYour account will be SUSPENDED on ${new Date(tenant.trial_ends_at).toLocaleDateString()} if you don't add a payment method.\n\nAdd payment method now: [LOGIN_URL]/${tenant.slug}/admin/billing\n\nDon't lose access to your data!`;
    } else if (days_remaining === 1) {
      subject = has_payment_method
        ? "Your trial ends tomorrow"
        : "FINAL WARNING: Add payment method - Trial ends tomorrow";
      message = has_payment_method
        ? `Hi ${tenant.owner_name},\n\nYour trial ends tomorrow! Your subscription will activate automatically on ${new Date(tenant.trial_ends_at).toLocaleDateString()}.\n\nYour card will be charged for the ${tenant.subscription_plan} plan.\n\nLast chance to cancel if needed!`
        : `Hi ${tenant.owner_name},\n\n⛔ FINAL WARNING: Your trial ends TOMORROW and you don't have a payment method.\n\nWithout immediate action, your account will be suspended tomorrow (${new Date(tenant.trial_ends_at).toLocaleDateString()}).\n\nAdd payment method NOW: [LOGIN_URL]/${tenant.slug}/admin/billing\n\nThis is your last chance to avoid service interruption.`;
    } else if (days_remaining === 0) {
      subject = has_payment_method
        ? "Your trial ends today"
        : "Your trial has ended - Account suspended";
      message = has_payment_method
        ? `Hi ${tenant.owner_name},\n\nYour trial ends today. Your subscription will activate automatically in a few hours.\n\nYour card will be charged for the ${tenant.subscription_plan} plan.\n\nLast chance to cancel if needed!`
        : `Hi ${tenant.owner_name},\n\n❌ Your trial has ended and your account has been suspended.\n\nYou did not add a payment method during your trial period.\n\nTo reactivate your account, add a payment method: [LOGIN_URL]/${tenant.slug}/admin/billing\n\nYour data is safe and will be retained for 30 days.`;
    }

    // Log reminder sent
    await supabaseClient.from("trial_events").insert({
      tenant_id: tenant.id,
      event_type: "trial_reminder_sent",
      event_data: {
        days_remaining,
        has_payment_method,
        subject,
        sent_to: tenant.owner_email,
      },
    });

    // Update reminder flag based on days remaining
    let flagColumn = "";
    if (days_remaining === 7) flagColumn = "trial_reminder_7_days_sent";
    else if (days_remaining === 3) flagColumn = "trial_reminder_3_days_sent";
    else if (days_remaining === 1) flagColumn = "trial_reminder_1_day_sent";
    else if (days_remaining === 0) flagColumn = "trial_reminder_0_day_sent";

    if (flagColumn) {
      await supabaseClient
        .from("tenants")
        .update({ [flagColumn]: true })
        .eq("id", tenant_id);
    }

    console.log(`[TRIAL REMINDER] Sent successfully to ${tenant.owner_email}`);

    // TODO: Integrate with SendGrid/Resend when configured
    // For now, just log the email

    return new Response(
      JSON.stringify({ success: true, message: "Reminder sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending trial reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
