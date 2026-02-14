import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { entryId, email, phone } = await req.json();

    if (!entryId || !email || !phone) {
      throw new Error("Missing required fields");
    }

    // Generate OTPs
    const { data: otpData } = await supabase.rpc('generate_otp');
    const emailOTP = otpData;
    
    const { data: otpData2 } = await supabase.rpc('generate_otp');
    const phoneOTP = otpData2;

    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update entry with OTPs
    const { error: updateError } = await supabase
      .from('giveaway_entries')
      .update({
        email_otp: emailOTP,
        phone_otp: phoneOTP,
        otp_expiry: otpExpiry.toISOString()
      })
      .eq('id', entryId);

    if (updateError) throw updateError;

    // Send email OTP (using Klaviyo)
    const klaviyoKey = Deno.env.get("KLAVIYO_API_KEY");
    if (klaviyoKey) {
      await fetch("https://a.klaviyo.com/api/events/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Klaviyo-API-Key ${klaviyoKey}`,
          "revision": "2024-07-15"
        },
        body: JSON.stringify({
          data: {
            type: "event",
            attributes: {
              profile: { email },
              metric: { name: "Giveaway OTP" },
              properties: {
                otp: emailOTP,
                expiry_minutes: 10
              }
            }
          }
        })
      });
    }

    // Send SMS OTP (using Twilio via edge function)
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
      },
      body: JSON.stringify({
        to: phone,
        message: `BudDash Giveaway verification code: ${phoneOTP}. Expires in 10 minutes.`
      })
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Verification codes sent"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("OTP sending error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});