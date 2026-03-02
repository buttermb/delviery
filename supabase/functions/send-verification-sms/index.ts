/**
 * Send Verification SMS
 * 
 * Sends a one-time password (OTP) via SMS for phone verification.
 * Uses Twilio as the SMS provider.
 * 
 * To deploy:
 * supabase functions deploy send-verification-sms
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Request validation
const RequestSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  countryCode: z.string().default('+1'),
});

// OTP settings
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS_PER_PHONE = 3; // Max verification attempts per phone per hour
const MAX_SENDS_PER_IP = 5; // Max SMS sends per IP per hour

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: (parsed as { success: false; error: { issues: unknown[] } }).error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phoneNumber, countryCode } = parsed.data;
    const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
    
    // Hash the phone number for storage
    const phoneHash = await hashPhone(fullPhoneNumber);
    
    // Get client IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Rate limiting: Check sends from this IP
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count: ipSendCount } = await supabase
      .from('phone_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', clientIp)
      .gte('created_at', hourAgo);

    if ((ipSendCount || 0) >= MAX_SENDS_PER_IP) {
      return new Response(
        JSON.stringify({ error: 'Too many verification requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: Check attempts for this phone
    const { count: phoneAttempts } = await supabase
      .from('phone_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('phone_hash', phoneHash)
      .eq('verified', false)
      .gte('created_at', hourAgo);

    if ((phoneAttempts || 0) >= MAX_ATTEMPTS_PER_PHONE) {
      return new Response(
        JSON.stringify({ error: 'This phone number has been used too many times. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if phone is already verified for another tenant
    const { data: existingVerified } = await supabase
      .from('tenants')
      .select('id, business_name')
      .eq('phone_hash', phoneHash)
      .eq('phone_verified', true)
      .limit(1);

    if (existingVerified && existingVerified.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'This phone number is already associated with an account.',
          code: 'PHONE_IN_USE'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate OTP
    const otp = generateOTP(OTP_LENGTH);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Store verification record
    const { data: verification, error: insertError } = await supabase
      .from('phone_verifications')
      .insert({
        phone_number: fullPhoneNumber,
        phone_hash: phoneHash,
        verification_code: otp,
        expires_at: expiresAt,
        ip_address: clientIp,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[SEND_VERIFICATION_SMS] Insert error:', insertError);
      throw insertError;
    }

    // Send SMS via Twilio
    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      
      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: fullPhoneNumber,
          From: twilioPhoneNumber,
          Body: `Your BigMike verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`,
        }),
      });

      if (!twilioResponse.ok) {
        const twilioError = await twilioResponse.text();
        console.error('[SEND_VERIFICATION_SMS] Twilio error:', twilioError);
        
        // Delete the verification record since SMS failed
        await supabase
          .from('phone_verifications')
          .delete()
          .eq('id', verification.id);

        return new Response(
          JSON.stringify({ error: 'Failed to send SMS. Please check the phone number.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[SEND_VERIFICATION_SMS] SMS sent to:', fullPhoneNumber.slice(0, -4) + '****');
    } else {
      // Development mode - log OTP instead of sending
      console.log('[SEND_VERIFICATION_SMS] DEV MODE - OTP:', otp, 'for', fullPhoneNumber);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification code sent',
        expiresIn: OTP_EXPIRY_MINUTES * 60,
        verificationId: verification.id,
        // Only include OTP in dev mode
        ...(Deno.env.get('ENVIRONMENT') === 'development' && { devOtp: otp }),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEND_VERIFICATION_SMS] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send verification code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate random OTP
function generateOTP(length: number): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

// Hash phone number for secure storage
async function hashPhone(phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone + (Deno.env.get('PHONE_HASH_SALT') || 'bigmike-salt'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}







