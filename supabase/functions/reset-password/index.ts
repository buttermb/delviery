/**
 * Reset Password
 * Resets customer password using reset token
 */

import { serve, createClient, corsHeaders, hash } from '../_shared/deps.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(100),
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
    const { token, email, new_password, tenant_slug } = resetPasswordSchema.parse(body);

    // Find reset token
    const tokenQuery = supabase
      .from('password_reset_tokens')
      .select('*, customer_users!inner(id, tenant_id, email)')
      .eq('token', token)
      .eq('email', email.toLowerCase())
      .is('used_at', null);

    const { data: resetToken, error: tokenError } = await tokenQuery.maybeSingle();

    if (tokenError || !resetToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired reset token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(resetToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Reset token has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify tenant if provided
    if (tenant_slug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, slug')
        .eq('slug', tenant_slug.toLowerCase())
        .single();

      if (!tenant || tenant.id !== resetToken.tenant_id) {
        return new Response(
          JSON.stringify({ error: 'Invalid tenant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Hash new password
    const passwordHash = await hash(new_password);

    // Update password
    const { error: updateError } = await supabase
      .from('customer_users')
      .update({ password_hash: passwordHash })
      .eq('id', resetToken.customer_user_id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to reset password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id);

    // Invalidate all existing sessions for this user (security best practice)
    await supabase
      .from('customer_sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('customer_user_id', resetToken.customer_user_id)
      .gt('expires_at', new Date().toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully. Please log in with your new password.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Reset password error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to reset password',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

