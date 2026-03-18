import { createClient } from '../_shared/deps.ts';
import { corsHeaders } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { z } from '../_shared/deps.ts';

const secureAccountSchema = z.object({
  token: z.string().min(1),
});

const confirmLoginSchema = z.object({
  alertId: z.string().uuid(),
});

Deno.serve(withZenProtection(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const rawBody = await req.json();

    // Determine action from the request
    const action = rawBody.action || 'secure';

    if (action === 'secure') {
      // One-click secure account (from email link, no auth required)
      const body = secureAccountSchema.parse(rawBody);

      const { data: result, error: rpcError } = await supabase.rpc('secure_account_from_alert', {
        p_secure_token: body.token,
      });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw new Error(`Database error: ${rpcError.message}`);
      }

      if (!result?.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: result?.error || 'Failed to secure account',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Revoke all sessions for the user via Supabase Auth
      if (result.user_id) {
        try {
          // Sign out all sessions for this user
          await supabase.auth.admin.signOut(result.user_id, 'global');
          console.log('All sessions revoked for user:', result.user_id);
        } catch (signOutError) {
          console.error('Failed to revoke sessions:', signOutError);
          // Continue anyway - the alert is already marked
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Account secured. All sessions have been terminated. Please sign in again and change your password.',
          userId: result.user_id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (action === 'confirm') {
      // User confirms login was them (requires auth)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }

      // Create authenticated client
      const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await userSupabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }

      const body = confirmLoginSchema.parse(rawBody);

      const { data: result, error: rpcError } = await supabase.rpc('confirm_login_was_me', {
        p_alert_id: body.alertId,
        p_user_id: user.id,
      });

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`);
      }

      return new Response(
        JSON.stringify(result),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result?.success ? 200 : 400,
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "secure" or "confirm".' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in secure-account:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}));
