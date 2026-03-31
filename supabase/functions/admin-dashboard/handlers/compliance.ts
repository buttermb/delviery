/**
 * Compliance dashboard handler.
 */
import { type HandlerContext, jsonResponse } from './_shared.ts';

export async function handleCompliance(ctx: HandlerContext): Promise<Response> {
  const { supabase, tenantId } = ctx;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [
    { count: unverifiedUsers },
    { count: todayVerifications },
    { count: failedVerifications },
    { count: flaggedOrders },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("age_verified", false).lt("created_at", yesterday.toISOString()),
    supabase.from("age_verifications").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    supabase.from("age_verifications").select("*", { count: "exact", head: true }).eq("verified", false),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).not("flagged_reason", "is", null),
  ]);

  return jsonResponse({
    unverifiedUsers: unverifiedUsers || 0,
    todayVerifications: todayVerifications || 0,
    failedVerifications: failedVerifications || 0,
    flaggedOrders: flaggedOrders || 0,
  });
}
