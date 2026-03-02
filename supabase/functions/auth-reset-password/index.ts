/**
 * Auth Reset Password
 * Accepts token and new_password, validates token exists and is not expired/used,
 * validates password strength, updates password via supabase.auth.admin.updateUserById,
 * marks token used, revokes all other sessions, logs password_change event.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('auth-reset-password');

// Password must be 8+ chars with uppercase, lowercase, number, and special character
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])/;

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .refine(
      (val) => passwordRegex.test(val),
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

/**
 * Hash a token using SHA-256 for secure lookup
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const parseResult = resetPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      const errors = (parseResult as { success: false; error: { errors: { message: string }[] } }).error.errors.map((e) => e.message);
      logger.warn('Validation failed', { errors: errors.join(', ') });
      return new Response(
        JSON.stringify({ error: errors[0] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token, new_password } = parseResult.data;

    // Hash the token for secure lookup
    const tokenHash = await hashToken(token);

    // Look up the token - first try by token_hash, then fall back to raw token
    // This supports both hashed tokens (new) and legacy raw tokens
    let resetToken: Record<string, unknown> | null = null;

    // Try hashed token lookup first
    const { data: hashedResult, error: hashedError } = await supabase
      .from('password_reset_tokens')
      .select('id, customer_user_id, tenant_id, email, expires_at, used_at')
      .eq('token', tokenHash)
      .is('used_at', null)
      .maybeSingle();

    if (!hashedError && hashedResult) {
      resetToken = hashedResult;
    } else {
      // Fall back to raw token lookup (legacy support)
      const { data: rawResult, error: rawError } = await supabase
        .from('password_reset_tokens')
        .select('id, customer_user_id, tenant_id, email, expires_at, used_at')
        .eq('token', token)
        .is('used_at', null)
        .maybeSingle();

      if (!rawError && rawResult) {
        resetToken = rawResult;
      }
    }

    if (!resetToken) {
      logger.warn('Invalid or used reset token attempted', { ipAddress });
      return new Response(
        JSON.stringify({ error: 'Invalid or expired reset token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(resetToken.expires_at as string) < new Date()) {
      logger.warn('Expired reset token attempted', {
        tokenId: resetToken.id as string,
        ipAddress,
      });
      return new Response(
        JSON.stringify({ error: 'Reset token has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the customer user to find their auth user_id
    const { data: customerUser, error: customerError } = await supabase
      .from('customer_users')
      .select('id, user_id, email, tenant_id')
      .eq('id', resetToken.customer_user_id as string)
      .maybeSingle();

    if (customerError || !customerUser) {
      logger.error('Customer user not found for reset token', {
        tokenId: resetToken.id as string,
        customerUserId: resetToken.customer_user_id as string,
      });
      return new Response(
        JSON.stringify({ error: 'User account not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update password via Supabase Auth admin API
    if (customerUser.user_id) {
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
        customerUser.user_id,
        { password: new_password }
      );

      if (updateAuthError) {
        logger.error('Failed to update auth password', {
          userId: customerUser.user_id,
          error: updateAuthError.message,
        });
        return new Response(
          JSON.stringify({ error: 'Failed to reset password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // No auth user linked - update password_hash directly as fallback
      const { hashPassword } = await import('../_shared/password.ts');
      const passwordHash = await hashPassword(new_password);

      const { error: updateError } = await supabase
        .from('customer_users')
        .update({ password_hash: passwordHash })
        .eq('id', customerUser.id);

      if (updateError) {
        logger.error('Failed to update password hash', {
          customerUserId: customerUser.id,
          error: updateError.message,
        });
        return new Response(
          JSON.stringify({ error: 'Failed to reset password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Mark token as used
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id as string);

    if (markUsedError) {
      logger.error('Failed to mark token as used', {
        tokenId: resetToken.id as string,
        error: markUsedError.message,
      });
    }

    // Revoke all other sessions for this customer
    const { error: revokeError } = await supabase
      .from('customer_sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('customer_user_id', customerUser.id)
      .gt('expires_at', new Date().toISOString());

    if (revokeError) {
      logger.warn('Failed to revoke customer sessions', {
        customerUserId: customerUser.id,
        error: revokeError.message,
      });
    }

    // Also sign out all Supabase Auth sessions if user has auth account
    if (customerUser.user_id) {
      try {
        await supabase.auth.admin.signOut(customerUser.user_id, 'global');
      } catch (signOutError: unknown) {
        logger.warn('Failed to revoke auth sessions', {
          userId: customerUser.user_id,
          error: signOutError instanceof Error ? signOutError.message : 'Unknown error',
        });
      }
    }

    // Log password_change event via audit system
    try {
      await supabase.rpc('log_audit_event', {
        p_tenant_id: customerUser.tenant_id,
        p_category: 'auth',
        p_event_type: 'password_change',
        p_severity: 'info',
        p_actor_type: 'customer',
        p_actor_id: customerUser.id,
        p_actor_email: customerUser.email,
        p_target_type: 'customer_user',
        p_target_id: customerUser.id,
        p_details: JSON.stringify({
          method: 'reset_token',
          token_id: resetToken.id,
          ip_address: ipAddress,
        }),
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_success: true,
        p_error_message: null,
      });
    } catch (auditError: unknown) {
      logger.warn('Failed to log audit event', {
        error: auditError instanceof Error ? auditError.message : 'Unknown error',
      });
    }

    logger.info('Password reset successful', {
      customerUserId: customerUser.id,
      tenantId: customerUser.tenant_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully. Please log in with your new password.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    logger.error('Unexpected error in auth-reset-password', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ipAddress,
    });
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
