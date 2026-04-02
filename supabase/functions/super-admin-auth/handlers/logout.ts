// Handler: logout
import { verifySuperAdminToken, type HandlerContext } from '../utils.ts';

export async function handleLogout(ctx: HandlerContext): Promise<Response> {
  const { req, supabase } = ctx;

  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    // Verify token to get user ID and expiry
    const payload = await verifySuperAdminToken(token);

    if (payload) {
      // Add to token blacklist for immediate revocation
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 8); // Match token expiry

      await supabase.rpc("blacklist_token", {
        p_jti: payload.jti ?? token.substring(0, 32),
        p_user_id: payload.super_admin_id,
        p_expires_at: tokenExpiry.toISOString(),
        p_reason: "logout",
      });
    }

    // Also delete from sessions table
    await supabase.from("super_admin_sessions").delete().eq("token", token);
  }

  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
    },
  );
}
