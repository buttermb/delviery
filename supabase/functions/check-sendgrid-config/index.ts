/**
 * Check SendGrid Config Edge Function
 * Checks if SendGrid is configured for the authenticated tenant
 */

import { serve, corsHeaders, createClient } from '../_shared/deps.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ configured: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ configured: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Resolve tenant
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ configured: false, error: 'Tenant not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check account_settings for tenant's SendGrid credentials
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantUser.tenant_id)
      .maybeSingle();

    if (!account) {
      return new Response(
        JSON.stringify({ configured: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: settings } = await supabase
      .from('account_settings')
      .select('integration_settings')
      .eq('account_id', account.id)
      .maybeSingle();

    const integrationSettings = settings?.integration_settings as Record<string, unknown> | null;
    const configured = !!(integrationSettings?.sendgrid_api_key);

    return new Response(
      JSON.stringify({ configured }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ configured: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
