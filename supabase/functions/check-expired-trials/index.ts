import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("check-expired-trials");

serve(withZenProtection(async (req: Request) => {
  if (req.method === "OPTIONS") {
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
      .from("tenants")
      .select("id, business_name, owner_email, trial_ends_at, payment_method_added")
      .eq("subscription_status", "trial")
      .lt("trial_ends_at", new Date().toISOString());

    if (selectError) {
      logger.error("Error fetching expired trials", { error: selectError.message });
      throw selectError;
    }

    logger.info(`Found ${expiredTrials?.length ?? 0} expired trials`);

    const results: Array<{
      tenant_id: string;
      business_name?: string;
      success: boolean;
      action?: string;
      error?: string;
    }> = [];

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
        // Suspend tenant — no payment method
        logger.info("Suspending tenant (no payment method)", {
          tenantId: tenant.id,
        });

        const { error: updateError } = await supabaseClient
          .from("tenants")
          .update({
            subscription_status: "suspended",
            suspended_reason: "Trial expired without payment method",
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenant.id);

        if (updateError) {
          logger.error("Error suspending tenant", {
            tenantId: tenant.id,
            error: updateError.message,
          });
          results.push({ tenant_id: tenant.id, success: false, error: updateError.message });
        } else {
          // Log suspension event
          await supabaseClient.from("subscription_events").insert({
            tenant_id: tenant.id,
            event_type: "trial_expired_suspended",
            metadata: { business_name: tenant.business_name },
          });

          // Trigger expiration notification
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-trial-expired-notice`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ tenant_id: tenant.id }),
            });
          } catch (notifyError) {
            logger.warn("Failed to send expiration notice", {
              tenantId: tenant.id,
              error: notifyError instanceof Error ? notifyError.message : "Unknown",
            });
          }

          results.push({
            tenant_id: tenant.id,
            business_name: tenant.business_name,
            success: true,
            action: "suspended",
          });
        }
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
        processed: expiredTrials?.length ?? 0,
        suspended,
        converted,
        failed,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}));
