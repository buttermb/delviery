import { corsHeaders } from '../../_shared/deps.ts';
import type { SupabaseClient } from '../../_shared/deps.ts';
import type { CorsHeaders } from '../utils.ts';
import { errorResponse, jsonResponse } from '../utils.ts';

export async function handleVerify(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders_: CorsHeaders,
): Promise<Response> {
  // Check for token in httpOnly cookie first, then fall back to Authorization header
  let token: string | null = null;

  // Try to get token from cookie
  const cookieHeader = req.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const accessTokenCookie = cookies.find(c => c.startsWith('tenant_access_token='));
    if (accessTokenCookie) {
      token = accessTokenCookie.split('=')[1];
    }
  }

  // Fall back to Authorization header if no cookie
  if (!token) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    }
  }

  if (!token) {
    return errorResponse(corsHeaders_, 401, 'No token provided');
  }

  // Verify token and get user (fast auth check)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user || !user.email) {
    console.error('Token verification failed:', authError);
    return errorResponse(corsHeaders_, 401, 'Invalid or expired token');
  }

  const userEmail = user.email.toLowerCase();
  console.error('[VERIFY] Checking access for:', userEmail);

  // Optimized: Check tenant ownership first (single query, no joins)
  const { data: ownedTenant, error: ownerError } = await supabase
    .from('tenants')
    .select('id, business_name, slug, owner_email, owner_name, subscription_plan, subscription_status, trial_ends_at, limits, usage, features')
    .eq('owner_email', userEmail)
    .maybeSingle();

  if (ownerError && ownerError.code !== 'PGRST116') {
    console.error('[VERIFY] Owner lookup error:', ownerError);
  }

  if (ownedTenant) {
    // User is tenant owner - fast path
    console.error('[VERIFY] User is owner of tenant:', ownedTenant.business_name);

    const admin = {
      id: user.id,
      email: userEmail,
      name: ownedTenant.owner_name || userEmail.split('@')[0],
      role: 'owner',
      tenant_id: ownedTenant.id,
      userId: user.id,
    };

    const tenant = {
      id: ownedTenant.id,
      business_name: ownedTenant.business_name,
      slug: ownedTenant.slug,
      owner_email: ownedTenant.owner_email,
      subscription_plan: ownedTenant.subscription_plan,
      subscription_status: ownedTenant.subscription_status,
      trial_ends_at: ownedTenant.trial_ends_at,
      limits: ownedTenant.limits,
      usage: ownedTenant.usage,
      features: ownedTenant.features,
    };

    return jsonResponse(corsHeaders_, { user, admin, tenant });
  }

  // Not owner - check tenant_users
  console.error('[VERIFY] User not owner, checking tenant_users');

  const { data: tenantUser, error: tenantUserError } = await supabase
    .from('tenant_users')
    .select('id, email, name, role, tenant_id, status')
    .eq('email', userEmail)
    .eq('status', 'active')
    .maybeSingle();

  if (tenantUserError && tenantUserError.code !== 'PGRST116') {
    console.error('[VERIFY] Tenant user lookup error:', tenantUserError);
  }

  if (!tenantUser) {
    console.error('[VERIFY] No tenant access found for:', userEmail);
    return errorResponse(corsHeaders_, 403, 'No tenant access found');
  }

  // Get tenant info separately (more efficient than nested select)
  const { data: userTenant, error: userTenantError } = await supabase
    .from('tenants')
    .select('id, business_name, slug, owner_email, subscription_plan, subscription_status, trial_ends_at, limits, usage, features')
    .eq('id', tenantUser.tenant_id)
    .maybeSingle();

  if (userTenantError || !userTenant) {
    console.error('[VERIFY] Tenant lookup error:', userTenantError);
    return errorResponse(corsHeaders_, 404, 'Tenant not found');
  }

  console.error('[VERIFY] User has access to tenant:', userTenant.business_name);

  const admin = {
    id: tenantUser.id,
    email: tenantUser.email,
    name: tenantUser.name,
    role: tenantUser.role,
    tenant_id: tenantUser.tenant_id,
    userId: user.id,
  };

  const tenant = {
    id: userTenant.id,
    business_name: userTenant.business_name,
    slug: userTenant.slug,
    owner_email: userTenant.owner_email,
    subscription_plan: userTenant.subscription_plan,
    subscription_status: userTenant.subscription_status,
    trial_ends_at: userTenant.trial_ends_at,
    limits: userTenant.limits,
    usage: userTenant.usage,
    features: userTenant.features,
  };

  return new Response(
    JSON.stringify({ user, admin, tenant }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
