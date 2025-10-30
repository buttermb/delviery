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

    const { entryId, emailCode, phoneCode } = await req.json();

    if (!entryId || !emailCode || !phoneCode) {
      throw new Error("Missing verification codes");
    }

    // Get entry
    const { data: entry, error: fetchError } = await supabase
      .from('giveaway_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (fetchError || !entry) {
      throw new Error("Entry not found");
    }

    // Check if already verified
    if (entry.email_verified && entry.phone_verified) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Already verified",
          entry
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date() > new Date(entry.otp_expiry)) {
      return new Response(
        JSON.stringify({ 
          error: "Verification codes expired. Please request new codes." 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Verify codes
    const emailValid = entry.email_otp === emailCode;
    const phoneValid = entry.phone_otp === phoneCode;

    if (!emailValid || !phoneValid) {
      // Log failed attempt
      await supabase.from('giveaway_failed_attempts').insert({
        email: entry.user_email,
        phone: entry.user_phone,
        ip_address: entry.ip_address,
        device_fingerprint: entry.device_fingerprint,
        error_message: "Invalid OTP codes",
        error_type: "otp_mismatch"
      });

      return new Response(
        JSON.stringify({ 
          error: "Invalid verification codes" 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Calculate bonus entries
    const bonusEntries = (entry.newsletter_entries || 0) + 
                        (entry.instagram_story_entries || 0) + 
                        (entry.instagram_post_entries || 0) +
                        (entry.referral_entries || 0);
    const totalEntries = entry.base_entries + bonusEntries;

    // Update entry as verified
    const { data: updatedEntry, error: updateError } = await supabase
      .from('giveaway_entries')
      .update({
        email_verified: true,
        phone_verified: true,
        instagram_verified: true,
        status: 'verified',
        verified_at: new Date().toISOString(),
        total_entries: totalEntries,
        email_otp: null,
        phone_otp: null,
        otp_expiry: null
      })
      .eq('id', entryId)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Successfully verified!",
        entry: updatedEntry,
        totalEntries
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("OTP verification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});