import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/rateLimiting.ts';
import { validateEmail, validatePhoneNumber, validateUUID } from '../_shared/validation.ts';

const RequestSchema = z.object({
  entryId: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().min(1),
});

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
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: entryId, email, phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { entryId, email, phone } = parsed.data;

    if (!validateUUID(entryId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid entryId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validatePhoneNumber(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Generate OTPs
    const { data: emailOTP, error: otpError1 } = await supabase.rpc('generate_otp');
    if (otpError1) {
      console.error('[SEND_OTP] Failed to generate email OTP:', otpError1);
      throw otpError1;
    }

    const { data: phoneOTP, error: otpError2 } = await supabase.rpc('generate_otp');
    if (otpError2) {
      console.error('[SEND_OTP] Failed to generate phone OTP:', otpError2);
      throw otpError2;
    }

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

    if (updateError) {
      console.error('[SEND_OTP] Failed to update entry:', updateError);
      throw updateError;
    }

    // Send email OTP (using Resend)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
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

      if (!emailResponse.ok) {
        console.error('[SEND_OTP] Resend API error:', await emailResponse.text());
      }
    }

    // Send SMS OTP (using Twilio via edge function)
    const smsResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
      },
      body: JSON.stringify({
        to: phone,
        message: `FloraIQ Giveaway verification code: ${phoneOTP}. Expires in 10 minutes.`
      })
    });

    if (!smsResponse.ok) {
      console.error('[SEND_OTP] SMS send error:', await smsResponse.text());
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification codes sent"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[SEND_OTP] Error:", error);
    return new Response(
      JSON.stringify({ error: 'Failed to send verification codes' }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
