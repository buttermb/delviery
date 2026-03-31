import { serve, createClient } from '../_shared/deps.ts';
import { getAuthenticatedCorsHeaders } from '../_shared/cors.ts';
import { createRequestLogger } from '../_shared/logger.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/rateLimiting.ts';

/**
 * Resolve tenant_id from an authenticated user.
 * Checks tenant_users first, then falls back to tenant owner_email.
 */
async function resolveTenantId(supabase: any, userId: string, userEmail: string | undefined): Promise<string | null> {
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (tenantUser) {
    return tenantUser.tenant_id;
  }

  if (userEmail) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_email', userEmail)
      .maybeSingle();

    if (tenant) {
      return tenant.id;
    }
  }

  return null;
}

serve(async (req) => {
  const authCors = getAuthenticatedCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: authCors });
  }

  const logger = createRequestLogger('admin-reset-password', req);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...authCors, "Content-Type": "application/json" } }
      );
    }
    const callerToken = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(callerToken);
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...authCors, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is an admin
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('id, is_active')
      .eq('user_id', callerUser.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminUser) {
      logger.warn('Non-admin attempted password reset', { userId: callerUser.id });
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...authCors, "Content-Type": "application/json" } }
      );
    }

    // Resolve caller's tenant
    const callerTenantId = await resolveTenantId(supabaseAdmin, callerUser.id, callerUser.email);
    if (!callerTenantId) {
      logger.warn('Admin has no tenant association', { userId: callerUser.id });
      return new Response(
        JSON.stringify({ error: 'Tenant not found or user not authorized' }),
        { status: 403, headers: { ...authCors, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: 3 password resets per hour per admin
    const rateLimitResult = await checkRateLimit(RATE_LIMITS.PASSWORD_RESET, callerUser.id);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { userId: callerUser.id });
      return new Response(
        JSON.stringify({ error: 'Too many password reset attempts. Please try again later.' }),
        { status: 429, headers: { ...authCors, "Content-Type": "application/json" } }
      );
    }

    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Email and new password are required" }),
        { status: 400, headers: { ...authCors, "Content-Type": "application/json" } }
      );
    }

    logger.info('Password reset requested');

    // Tenant-scoped user lookup: find target user in tenant_users filtered by caller's tenant
    const { data: tenantUser } = await supabaseAdmin
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', callerTenantId)
      .eq('email', email)
      .maybeSingle();

    // Also check if target is a customer in this tenant via profiles
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('tenant_id', callerTenantId)
      .eq('email', email)
      .maybeSingle();

    const targetUserId = tenantUser?.user_id ?? targetProfile?.user_id;

    if (!targetUserId) {
      logger.warn('Target user not found in tenant', { email });
      return new Response(
        JSON.stringify({ error: 'Target user not found in your tenant' }),
        { status: 403, headers: { ...authCors, "Content-Type": "application/json" } }
      );
    }

    logger.info('Found user, updating password', { targetUserId });

    // Update password (service role used only after authorization confirmed)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      logger.error('Error updating password', { error: updateError.message });
      throw updateError;
    }

    logger.info('Password updated successfully');

    return new Response(
      JSON.stringify({ success: true, message: "Password updated successfully" }),
      { headers: { ...authCors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error('Password reset failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: 'Password reset failed' }),
      { status: 400, headers: { ...authCors, "Content-Type": "application/json" } }
    );
  }
});
