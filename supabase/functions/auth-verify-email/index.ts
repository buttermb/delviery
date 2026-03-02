/**
 * Auth Verify Email
 * Verifies a user's email address using a token-based verification link.
 *
 * Flow:
 * 1. Accept raw token from request body
 * 2. Hash the token (SHA-256) to match against stored token_hash
 * 3. Look up email_verification_tokens row by token_hash
 * 4. Validate: not expired, not already verified
 * 5. Update user_profiles.email_verified = true
 * 6. Mark token as verified (set verified_at)
 * 7. Log verification event to audit_logs
 * 8. Return success or appropriate error
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

/**
 * Hash a token string using SHA-256 and return hex-encoded hash
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const parseResult = verifyEmailSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: (parseResult as { success: false; error: { issues: unknown[] } }).error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token } = parseResult.data;

    // Hash the token to match against stored token_hash
    const tokenHash = await hashToken(token);

    // Look up token in email_verification_tokens
    const { data: verificationToken, error: tokenError } = await supabase
      .from('email_verification_tokens')
      .select('id, user_id, email, expires_at, verified_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (tokenError) {
      console.error('[AUTH-VERIFY-EMAIL] Database error looking up token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verificationToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (verificationToken.verified_at) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email already verified',
          already_verified: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (new Date(verificationToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Verification token has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user_profiles.email_verified to true
    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq('id', verificationToken.user_id);

    if (profileUpdateError) {
      console.error('[AUTH-VERIFY-EMAIL] Failed to update user profile:', profileUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update email verification status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark token as verified
    const verifiedAt = new Date().toISOString();
    const { error: tokenUpdateError } = await supabase
      .from('email_verification_tokens')
      .update({ verified_at: verifiedAt })
      .eq('id', verificationToken.id);

    if (tokenUpdateError) {
      console.error('[AUTH-VERIFY-EMAIL] Failed to mark token as verified:', tokenUpdateError);
      // Non-fatal: profile is already updated, log but continue
    }

    // Log verification event to audit_logs
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        actor_id: verificationToken.user_id,
        actor_type: 'system',
        action: 'email_verified',
        resource_type: 'user_profiles',
        resource_id: verificationToken.user_id,
        changes: {
          email: verificationToken.email,
          email_verified: true,
          verified_at: verifiedAt,
        },
      });

    if (auditError) {
      // Non-fatal: verification succeeded, just log the audit failure
      console.error('[AUTH-VERIFY-EMAIL] Failed to create audit log:', auditError);
    }

    console.log(`[AUTH-VERIFY-EMAIL] Email verified for user: ${verificationToken.user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email verified successfully',
        user_id: verificationToken.user_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[AUTH-VERIFY-EMAIL] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
