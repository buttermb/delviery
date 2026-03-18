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

    console.log("[CHECK TRIAL REMINDERS] Running daily check...");

    // Get all active trials
    const { data: trials } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("subscription_status", "trial")
      .not("trial_ends_at", "is", null);

    if (!trials || trials.length === 0) {
      console.log("[CHECK TRIAL REMINDERS] No active trials found");
      return new Response(
        JSON.stringify({ message: "No active trials" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CHECK TRIAL REMINDERS] Found ${trials.length} active trials`);

    const now = new Date();
    const remindersToSend = [];

    for (const tenant of trials) {
      const trialEnds = new Date(tenant.trial_ends_at);
      const daysRemaining = Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const hasPaymentMethod = tenant.payment_method_added === true;

      console.log(`[CHECK TRIAL REMINDERS] Tenant ${tenant.business_name}: ${daysRemaining} days remaining, payment method: ${hasPaymentMethod}`);

      // Send reminder 7 days before trial ends
      if (daysRemaining === 7 && !tenant.trial_reminder_7_days_sent) {
        remindersToSend.push({
          tenant_id: tenant.id,
          days_remaining: 7,
          has_payment_method: hasPaymentMethod
        });
      }
      // Send reminder 3 days before trial ends
      else if (daysRemaining === 3 && !tenant.trial_reminder_3_days_sent) {
        remindersToSend.push({
          tenant_id: tenant.id,
          days_remaining: 3,
          has_payment_method: hasPaymentMethod
        });
      }
      // Send reminder 1 day before trial ends
      else if (daysRemaining === 1 && !tenant.trial_reminder_1_day_sent) {
        remindersToSend.push({
          tenant_id: tenant.id,
          days_remaining: 1,
          has_payment_method: hasPaymentMethod
        });
      }
      // Send reminder on last day (day of expiration)
      else if (daysRemaining === 0 && !tenant.trial_reminder_0_day_sent) {
        remindersToSend.push({
          tenant_id: tenant.id,
          days_remaining: 0,
          has_payment_method: hasPaymentMethod
        });
      }
    }

    console.log(`[CHECK TRIAL REMINDERS] Sending ${remindersToSend.length} reminders`);

    // Send reminders
    for (const reminder of remindersToSend) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-trial-reminder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify(reminder),
        });
      } catch (error) {
        console.error(`Failed to send reminder for tenant ${reminder.tenant_id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Reminder check complete",
        reminders_sent: remindersToSend.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error checking trial reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
