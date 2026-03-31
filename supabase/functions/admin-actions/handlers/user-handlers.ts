/**
 * Admin action handlers for user operations: suspend-user.
 */

import { createLogger } from '../../_shared/logger.ts';
import { logAdminAction } from '../shared.ts';

const logger = createLogger('admin-actions');

interface HandlerContext {
  supabase: any;
  authCors: Record<string, string>;
  adminUser: Record<string, unknown>;
  tenantId: string;
  userId?: string;
  reason?: string;
  req: Request;
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...headers, 'Content-Type': 'application/json' } }
  );
}

export async function handleSuspendUser(ctx: HandlerContext): Promise<Response> {
  const { supabase, authCors, adminUser, tenantId, userId, reason, req } = ctx;

  if (!userId || !reason) {
    return jsonResponse({ error: 'User ID and reason required' }, 400, authCors);
  }

  // Verify the target user belongs to this tenant
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('user_id, tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!targetProfile) {
    logger.warn('Suspend user: target not in admin tenant', { userId, tenantId });
    return jsonResponse({ error: 'User not found in your tenant' }, 403, authCors);
  }

  const { data: profile, error: updateError } = await supabase
    .from('profiles')
    .update({ age_verified: false })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();

  if (updateError) {
    logger.error('Failed to suspend user', { userId, error: updateError.message });
    return jsonResponse({ error: 'Failed to suspend user' }, 500, authCors);
  }

  await logAdminAction(supabase, adminUser.id as string, 'SUSPEND_USER', 'user', userId, { reason }, req);
  logger.info('User suspended', { userId, adminId: adminUser.id });

  return jsonResponse({ success: true, profile }, 200, authCors);
}
