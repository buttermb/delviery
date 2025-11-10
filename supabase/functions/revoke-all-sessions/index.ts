/**
 * Revoke All Sessions Except Current
 * Revokes all active sessions for a customer except the current one
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const revokeSessionsSchema = z.object({
  customer_user_id: z.string().uuid(),
  current_token: z.string().min(1),
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
    const { customer_user_id, current_token } = revokeSessionsSchema.parse(body);

    // Use database function to revoke all sessions except current
    const { data: revokedCount, error: revokeError } = await supabase.rpc('revoke_all_sessions_except_current', {
      customer_user_id_param: customer_user_id,
      current_token_param: current_token,
    });

    if (revokeError) {
      console.error('Failed to revoke sessions:', revokeError);
      // Fallback: direct update
      const { error: directError } = await supabase
        .from('customer_sessions')
        .update({ expires_at: new Date().toISOString() })
        .eq('customer_user_id', customer_user_id)
        .neq('token', current_token)
        .gt('expires_at', new Date().toISOString());

      if (directError) {
        throw directError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'All other sessions have been revoked',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        revoked_count: revokedCount || 0,
        message: 'All other sessions have been revoked',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Revoke all sessions error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to revoke sessions',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

