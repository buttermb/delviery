/**
 * Verify Phone
 * 
 * Verifies a phone number using the OTP code sent via SMS.
 * 
 * To deploy:
 * supabase functions deploy verify-phone
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Request validation
const RequestSchema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().length(6),
  tenantId: z.string().uuid().optional(),
});

const MAX_VERIFICATION_ATTEMPTS = 3;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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

    const { verificationId, code, tenantId } = parsed.data;

    // Get verification record
    const { data: verification, error: fetchError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('id', verificationId)
      .single();

    if (fetchError || !verification) {
      return new Response(
        JSON.stringify({ error: 'Verification not found or expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (verification.verified) {
      return new Response(
        JSON.stringify({ error: 'Phone number already verified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Verification code has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempt limit
    if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return new Response(
        JSON.stringify({ error: 'Too many failed attempts. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempt counter
    await supabase
      .from('phone_verifications')
      .update({ attempts: verification.attempts + 1 })
      .eq('id', verificationId);

    // Verify code
    if (verification.verification_code !== code) {
      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - (verification.attempts + 1);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid verification code',
          remainingAttempts,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified
    await supabase
      .from('phone_verifications')
      .update({ 
        verified: true, 
        verified_at: new Date().toISOString(),
        tenant_id: tenantId || null,
      })
      .eq('id', verificationId);

    // If tenant ID provided, update tenant record
    if (tenantId) {
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          phone_number: verification.phone_number,
          phone_hash: verification.phone_hash,
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (updateError) {
        console.error('[VERIFY_PHONE] Failed to update tenant:', updateError);
      }
    }

    console.log('[VERIFY_PHONE] Phone verified:', verification.phone_number.slice(0, -4) + '****');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Phone number verified successfully',
        phoneHash: verification.phone_hash,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[VERIFY_PHONE] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to verify phone number' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});







