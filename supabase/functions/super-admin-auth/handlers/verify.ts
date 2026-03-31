// Handler: verify token
import { corsHeaders } from '../../_shared/deps.ts';
import { AUTH_ERRORS } from '../../_shared/auth-errors.ts';
import { verifySuperAdminToken, type HandlerContext } from '../utils.ts';

export async function handleVerify(ctx: HandlerContext): Promise<Response> {
  const { req, supabase } = ctx;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "No token provided" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const payload = await verifySuperAdminToken(token);

  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Check if token is blacklisted (immediate revocation)
  const { data: isBlacklisted } = await supabase.rpc("is_token_blacklisted", {
    p_jti: token.substring(0, 32),
  });

  if (isBlacklisted) {
    return new Response(
      JSON.stringify({ error: "Token has been revoked" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Verify session exists and is valid
  const { data: session, error: sessionError } = await supabase
    .from("super_admin_sessions")
    .select("*")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ error: "Session expired or invalid" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Get super admin user
  const { data: superAdmin, error: adminError } = await supabase
    .from("super_admin_users")
    .select("*")
    .eq("id", payload.super_admin_id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError || !superAdmin) {
    return new Response(
      JSON.stringify({ error: AUTH_ERRORS.UNAUTHORIZED }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        first_name: superAdmin.first_name,
        last_name: superAdmin.last_name,
        role: superAdmin.role,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
