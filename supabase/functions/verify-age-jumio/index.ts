import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const jumioToken = Deno.env.get("JUMIO_API_TOKEN");
    const jumioSecret = Deno.env.get("JUMIO_API_SECRET");

    if (!jumioToken || !jumioSecret) {
      return new Response(
        JSON.stringify({
          error: "Age verification service not configured. Contact support.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { returnUrl } = await req.json();

    // Create Jumio verification session
    const jumioAuth = btoa(`${jumioToken}:${jumioSecret}`);
    const jumioResponse = await fetch("https://account.amer-1.jumio.ai/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: `Basic ${jumioAuth}`,
        "Content-Type": "application/json",
        "User-Agent": "Bud-Dash NYC/1.0",
      },
      body: JSON.stringify({
        customerInternalReference: user.id,
        userReference: user.id,
        callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/jumio-callback`,
        successUrl: returnUrl,
        errorUrl: returnUrl,
        workflowDefinition: {
          key: 91, // ID verification workflow
          credentials: [
            {
              category: "ID",
              type: {
                values: ["DRIVING_LICENSE", "ID_CARD", "PASSPORT"],
              },
              country: {
                values: ["USA"],
              },
            },
          ],
        },
      }),
    });

    if (!jumioResponse.ok) {
      const errorText = await jumioResponse.text();
      console.error("Jumio API error:", errorText);
      throw new Error(`Jumio verification failed: ${jumioResponse.status}`);
    }

    const jumioData = await jumioResponse.json();

    // Store verification record
    await supabase.from("age_verifications").insert({
      user_id: user.id,
      verification_type: "registration",
      verification_method: "jumio",
      verified: false,
    });

    // Create audit log
    await supabase.from("audit_logs").insert({
      entity_type: "age_verification",
      entity_id: user.id,
      action: "INITIATED",
      user_id: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl: jumioData.redirectUrl,
        transactionReference: jumioData.transactionReference,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Age verification error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Age verification failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
