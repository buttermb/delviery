// Handler: update password
import { AUTH_ERRORS } from '../../_shared/auth-errors.ts';
import { updatePasswordSchema } from '../validation.ts';
import {
  comparePassword,
  hashPassword,
  verifySuperAdminToken,
  type HandlerContext,
} from '../utils.ts';

export async function handleUpdatePassword(
  ctx: HandlerContext,
): Promise<Response> {
  const { req, supabase, body } = ctx;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      {
        status: 401,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Validate input with Zod
  const validationResult = updatePasswordSchema.safeParse(body);
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

  const { currentPassword, newPassword } = validationResult.data;

  const token = authHeader.replace("Bearer ", "");
  const payload = await verifySuperAdminToken(token);

  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      {
        status: 401,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Get super admin user
  const { data: superAdminUser, error: adminError } = await supabase
    .from("super_admin_users")
    .select("*")
    .eq("id", payload.super_admin_id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError || !superAdminUser) {
    return new Response(
      JSON.stringify({ error: AUTH_ERRORS.UNAUTHORIZED }),
      {
        status: 401,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Verify current password
  const validPassword = await comparePassword(
    currentPassword,
    superAdminUser.password_hash,
  );
  if (!validPassword) {
    return new Response(
      JSON.stringify({ error: "Current password is incorrect" }),
      {
        status: 401,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update password
  const { error: updateError } = await supabase
    .from("super_admin_users")
    .update({ password_hash: newPasswordHash })
    .eq("id", superAdminUser.id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: "Failed to update password" }),
      {
        status: 500,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Password updated successfully" }),
    {
      status: 200,
      headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
    },
  );
}
