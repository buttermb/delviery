// Handler: refresh token
import { refreshSchema } from '../validation.ts';
import {
  createSuperAdminToken,
  verifySuperAdminToken,
  type HandlerContext,
} from '../utils.ts';

export async function handleRefresh(ctx: HandlerContext): Promise<Response> {
  const { supabase, body } = ctx;

  // Validate input with Zod
  const validationResult = refreshSchema.safeParse(body);
  if (!validationResult.success) {
    const zodError = validationResult as {
      success: false;
      error: { errors: unknown[] };
    };
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: zodError.error.errors,
      }),
      {
        status: 400,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { token } = validationResult.data;

  const payload = await verifySuperAdminToken(token);
  if (!payload || payload.type !== "super_admin") {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      {
        status: 401,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Generate new token
  const newToken = await createSuperAdminToken({
    super_admin_id: payload.super_admin_id,
    role: payload.role,
    type: "super_admin",
  });

  // Update session -- match login session expiry (8 hours)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8);

  await supabase
    .from("super_admin_sessions")
    .update({
      token: newToken,
      expires_at: expiresAt.toISOString(),
    })
    .eq("token", token);

  return new Response(
    JSON.stringify({ token: newToken }),
    {
      status: 200,
      headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
    },
  );
}
