import { corsHeaders } from '../../_shared/deps.ts';
import { AUTH_ERRORS } from '../../_shared/auth-errors.ts';
import { verifyCustomerToken } from './types.ts';
import type { HandlerContext } from './types.ts';

export async function handleVerify(ctx: HandlerContext): Promise<Response> {
  const { req, supabase } = ctx;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "No token provided" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const payload = await verifyCustomerToken(token);

  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify session exists and is valid
  const { data: session, error: sessionError } = await supabase
    .from("customer_sessions")
    .select("*")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ error: "Session expired or invalid" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get customer user
  const { data: customerUser, error: customerError } = await supabase
    .from("customer_users")
    .select("*")
    .eq("id", payload.customer_user_id)
    .eq("status", "active")
    .maybeSingle();

  if (customerError || !customerUser) {
    return new Response(
      JSON.stringify({ error: AUTH_ERRORS.UNAUTHORIZED }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get tenant
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", payload.tenant_id)
    .eq("status", "active")
    .maybeSingle();

  if (tenantError || !tenant) {
    return new Response(
      JSON.stringify({ error: AUTH_ERRORS.UNAUTHORIZED }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      customer: {
        id: customerUser.id,
        email: customerUser.email,
        first_name: customerUser.first_name,
        last_name: customerUser.last_name,
        customer_id: customerUser.customer_id,
        tenant_id: tenant.id,
      },
      tenant: {
        id: tenant.id,
        business_name: tenant.business_name,
        slug: tenant.slug,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
