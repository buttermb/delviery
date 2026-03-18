/**
 * Save Integration Secrets Edge Function
 *
 * Securely stores tenant integration credentials in account_settings.
 * Validates the caller is an authenticated tenant admin, resolves
 * their tenant, and merges the new credentials into integration_settings.
 */

import { serve, corsHeaders, createClient, z } from '../_shared/deps.ts';

const SecretPayloadSchema = z.object({
  integration_id: z.enum(['stripe', 'twilio', 'sendgrid', 'mapbox']),
  credentials: z.record(z.string(), z.string()),
});

/** Maps integration_id + field key to the stored JSONB key. */
function mapCredentialKeys(
  integrationId: string,
  credentials: Record<string, string>,
): Record<string, string> {
  const mapping: Record<string, Record<string, string>> = {
    stripe: {
      TENANT_STRIPE_SECRET_KEY: 'stripe_secret_key',
      TENANT_STRIPE_PUBLISHABLE_KEY: 'stripe_publishable_key',
    },
    twilio: {
      TWILIO_ACCOUNT_SID: 'twilio_account_sid',
      TWILIO_AUTH_TOKEN: 'twilio_auth_token',
    },
    sendgrid: {
      SENDGRID_API_KEY: 'sendgrid_api_key',
    },
    mapbox: {
      VITE_MAPBOX_TOKEN: 'mapbox_token',
    },
  };

  const fieldMap = mapping[integrationId] ?? {};
  const mapped: Record<string, string> = {};

  for (const [key, value] of Object.entries(credentials)) {
    const storageKey = fieldMap[key];
    if (storageKey && value) {
      mapped[storageKey] = value;
    }
  }

  return mapped;
}

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
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Authenticate the caller
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse & validate body
    const body = await req.json();
    const parsed = SecretPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload', details: parsed.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { integration_id, credentials } = parsed.data;

    // Resolve tenant from caller
    const { data: tenantUser, error: tuError } = await supabase
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (tuError || !tenantUser) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found for this user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Only admin/owner roles can configure integrations
    if (!['admin', 'owner'].includes(tenantUser.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions — admin or owner role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Resolve account for tenant
    let { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantUser.tenant_id)
      .maybeSingle();

    // Create account if it doesn't exist
    if (!account) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, business_name, slug')
        .eq('id', tenantUser.tenant_id)
        .maybeSingle();

      if (!tenant) {
        return new Response(
          JSON.stringify({ error: 'Unable to resolve tenant' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: newAccount, error: createError } = await supabase
        .from('accounts')
        .insert({
          company_name: tenant.business_name || tenant.slug || 'Primary Account',
          slug: tenant.slug,
          tenant_id: tenant.id,
        })
        .select('id')
        .maybeSingle();

      if (createError || !newAccount) {
        return new Response(
          JSON.stringify({ error: 'Failed to create account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      account = newAccount;
    }

    // Map field keys to storage keys
    const mappedCredentials = mapCredentialKeys(integration_id, credentials);

    if (Object.keys(mappedCredentials).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid credential fields provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get existing settings, merge, and upsert
    const { data: existing } = await supabase
      .from('account_settings')
      .select('integration_settings')
      .eq('account_id', account.id)
      .maybeSingle();

    const currentSettings = (existing?.integration_settings as Record<string, unknown>) ?? {};
    const updatedSettings = { ...currentSettings, ...mappedCredentials };

    const { error: upsertError } = await supabase
      .from('account_settings')
      .upsert(
        { account_id: account.id, integration_settings: updatedSettings },
        { onConflict: 'account_id', ignoreDuplicates: false },
      );

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: 'Failed to save integration settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, integration_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
