import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const logger = createLogger('auth-login');

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  tenant_slug: z.string().min(1, 'Tenant slug is required'),
});

serve(withZenProtection(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: (parsed as { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } }).error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, tenant_slug } = parsed.data;
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenant_slug)
      .maybeSingle();

    if (tenantError || !tenant) {
      // Generic error - don't reveal if tenant exists or not
      logger.warn('Login attempt with invalid tenant', { tenantId: tenant_slug });
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if account is locked via user_profiles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, locked_until')
      .eq('email', email)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (userProfile?.locked_until) {
      const lockedUntil = new Date(userProfile.locked_until);
      if (lockedUntil > new Date()) {
        logger.warn('Login attempt on locked account', { tenantId: tenant.id });
        return new Response(
          JSON.stringify({
            error: 'Account is temporarily locked. Please try again later.',
            locked_until: userProfile.locked_until,
          }),
          { status: 423, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Authenticate via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      // Call handle_failed_login RPC to increment attempts and potentially lock account
      await supabase.rpc('handle_failed_login', {
        p_email: email,
        p_tenant_id: tenant.id,
        p_ip_address: clientIp,
        p_user_agent: userAgent,
      });

      logger.info('Failed login attempt', { tenantId: tenant.id });

      // Generic error message - never reveal if email exists
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to this tenant
    const { data: profileCheck } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', authData.user.id)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (!profileCheck) {
      // User exists but not in this tenant - sign out and return generic error
      await supabase.auth.signOut();
      logger.warn('Login attempt for user not in tenant', { tenantId: tenant.id });
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call handle_user_login RPC to update login tracking
    await supabase.rpc('handle_user_login', {
      p_user_id: authData.user.id,
      p_tenant_id: tenant.id,
      p_ip_address: clientIp,
      p_user_agent: userAgent,
    });

    logger.info('Successful login', { userId: authData.user.id, tenantId: tenant.id });

    return new Response(
      JSON.stringify({
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_in: authData.session.expires_in,
          expires_at: authData.session.expires_at,
          token_type: authData.session.token_type,
        },
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Unexpected error during login', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
