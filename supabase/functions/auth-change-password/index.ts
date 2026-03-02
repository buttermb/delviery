import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { checkRateLimit } from '../_shared/rateLimiting.ts';

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters'),
  revoke_other_sessions: z.boolean().optional().default(false),
});

/**
 * Validate password strength requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one digit' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one special character' };
  }
  return { valid: true };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only accept POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with user's token for auth verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify user identity from JWT
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 5 attempts per 15 minutes per user
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(
      { key: 'password_change', limit: 5, windowMs: 15 * 60 * 1000 },
      `${clientIP}:${user.id}`
    );

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const parseResult = changePasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: (parseResult as { success: false; error: { issues: { message: string }[] } }).error.issues.map(i => i.message),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { current_password, new_password, revoke_other_sessions } = parseResult.data;

    // Create service role client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify current password by attempting sign-in
    const supabaseVerify = createClient(supabaseUrl, supabaseAnonKey);
    const { error: signInError } = await supabaseVerify.auth.signInWithPassword({
      email: user.email!,
      password: current_password,
    });

    if (signInError) {
      // Log failed attempt
      await serviceClient.from('security_events').insert({
        event_type: 'password_change_failed',
        user_id: user.id,
        details: { reason: 'incorrect_current_password', timestamp: new Date().toISOString() },
        ip_address: clientIP,
      });

      return new Response(
        JSON.stringify({ error: 'Current password is incorrect' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate new password is not the same as current
    if (current_password === new_password) {
      return new Response(
        JSON.stringify({ error: 'New password must be different from current password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength
    const strengthResult = validatePasswordStrength(new_password);
    if (!strengthResult.valid) {
      return new Response(
        JSON.stringify({ error: strengthResult.reason }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update password using service role client
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      { password: new_password }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update password. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optionally revoke other sessions by signing out the user globally
    // The caller's current JWT remains valid until expiry, but all refresh tokens are invalidated
    if (revoke_other_sessions) {
      const { error: signOutError } = await serviceClient.auth.admin.signOut(user.id);
      if (signOutError) {
        // Non-fatal: password was already changed, just log the failure
        console.error('Failed to revoke other sessions:', signOutError.message);
      }
    }

    // Log successful password change
    await serviceClient.from('security_events').insert({
      event_type: 'password_change',
      user_id: user.id,
      details: {
        revoked_other_sessions: revoke_other_sessions,
        timestamp: new Date().toISOString(),
      },
      ip_address: clientIP,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password updated successfully',
        revoked_other_sessions: revoke_other_sessions,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
