/**
 * Shared types and utilities for admin-dashboard handlers.
 */

export const JSON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

export interface HandlerContext {
  supabase: any;
  adminUser: { id: string; role: string };
  tenantId: string;
  url: URL;
  req: Request;
  validatedBody: Record<string, unknown> | null;
}

export async function logAdminAction(
  supabase: any,
  adminId: string,
  action: string,
  tenantId: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
  req?: Request
) {
  await supabase.from("admin_audit_logs").insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: { ...details, tenant_id: tenantId },
    ip_address: req?.headers.get("x-forwarded-for") || "unknown",
    user_agent: req?.headers.get("user-agent") || "unknown",
  });
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function errorResponse(error: string, status = 400): Response {
  return new Response(JSON.stringify({ error }), { status, headers: JSON_HEADERS });
}
