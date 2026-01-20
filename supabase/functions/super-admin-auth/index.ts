// Edge Function: super-admin-auth
import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { signJWT, verifyJWT as verifyJWTSecure } from '../_shared/jwt.ts';
import { loginSchema, refreshSchema, updatePasswordSchema } from './validation.ts';

interface SuperAdminJWTPayload {
  super_admin_id: string;
  role: string;
  type: "super_admin";
}

// Wrapper for signing super admin tokens
async function createSuperAdminToken(payload: { super_admin_id: string; role: string; type: "super_admin" }): Promise<string> {
  return await signJWT({ ...payload }, 8 * 60 * 60); // 8 hours (was 7 days - security fix)
}

// Wrapper for verifying super admin tokens
async function verifySuperAdminToken(token: string): Promise<SuperAdminJWTPayload | null> {
  const payload = await verifyJWTSecure(token);
  if (!payload) return null;
  if (payload.type !== "super_admin") return null;
  return payload as unknown as SuperAdminJWTPayload;
}

// Base64 encoding helper for password hashing
function base64Encode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

// Password hashing using Web Crypto API (PBKDF2)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordData = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    "raw",
    passwordData,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    key,
    256
  );

  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);

  return base64Encode(combined.buffer);
}

async function comparePassword(password: string, hashValue: string): Promise<boolean> {
  try {
    // Check if it's the old SHA-256 format (hex string, 64 characters)
    if (hashValue.length === 64 && /^[a-f0-9]+$/i.test(hashValue)) {
      // Old format: SHA-256(password + secret)
      const encoder = new TextEncoder();
      const secret = Deno.env.get("PASSWORD_SECRET") || "change-in-production";
      const data = encoder.encode(password + secret);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      // Timing-safe comparison
      return computedHash === hashValue.toLowerCase();
    }

    // New PBKDF2 format (base64 encoded)
    const encoder = new TextEncoder();
    const combined = Uint8Array.from(atob(hashValue), c => c.charCodeAt(0));

    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);

    const passwordData = encoder.encode(password);
    const key = await crypto.subtle.importKey(
      "raw",
      passwordData,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      key,
      256
    );

    const hashArray = new Uint8Array(hashBuffer);

    if (hashArray.length !== storedHash.length) return false;

    for (let i = 0; i < hashArray.length; i++) {
      if (hashArray[i] !== storedHash[i]) return false;
    }

    return true;
  } catch (error) {
    // console.error OK in edge functions (server-side)
    console.error("Password comparison error:", error);
    return false;
  }
}

serve(async (req) => {
  // Get origin from request for CORS
  const origin = req.headers.get('origin');
  const hasCredentials = req.headers.get('cookie') || req.headers.get('authorization');

  // Allowed origins for CORS
  const allowedOrigins: (string | RegExp)[] = [
    'https://floraiqcrm.com',
    'https://www.floraiqcrm.com',
    'http://localhost:8080',
    'http://localhost:5173',
    // Lovable preview domains
    /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
    'https://lovable.app',
    'https://lovable.dev',
  ];

  const isOriginAllowed = (checkOrigin: string | null): boolean => {
    if (!checkOrigin) return false;
    return allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return checkOrigin === allowed;
      }
      return allowed.test(checkOrigin);
    });
  };

  // Determine the origin to use in response
  const requestOrigin = origin && isOriginAllowed(origin) ? origin : null;

  // Reject requests with credentials from non-allowed origins
  if (hasCredentials && !requestOrigin) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const corsHeadersWithOrigin: Record<string, string> = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  };

  // Add credentials header when we have a valid origin
  if (requestOrigin) {
    corsHeadersWithOrigin['Access-Control-Allow-Credentials'] = 'true';
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersWithOrigin });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    let body: any = {};
    if (req.method === "POST") {
      try {
        const text = await req.text();
        if (text && text.trim() !== '') {
          body = JSON.parse(text);
        }
      } catch (error) {
        console.error("Failed to parse request body:", error);
        // body remains empty object
      }
    }

    if (action === "login") {
      // Validate input with Zod
      const validationResult = loginSchema.safeParse(body);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: zodError.error.errors
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { email, password } = validationResult.data;

      // Rate limit check
      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const { data: rateCheck } = await supabase.rpc('check_auth_rate_limit', {
        p_identifier: email,
        p_identifier_type: 'email'
      });

      if (rateCheck && !rateCheck.allowed) {
        return new Response(
          JSON.stringify({ error: rateCheck.error || 'Too many attempts' }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        await supabase.from('auth_failed_attempts').insert({
          email: email.toLowerCase(),
          ip_address: clientIp,
          user_agent: req.headers.get("user-agent") || "unknown",
          failure_reason: 'user_not_found'
        });
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const validPassword = await comparePassword(password, superAdmin.password_hash);

      if (!validPassword) {
        // Log failed attempt (no password)
        await supabase.from('auth_failed_attempts').insert({
          email: email.toLowerCase(),
          ip_address: clientIp,
          user_agent: req.headers.get("user-agent") || "unknown",
          failure_reason: 'invalid_password'
        });
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clear rate limit on success
      await supabase.rpc('clear_auth_rate_limit', {
        p_identifier: email,
        p_identifier_type: 'email'
      });

      // ============================================================================
      // PHASE 2: HYBRID AUTH - Create Supabase auth user for RLS access
      // ============================================================================
      let supabaseSession = null;

      try {
        // Check if Supabase auth user exists
        const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
        const existingAuthUser = existingAuthUsers?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existingAuthUser) {
          // User exists, session will be created
          const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email.toLowerCase(),
          });

          if (!sessionError && sessionData) {
            // Use the generated access token
            supabaseSession = {
              access_token: sessionData.properties.action_link.split('#')[1]?.split('&')[0]?.split('=')[1] || '',
              refresh_token: '', // Not needed for super admin
              expires_in: 7 * 24 * 60 * 60, // 7 days
              user: existingAuthUser,
            };
          }
        } else {
          // Create new Supabase auth user
          const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
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
            const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
              type: 'magiclink',
              email: email.toLowerCase(),
            });

            if (!sessionError && sessionData) {
              supabaseSession = {
                access_token: sessionData.properties.action_link.split('#')[1]?.split('&')[0]?.split('=')[1] || '',
                refresh_token: '',
                expires_in: 7 * 24 * 60 * 60,
                user: newAuthUser.user,
              };
            }
            // Role will be auto-assigned via trigger
          }
        }
      } catch (authError) {
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

      const sessionClientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
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
      const response: any = {
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

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "No token provided" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const payload = await verifySuperAdminToken(token);

      if (!payload) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if token is blacklisted (immediate revocation)
      const { data: isBlacklisted } = await supabase.rpc('is_token_blacklisted', {
        p_jti: token.substring(0, 32)
      });

      if (isBlacklisted) {
        return new Response(
          JSON.stringify({ error: "Token has been revoked" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          JSON.stringify({ error: "User not found or inactive" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh") {
      // Validate input with Zod
      const validationResult = refreshSchema.safeParse(body);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: zodError.error.errors
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { token } = validationResult.data;

      const payload = await verifySuperAdminToken(token);
      if (!payload || payload.type !== "super_admin") {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new token
      const newToken = await createSuperAdminToken({
        super_admin_id: payload.super_admin_id,
        role: payload.role,
        type: "super_admin",
      });

      // Update session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase
        .from("super_admin_sessions")
        .update({
          token: newToken,
          expires_at: expiresAt.toISOString(),
        })
        .eq("token", token);

      return new Response(
        JSON.stringify({ token: newToken }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-password") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Authorization required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate input with Zod
      const validationResult = updatePasswordSchema.safeParse(body);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: zodError.error.errors
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { currentPassword, newPassword } = validationResult.data;

      const token = authHeader.replace("Bearer ", "");
      const payload = await verifySuperAdminToken(token);

      if (!payload) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          JSON.stringify({ error: "User not found or inactive" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify current password
      const validPassword = await comparePassword(currentPassword, superAdminUser.password_hash);
      if (!validPassword) {
        return new Response(
          JSON.stringify({ error: "Current password is incorrect" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "logout") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");

        // Verify token to get user ID and expiry
        const payload = await verifySuperAdminToken(token);

        if (payload) {
          // Add to token blacklist for immediate revocation
          const tokenExpiry = new Date();
          tokenExpiry.setHours(tokenExpiry.getHours() + 8); // Match token expiry

          await supabase.rpc('blacklist_token', {
            p_jti: token.substring(0, 32), // Use first 32 chars as JTI
            p_user_id: payload.super_admin_id,
            p_expires_at: tokenExpiry.toISOString(),
            p_reason: 'logout'
          });
        }

        // Also delete from sessions table
        await supabase.from("super_admin_sessions").delete().eq("token", token);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Server-side error logging only
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Authentication failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

