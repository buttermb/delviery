/**
 * Auth Logout Edge Function
 * Accepts session_token or uses auth header to log out a user.
 * Marks user_sessions row as is_active=false, logs logout event to auth_audit_log,
 * calls supabase.auth.signOut, handles already-logged-out gracefully.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const LogoutRequestSchema = z.object({
  session_token: z.string().optional(),
}).optional();

serve(withZenProtection(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    // Parse optional body for session_token
    let sessionToken: string | undefined;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        const parsed = LogoutRequestSchema.parse(body);
        sessionToken = parsed?.session_token;
      } catch {
        // Body is optional - proceed without session_token
      }
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Determine user identity from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | undefined;

    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (!authError && user) {
        userId = user.id;
      }
    }

    // If no user from auth header, try to find user by session_token
    if (!userId && sessionToken) {
      const { data: session } = await supabaseAdmin
        .from('user_sessions')
        .select('user_id, is_active')
        .eq('session_token', sessionToken)
        .maybeSingle();

      if (session) {
        userId = session.user_id;

        // If session already inactive, return success gracefully
        if (!session.is_active) {
          return new Response(
            JSON.stringify({ success: true, message: 'Session already logged out' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // If we still have no user context, treat as already logged out
    if (!userId) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active session found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Mark user_sessions row as is_active = false
    if (sessionToken) {
      // Deactivate the specific session by token
      await supabaseAdmin
        .from('user_sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('session_token', sessionToken)
        .eq('user_id', userId);
    } else {
      // Deactivate all active sessions for this user
      await supabaseAdmin
        .from('user_sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_active', true);
    }

    // Log logout event to auth_audit_log
    await supabaseAdmin.from('auth_audit_log').insert({
      user_id: userId,
      event_type: 'logout',
      ip_address: clientIp,
      user_agent: userAgent,
      metadata: {
        session_token_provided: !!sessionToken,
        timestamp: new Date().toISOString(),
      },
    });

    // Sign out from Supabase Auth (only possible with a valid auth header)
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      await supabaseAuth.auth.signOut();
    }
    // When only session_token is provided (no auth header), the user_sessions
    // deactivation above is sufficient - the Supabase auth session will expire
    // naturally or can be revoked via the admin dashboard if needed.

    return new Response(
      JSON.stringify({ success: true, message: 'Logged out successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Auth logout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Logout failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
