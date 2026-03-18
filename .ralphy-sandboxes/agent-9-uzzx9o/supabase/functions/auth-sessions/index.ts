/**
 * Auth Sessions Edge Function
 * Requires authentication. Provides:
 * - GET: List user's active sessions with device_info, location, last_activity, is_current flag
 * - POST action=revoke: Revoke a specific session by ID
 * - POST action=revoke_all_others: Revoke all sessions except the current one
 * Logs session_revoked events to auth_audit_log
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const revokeSessionSchema = z.object({
  action: z.enum(['revoke', 'revoke_all_others']),
  session_id: z.string().uuid().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Extract user from JWT - never trust client data
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine current session token from the auth header
    const currentToken = token;

    if (req.method === 'GET') {
      return await handleGetSessions(supabase, user.id, currentToken);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { action, session_id } = revokeSessionSchema.parse(body);

      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';

      if (action === 'revoke') {
        if (!session_id) {
          return new Response(
            JSON.stringify({ error: 'session_id is required for revoke action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return await handleRevokeSession(supabase, user.id, session_id, ipAddress, userAgent);
      }

      if (action === 'revoke_all_others') {
        return await handleRevokeAllOthers(supabase, user.id, currentToken, ipAddress, userAgent);
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = error instanceof z.ZodError ? 400 : 500;
    return new Response(
      JSON.stringify({ error: status === 400 ? 'Invalid request body' : message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleGetSessions(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  currentToken: string
): Promise<Response> {
  const { data: sessions, error } = await supabase
    .from('user_sessions')
    .select('id, session_token, device_info, ip_address, location, is_active, expires_at, last_activity_at, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('last_activity_at', { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch sessions' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Mark which session is the current one and strip sensitive token data
  const formattedSessions = (sessions || []).map((session) => ({
    id: session.id,
    device_info: session.device_info || {},
    ip_address: session.ip_address,
    location: session.location || {},
    is_active: session.is_active,
    last_activity_at: session.last_activity_at,
    created_at: session.created_at,
    expires_at: session.expires_at,
    is_current: session.session_token === currentToken,
  }));

  return new Response(
    JSON.stringify({ success: true, sessions: formattedSessions }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRevokeSession(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  sessionId: string,
  ipAddress: string,
  userAgent: string
): Promise<Response> {
  // Verify the session belongs to the user
  const { data: session, error: fetchError } = await supabase
    .from('user_sessions')
    .select('id, user_id, is_active')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError || !session) {
    return new Response(
      JSON.stringify({ error: 'Session not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!session.is_active) {
    return new Response(
      JSON.stringify({ error: 'Session already revoked' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Revoke the session
  const { error: updateError } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to revoke session' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Log session_revoked event
  await logSessionRevokedEvent(supabase, userId, ipAddress, userAgent, {
    revoked_session_id: sessionId,
    action: 'revoke_single',
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Session revoked successfully' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRevokeAllOthers(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  currentToken: string,
  ipAddress: string,
  userAgent: string
): Promise<Response> {
  // Get all active sessions except the current one
  const { data: otherSessions, error: fetchError } = await supabase
    .from('user_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('session_token', currentToken);

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch sessions' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const sessionIds = (otherSessions || []).map((s) => s.id);

  if (sessionIds.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: 'No other active sessions to revoke', revoked_count: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Revoke all other sessions
  const { error: updateError } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('session_token', currentToken);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to revoke sessions' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Log session_revoked event
  await logSessionRevokedEvent(supabase, userId, ipAddress, userAgent, {
    revoked_session_ids: sessionIds,
    revoked_count: sessionIds.length,
    action: 'revoke_all_others',
  });

  return new Response(
    JSON.stringify({
      success: true,
      message: `${sessionIds.length} session(s) revoked successfully`,
      revoked_count: sessionIds.length,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function logSessionRevokedEvent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ipAddress: string,
  userAgent: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('auth_audit_log').insert({
      user_id: userId,
      event_type: 'session_revoked',
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Don't fail the main operation if audit logging fails
  }
}
