// Handler: login
import { corsHeaders } from '../../_shared/deps.ts';
import { AUTH_ERRORS } from '../../_shared/auth-errors.ts';
import { loginSchema } from '../validation.ts';
import {
  comparePassword,
  createSuperAdminToken,
  type HandlerContext,
} from '../utils.ts';

export async function handleLogin(ctx: HandlerContext): Promise<Response> {
  const { req, supabase, body } = ctx;

  // Validate input with Zod
  const validationResult = loginSchema.safeParse(body);
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { email, password } = validationResult.data;

  // Rate limit check
  const clientIp =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const { data: rateCheck } = await supabase.rpc("check_auth_rate_limit", {
    p_identifier: email,
    p_identifier_type: "email",
  });

  if (rateCheck && !rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: rateCheck.error || AUTH_ERRORS.RATE_LIMITED,
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Find super admin user
  const { data: superAdmin, error: findError } = await supabase
    .from("super_admin_users")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("status", "active")
    .maybeSingle();

  // Get super admin from database
  if (findError || !superAdmin) {
    // Log failed attempt (no password)
    await supabase.from("auth_failed_attempts").insert({
      email: email.toLowerCase(),
      ip_address: clientIp,
      user_agent: req.headers.get("user-agent") || "unknown",
      failure_reason: "user_not_found",
    });
    return new Response(
      JSON.stringify({ error: AUTH_ERRORS.INVALID_CREDENTIALS }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Verify password
  const validPassword = await comparePassword(
    password,
    superAdmin.password_hash,
  );

  if (!validPassword) {
    // Log failed attempt (no password)
    await supabase.from("auth_failed_attempts").insert({
      email: email.toLowerCase(),
      ip_address: clientIp,
      user_agent: req.headers.get("user-agent") || "unknown",
      failure_reason: "invalid_password",
    });
    return new Response(
      JSON.stringify({ error: AUTH_ERRORS.INVALID_CREDENTIALS }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Clear rate limit on success
  await supabase.rpc("clear_auth_rate_limit", {
    p_identifier: email,
    p_identifier_type: "email",
  });

  // ============================================================================
  // PHASE 2: HYBRID AUTH - Create Supabase auth user for RLS access
  // ============================================================================
  let supabaseSession = null;

  try {
    // Check if Supabase auth user exists
    const { data: existingAuthUsers } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    const existingAuthUser = existingAuthUsers?.users?.find(
      (u: { email?: string }) =>
        u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (existingAuthUser) {
      // User exists, session will be created
      const { data: sessionData, error: sessionError } =
        await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: email.toLowerCase(),
        });

      if (!sessionError && sessionData) {
        // Use the generated access token
        supabaseSession = {
          access_token:
            sessionData.properties.action_link
              .split("#")[1]
              ?.split("&")[0]
              ?.split("=")[1] || "",
          refresh_token: "", // Not needed for super admin
          expires_in: 7 * 24 * 60 * 60, // 7 days
          user: existingAuthUser,
        };
      }
    } else {
      // Create new Supabase auth user
      const { data: newAuthUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: email.toLowerCase(),
          email_confirm: true,
          user_metadata: {
            first_name: superAdmin.first_name,
            last_name: superAdmin.last_name,
            is_super_admin: true,
          },
        });

      if (createError) {
        // Non-fatal error, continue with custom JWT

        // Generate session for the new user
        const { data: sessionData, error: sessionError } =
          await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: email.toLowerCase(),
          });

        if (!sessionError && sessionData) {
          supabaseSession = {
            access_token:
              sessionData.properties.action_link
                .split("#")[1]
                ?.split("&")[0]
                ?.split("=")[1] || "",
            refresh_token: "",
            expires_in: 7 * 24 * 60 * 60,
            user: newAuthUser.user,
          };
        }
        // Role will be auto-assigned via trigger
      }
    }
  } catch (_authError) {
    // Non-fatal error, continue with custom JWT
    // Continue with custom JWT even if Supabase auth fails
  }

  // Generate custom JWT token (for super admin specific operations)
  const token = await createSuperAdminToken({
    super_admin_id: superAdmin.id,
    role: "super_admin",
    type: "super_admin",
  });

  // Create session record
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8); // 8 hours (was 7 days - security fix)

  const sessionClientIp =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const sessionUserAgent = req.headers.get("user-agent") || "unknown";

  await supabase.from("super_admin_sessions").insert({
    super_admin_id: superAdmin.id,
    token,
    ip_address: sessionClientIp,
    user_agent: sessionUserAgent,
    expires_at: expiresAt.toISOString(),
  });

  // Update last login
  await supabase
    .from("super_admin_users")
    .update({
      last_login_at: new Date().toISOString(),
      last_login_ip: clientIp,
    })
    .eq("id", superAdmin.id);

  // Return both custom JWT and Supabase session
  const response: Record<string, unknown> = {
    token,
    superAdmin: {
      id: superAdmin.id,
      email: superAdmin.email,
      first_name: superAdmin.first_name,
      last_name: superAdmin.last_name,
      role: "super_admin",
    },
  };

  // Include Supabase session if available
  if (supabaseSession) {
    response.supabaseSession = supabaseSession;
  }

  // Success

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
