// Low Stock Email Digest — Auth Verification

import { createClient, corsHeaders } from '../_shared/deps.ts';

/**
 * Verify request is from a service role (cron) or a valid user JWT.
 * Returns null if authorized, or a Response if unauthorized.
 */
export async function verifyAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Allow service role key for cron jobs
  const isServiceCall = authHeader?.replace('Bearer ', '') === supabaseServiceKey;

  if (isServiceCall) {
    return null;
  }

  // Check for valid JWT for manual triggers
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return null;
}
