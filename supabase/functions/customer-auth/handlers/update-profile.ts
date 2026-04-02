import { updateProfileSchema } from '../validation.ts';
import { verifyCustomerToken } from './types.ts';
import type { HandlerContext } from './types.ts';

export async function handleUpdateProfile(ctx: HandlerContext): Promise<Response> {
  const { req, supabase } = ctx;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { status: 401, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rawBody = await req.json();
  const validationResult = updateProfileSchema.safeParse(rawBody);
  if (!validationResult.success) {
    const zodError = validationResult as { success: false; error: { errors: unknown[] } };
    return new Response(
      JSON.stringify({ error: "Validation failed", details: zodError.error.errors }),
      { status: 400, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const validated = validationResult.data;
  const token = authHeader.replace("Bearer ", "");
  const payload = await verifyCustomerToken(token);

  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Only include fields that were explicitly provided to avoid overwriting existing data
  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ('firstName' in validated) updateFields.first_name = validated.firstName ?? null;
  if ('lastName' in validated) updateFields.last_name = validated.lastName ?? null;
  if ('phone' in validated) updateFields.phone = validated.phone ?? null;

  const { error: updateError } = await supabase
    .from("customer_users")
    .update(updateFields)
    .eq("id", payload.customer_user_id)
    .eq("tenant_id", payload.tenant_id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: "Failed to update profile" }),
      { status: 500, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Profile updated successfully" }),
    { status: 200, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
  );
}
