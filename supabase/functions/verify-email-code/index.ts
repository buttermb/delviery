/**
 * Verify Email Code
 * Verifies customer email using verification code
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const verifyEmailSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
  email: z.string().email(),
  tenant_slug: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { code, email, tenant_slug } = verifyEmailSchema.parse(body);

    // Find tenant if slug provided
    let tenantId: string | null = null;
    if (tenant_slug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenant_slug.toLowerCase())
        .single();
      tenantId = tenant?.id || null;
    }

    // Find customer user
    const customerQuery = supabase
      .from('customer_users')
      .select('id, tenant_id, email_verified')
      .eq('email', email.toLowerCase());

    if (tenantId) {
      customerQuery.eq('tenant_id', tenantId);
    }

    const { data: customerUser, error: customerError } = await customerQuery.maybeSingle();

    if (customerError || !customerUser) {
      return new Response(
        JSON.stringify({ error: 'Customer account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (customerUser.email_verified) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email already verified',
          already_verified: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find verification code
    const { data: verificationCode, error: codeError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('customer_user_id', customerUser.id)
      .eq('code', code)
      .eq('email', email.toLowerCase())
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (codeError || !verificationCode) {
      return new Response(
        JSON.stringify({ error: 'Invalid verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(verificationCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Verification code has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempts
    if (verificationCode.attempts >= verificationCode.max_attempts) {
      return new Response(
        JSON.stringify({ error: 'Too many verification attempts. Please request a new code.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify email
    const { error: updateError } = await supabase
      .from('customer_users')
      .update({
        email_verified: true,
        email_verified_at: new Date().toISOString(),
      })
      .eq('id', customerUser.id);

    if (updateError) {
      console.error('Failed to update email verified status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark verification code as used
    await supabase
      .from('email_verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verificationCode.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email verified successfully',
        customer_user_id: customerUser.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Verify email error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to verify email',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

