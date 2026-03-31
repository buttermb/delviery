/**
 * Shared utilities for admin actions: tenant resolution and audit logging.
 */

/**
 * Resolve tenant_id from an authenticated user.
 * Checks tenant_users first, then falls back to tenant owner_email.
 */
export async function resolveTenantId(
  supabase: unknown,
  userId: string,
  userEmail: string | undefined
): Promise<string | null> {
  const sb = supabase as { from: (table: string) => unknown };

  const { data: tenantUser } = await (sb.from('tenant_users') as {
    select: (cols: string) => { eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> } }
  }).select('tenant_id').eq('user_id', userId).maybeSingle();

  if (tenantUser) {
    return tenantUser.tenant_id as string;
  }

  // Fallback: check if user is a tenant owner
  if (userEmail) {
    const { data: tenant } = await (sb.from('tenants') as {
      select: (cols: string) => { eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> } }
    }).select('id').eq('owner_email', userEmail).maybeSingle();

    if (tenant) {
      return tenant.id as string;
    }
  }

  return null;
}

export async function logAdminAction(
  supabase: unknown,
  adminId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
  req?: Request
): Promise<void> {
  const sb = supabase as { from: (table: string) => { insert: (data: Record<string, unknown>) => Promise<void> } };
  await sb.from('admin_audit_logs').insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    ip_address: req?.headers.get('x-forwarded-for') || 'unknown',
    user_agent: req?.headers.get('user-agent') || 'unknown',
  });
}
