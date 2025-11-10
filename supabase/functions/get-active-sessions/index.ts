/**
 * Get Active Sessions
 * Returns all active sessions for a customer user
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const getSessionsSchema = z.object({
  customer_user_id: z.string().uuid(),
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
    const { customer_user_id } = getSessionsSchema.parse(body);

    // Get active sessions using database function
    const { data: sessions, error: sessionsError } = await supabase.rpc('get_active_sessions', {
      customer_user_id_param: customer_user_id,
    });

    if (sessionsError) {
      console.error('Failed to get sessions:', sessionsError);
      // Fallback: direct query
      const { data: directSessions, error: directError } = await supabase
        .from('customer_sessions')
        .select('id, token, ip_address, user_agent, created_at, expires_at')
        .eq('customer_user_id', customer_user_id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (directError) {
        throw directError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          sessions: directSessions || [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessions: sessions || [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Get active sessions error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get active sessions',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

