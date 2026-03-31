import { corsHeaders } from '../../_shared/deps.ts';
import type { SupabaseClient } from '../../_shared/deps.ts';
import type { CorsHeaders } from '../utils.ts';
import { errorResponse } from '../utils.ts';

export async function handleImpersonate(
  req: Request,
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  corsHeaders_: CorsHeaders,
): Promise<Response> {
  const { tenant_id, super_admin_id } = body;

  if (!tenant_id) {
    return errorResponse(corsHeaders_, 400, 'tenant_id required');
  }

  // --- AUTH CHECK: Verify caller is authenticated via JWT ---
  const impersonateAuthHeader = req.headers.get('Authorization');
  if (!impersonateAuthHeader || !impersonateAuthHeader.startsWith('Bearer ')) {
    return errorResponse(corsHeaders_, 401, 'Authentication required');
  }

  const impersonateJwt = impersonateAuthHeader.replace('Bearer ', '');
  const { data: { user: callerUser }, error: callerAuthError } = await supabase.auth.getUser(impersonateJwt);

  if (callerAuthError || !callerUser) {
    console.error('[impersonate] Caller authentication failed:', callerAuthError);
    return errorResponse(corsHeaders_, 401, 'Invalid or expired token');
  }

  // --- AUTHZ CHECK: Verify the authenticated user is a super_admin ---
  if (super_admin_id && callerUser.id !== super_admin_id) {
    console.error('[impersonate] super_admin_id mismatch:', {
      authenticated: callerUser.id,
      claimed: super_admin_id,
    });
    return errorResponse(corsHeaders_, 403, 'Forbidden: super_admin_id does not match authenticated user');
  }

  // Verify caller exists in super_admin_users table with active status
  const { data: callerSuperAdmin, error: saLookupError } = await supabase
    .from('super_admin_users')
    .select('id, email, status')
    .eq('email', callerUser.email?.toLowerCase())
    .eq('status', 'active')
    .maybeSingle();

  if (saLookupError || !callerSuperAdmin) {
    // Fallback: check user_roles table for super_admin role
    const { data: callerRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (roleError || !callerRole) {
      console.error('[impersonate] Caller is not a super_admin:', callerUser.id);
      return errorResponse(corsHeaders_, 403, 'Forbidden: super_admin role required for impersonation');
    }
  }

  // Verify caller has an active super_admin session
  const { data: activeSession, error: sessionError } = await supabase
    .from('super_admin_sessions')
    .select('id')
    .eq('super_admin_id', callerSuperAdmin?.id ?? callerUser.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (sessionError || !activeSession) {
    console.error('[impersonate] No active super_admin session found for:', callerUser.id);
    // Non-blocking: log but still allow if other checks passed
  }

  // Get tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, business_name, slug, subscription_plan, subscription_status, limits, usage, features')
    .eq('id', tenant_id)
    .maybeSingle();

  if (tenantError || !tenant) {
    return errorResponse(corsHeaders_, 404, 'Tenant not found');
  }

  // Get first active admin
  const { data: tenantAdmin, error: adminError } = await supabase
    .from('tenant_users')
    .select('id, email, name, role, tenant_id')
    .eq('tenant_id', tenant_id)
    .in('role', ['owner', 'admin'])
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (adminError || !tenantAdmin) {
    return errorResponse(corsHeaders_, 404, 'No active admin found for tenant');
  }

  // Log impersonation start in audit_logs
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const impersonateUserAgent = req.headers.get('user-agent') || 'unknown';

  await supabase
    .from('audit_logs')
    .insert({
      actor_id: callerUser.id,
      actor_type: 'super_admin',
      action: 'impersonate_started',
      resource_type: 'tenant',
      resource_id: tenant_id,
      tenant_id: tenant_id,
      changes: {
        tenant_slug: tenant.slug,
        tenant_name: tenant.business_name,
        admin_email: tenantAdmin.email,
        admin_id: tenantAdmin.id,
        admin_role: tenantAdmin.role,
        timestamp: new Date().toISOString(),
      },
      ip_address: ipAddress,
      user_agent: impersonateUserAgent,
    })
    .catch((logError: unknown) => {
      console.error('Failed to log impersonation:', logError);
    });

  // Generate token for tenant admin
  return new Response(
    JSON.stringify({
      success: true,
      tenant: {
        id: tenant.id,
        business_name: tenant.business_name,
        slug: tenant.slug,
        subscription_plan: tenant.subscription_plan,
        subscription_status: tenant.subscription_status,
        limits: tenant.limits,
        usage: tenant.usage,
        features: tenant.features,
      },
      admin: {
        id: tenantAdmin.id,
        email: tenantAdmin.email,
        name: tenantAdmin.name,
        role: tenantAdmin.role,
        userId: tenantAdmin.user_id,
      },
      message: 'Use tenant admin email to generate token',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
