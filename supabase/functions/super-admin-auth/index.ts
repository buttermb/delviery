import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { loginSchema, refreshSchema, updatePasswordSchema } from './validation.ts';

// JWT Secret (should be in environment variable)
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-in-production";

interface JWTPayload {
  super_admin_id: string;
  role: string;
  type: "super_admin";
  exp: number;
  iat: number;
}

// Simple JWT encoding (for production, use a proper JWT library)
function encodeJWT(payload: Omit<JWTPayload, "exp" | "iat">): string {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JWTPayload = {
    ...payload,
    exp: now + 7 * 24 * 60 * 60, // 7 days
    iat: now,
  };

  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Encode(encoder.encode(JSON.stringify(header)).buffer).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = base64Encode(encoder.encode(JSON.stringify(jwtPayload)).buffer).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  // In production, use proper HMAC signing
  const signatureData = `${encodedHeader}.${encodedPayload}.${JWT_SECRET}`;
  const signature = base64Encode(encoder.encode(signatureData).buffer).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // In production, verify HMAC signature properly
    const payload = JSON.parse(new TextDecoder().decode(base64Decode(parts[1])));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (payload.type !== "super_admin") return null;
    
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

function base64Decode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str).split("").map((c) => c.charCodeAt(0)));
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
      // console.log OK in edge functions (server-side)
      console.log('SHA-256 comparison - match:', computedHash === hashValue.toLowerCase());
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
  
  const requestOrigin = origin && isOriginAllowed(origin) ? origin : (origin || '*');
  
  const corsHeadersWithOrigin: Record<string, string> = {
    'Access-Control-Allow-Origin': hasCredentials ? requestOrigin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  };
  
  if (hasCredentials && requestOrigin !== '*') {
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
        return new Response(
          JSON.stringify({ 
            error: "Validation failed", 
            details: validationResult.error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { email, password } = validationResult.data;

      console.log('Login attempt for email:', email);

      // Find super admin user
      const { data: superAdmin, error: findError } = await supabase
        .from("super_admin_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("status", "active")
        .maybeSingle();

      console.log('Database lookup result:', {
        found: !!superAdmin,
        error: findError?.message,
        email: email.toLowerCase()
      });

      if (findError || !superAdmin) {
        console.log('User not found or error:', findError);
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log('Password hash format check:', {
        hashLength: superAdmin.password_hash.length,
        isHex: /^[a-f0-9]+$/i.test(superAdmin.password_hash)
      });

      // Verify password
      const validPassword = await comparePassword(password, superAdmin.password_hash);
      console.log('Password validation result:', validPassword);
      
      if (!validPassword) {
        console.log('Password verification failed');
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============================================================================
      // PHASE 2: HYBRID AUTH - Create Supabase auth user for RLS access
      // ============================================================================
      let supabaseSession = null;
      
      try {
        // Check if Supabase auth user exists
        const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
        const existingAuthUser = existingAuthUsers?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existingAuthUser) {
          // User exists, create session for them
          console.log('Existing Supabase auth user found, creating session');
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
          console.log('Creating new Supabase auth user for super admin');
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
            console.error('Failed to create Supabase auth user:', createError);
          } else if (newAuthUser.user) {
            console.log('Supabase auth user created successfully');
            
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

            // Role will be auto-assigned via trigger from Phase 1
            console.log('Super admin role will be auto-assigned via trigger');
          }
        }
      } catch (authError) {
        console.error('Supabase auth integration error (non-fatal):', authError);
        // Continue with custom JWT even if Supabase auth fails
      }

      // Generate custom JWT token (for super admin specific operations)
      const token = encodeJWT({
        super_admin_id: superAdmin.id,
        role: "super_admin",
        type: "super_admin",
      });

      // Create session record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      await supabase.from("super_admin_sessions").insert({
        super_admin_id: superAdmin.id,
        token,
        ip_address: clientIp,
        user_agent: userAgent,
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

      console.log('Login successful, returning hybrid auth response');

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
      const payload = verifyJWT(token);

      if (!payload) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
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
        return new Response(
          JSON.stringify({ 
            error: "Validation failed", 
            details: validationResult.error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { token } = validationResult.data;

      const payload = verifyJWT(token);
      if (!payload || payload.type !== "super_admin") {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new token
      const newToken = encodeJWT({
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
        return new Response(
          JSON.stringify({ 
            error: "Validation failed", 
            details: validationResult.error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { currentPassword, newPassword } = validationResult.data;

      const token = authHeader.replace("Bearer ", "");
      const payload = verifyJWT(token);

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
    console.error("Super admin auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Authentication failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

