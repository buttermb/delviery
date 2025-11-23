import { serve, createClient, corsHeaders } from "../_shared/deps.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { tenant_id, days_remaining } = await req.json();

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

    // Email content based on days remaining
    let subject = "";
    let message = "";

    if (days_remaining === 2) {
      subject = "Your trial ends in 2 days";
      message = `Hi ${tenant.owner_name},\n\nYour 14-day trial of ${tenant.business_name} ends in 2 days. Your subscription will automatically activate on ${new Date(tenant.trial_ends_at).toLocaleDateString()}.\n\nNo action required - your card on file will be charged automatically.\n\nQuestions? Contact support.`;
    } else if (days_remaining === 1) {
      subject = "Your trial ends tomorrow";
      message = `Hi ${tenant.owner_name},\n\nYour trial ends tomorrow! Your subscription will activate automatically on ${new Date(tenant.trial_ends_at).toLocaleDateString()}.\n\nYour card will be charged for the ${tenant.subscription_plan} plan.\n\nNeed to cancel? Go to your billing page.`;
    } else if (days_remaining === 0) {
      subject = "Your trial ends today";
      message = `Hi ${tenant.owner_name},\n\nYour trial ends today. Your subscription will activate automatically in a few hours.\n\nYour card will be charged for the ${tenant.subscription_plan} plan.\n\nLast chance to cancel if needed!`;
    }

    // Log reminder sent
    await supabaseClient.from("trial_events").insert({
      tenant_id: tenant.id,
      event_type: "trial_reminder_sent",
      event_data: {
        days_remaining,
        subject,
        sent_to: tenant.owner_email,
      },
    });

    // Update reminder flag
    const flagColumn = `trial_reminder_${14 - days_remaining}_sent`;
    await supabaseClient
      .from("tenants")
      .update({ [flagColumn]: true })
      .eq("id", tenant_id);

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
