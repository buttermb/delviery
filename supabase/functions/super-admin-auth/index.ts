import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Encode(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = base64Encode(JSON.stringify(jwtPayload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  // In production, use proper HMAC signing
  const signature = base64Encode(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
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

// Password hashing (bcrypt-like, simplified for Edge Function)
// In production, use proper bcrypt library
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (await req.json()).action;

    if (action === "login") {
      const { email, password } = await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find super admin user
      const { data: superAdmin, error: findError } = await supabase
        .from("super_admin_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("status", "active")
        .maybeSingle();

      if (findError || !superAdmin) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const validPassword = await comparePassword(password, superAdmin.password_hash);
      if (!validPassword) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate JWT token
      const token = encodeJWT({
        super_admin_id: superAdmin.id,
        role: superAdmin.role,
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

      return new Response(
        JSON.stringify({
          token,
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
      const { token } = await req.json();

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

