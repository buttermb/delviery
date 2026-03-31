import { corsHeaders } from '../../_shared/deps.ts';
import { updateProfileSchema } from '../validation.ts';
import { verifyCustomerToken } from './types.ts';
import type { HandlerContext } from './types.ts';

export async function handleUpdateProfile(ctx: HandlerContext): Promise<Response> {
  const { req, supabase } = ctx;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rawBody = await req.json();
  const validationResult = updateProfileSchema.safeParse(rawBody);
  if (!validationResult.success) {
    const zodError = validationResult as { success: false; error: { errors: unknown[] } };
    return new Response(
      JSON.stringify({ error: "Validation failed", details: zodError.error.errors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { firstName, lastName, phone } = validationResult.data;
  const token = authHeader.replace("Bearer ", "");
  const payload = await verifyCustomerToken(token);

  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: updateError } = await supabase
    .from("customer_users")
    .update({
      first_name: firstName ?? null,
      last_name: lastName ?? null,
      phone: phone ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.customer_user_id)
    .eq("tenant_id", payload.tenant_id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: "Failed to update profile" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Profile updated successfully" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
