// Edge Function: auth-refresh
// Refreshes an expired access_token using a valid refresh_token from user_sessions
import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { signJWT, verifyJWT } from '../_shared/jwt.ts';

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
});

// Access token: 1 hour expiry
const ACCESS_TOKEN_EXPIRY = 60 * 60;
// Refresh token: 30 days expiry
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = refreshSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: (validation as { success: false; error: { errors: { message: string }[] } }).error.errors[0]?.message || 'Invalid input',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { refresh_token } = validation.data;

    // Look up the session by refresh_token
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('id, user_id, tenant_id, session_token, refresh_token, is_active, expires_at')
      .eq('refresh_token', refresh_token)
      .eq('is_active', true)
      .maybeSingle();

    if (sessionError) {
      console.error('Session lookup error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Failed to validate session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'INVALID_TOKEN', message: 'Invalid or revoked refresh token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    if (expiresAt <= now) {
      // Mark session as inactive since it's expired
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', session.id);

      return new Response(
        JSON.stringify({ error: 'TOKEN_EXPIRED', message: 'Session has expired, please log in again' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the refresh token JWT signature and payload
    const tokenPayload = await verifyJWT(refresh_token);
    if (!tokenPayload) {
      // Token signature invalid or JWT expired - deactivate session
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', session.id);

      return new Response(
        JSON.stringify({ error: 'INVALID_TOKEN', message: 'Refresh token is invalid or expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new access token
    const newAccessToken = await signJWT(
      {
        user_id: session.user_id,
        tenant_id: session.tenant_id,
        session_id: session.id,
        type: 'access',
      },
      ACCESS_TOKEN_EXPIRY
    );

    // Generate new refresh token
    const newRefreshToken = await signJWT(
      {
        user_id: session.user_id,
        tenant_id: session.tenant_id,
        session_id: session.id,
        type: 'refresh',
      },
      REFRESH_TOKEN_EXPIRY
    );

    // Calculate new session expiry (aligned with refresh token)
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000).toISOString();

    // Update user_sessions with new tokens and last_activity_at
    const { error: updateError } = await supabase
      .from('user_sessions')
      .update({
        session_token: newAccessToken,
        refresh_token: newRefreshToken,
        last_activity_at: new Date().toISOString(),
        expires_at: newExpiresAt,
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Session update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Failed to update session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: ACCESS_TOKEN_EXPIRY,
        token_type: 'Bearer',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auth refresh error:', error);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
