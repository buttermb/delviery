/**
 * Tenant resolution and authorization for invoice management.
 */

import { createClient, corsHeaders } from '../_shared/deps.ts';

/**
 * Resolve the tenant_id for the authenticated user.
 * Checks tenant_users first, then falls back to tenant owner.
 */
export async function resolveTenantId(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string | undefined,
  providedTenantId?: string
): Promise<{ tenantId: string | null; error: Response | null }> {
  let tenantId = providedTenantId || null;

  if (!tenantId) {
    const { data: tenantUser } = await serviceClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (tenantUser) {
      tenantId = tenantUser.tenant_id;
    } else {
      const { data: tenant } = await serviceClient
        .from('tenants')
        .select('id')
        .eq('owner_email', userEmail)
        .maybeSingle();

      if (tenant) {
        tenantId = tenant.id;
      }
    }
  }

  if (!tenantId) {
    return {
      tenantId: null,
      error: new Response(
        JSON.stringify({ error: 'Tenant not found or user not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { tenantId, error: null };
}

/**
 * Verify the user has access to the given tenant (owner or member).
 */
export async function verifyTenantAccess(
  serviceClient: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  userEmail: string | undefined
): Promise<Response | null> {
  const { data: tenant } = await serviceClient
    .from('tenants')
    .select('id, owner_email')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenant) {
    return new Response(
      JSON.stringify({ error: 'Tenant not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const isOwner = tenant.owner_email?.toLowerCase() === userEmail?.toLowerCase();
  const { data: tenantUser } = await serviceClient
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!isOwner && !tenantUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - no access to this tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return null;
}
