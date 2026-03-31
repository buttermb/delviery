import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/rateLimiting.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || 'unknown';
  const rateLimitResult = await checkRateLimit(RATE_LIMITS.SEND_OTP, clientIP);
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

    // Send email OTP (using Resend)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "FloraIQ <noreply@floraiq.com>",
          to: [email],
          subject: "Your Giveaway Verification Code",
          text: `Your verification code is: ${emailOTP}\n\nThis code expires in 10 minutes.`,
        }),
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

  } catch (error: unknown) {
    console.error("OTP sending error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});