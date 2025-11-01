import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-in-production";

interface JWTPayload {
  tenant_admin_id: string;
  tenant_id: string;
  role: string;
  type: "tenant_admin";
  exp: number;
  iat: number;
}

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
  const signature = base64Encode(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64Decode(parts[1])));
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (payload.type !== "tenant_admin") return null;
    
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
      const { email, password, tenantSlug } = await req.json();

      if (!email || !password || !tenantSlug) {
        return new Response(
          JSON.stringify({ error: "Email, password, and tenant slug are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find tenant by slug
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", tenantSlug.toLowerCase())
        .eq("status", "active")
        .maybeSingle();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: "Tenant not found or inactive" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check tenant subscription status
      if (tenant.subscription_status !== "active" && tenant.subscription_status !== "trial") {
        return new Response(
          JSON.stringify({ error: "Tenant subscription is not active" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find tenant admin user
      const { data: admin, error: adminError } = await supabase
        .from("tenant_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .maybeSingle();

      if (adminError || !admin) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      if (!admin.password_hash) {
        return new Response(
          JSON.stringify({ error: "Password not set. Please contact your administrator." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validPassword = await comparePassword(password, admin.password_hash);
      if (!validPassword) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate JWT token
      const token = encodeJWT({
        tenant_admin_id: admin.id,
        tenant_id: tenant.id,
        role: admin.role,
        type: "tenant_admin",
      });

      // Create session record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      await supabase.from("tenant_admin_sessions").insert({
        tenant_admin_id: admin.id,
        tenant_id: tenant.id,
        token,
        ip_address: clientIp,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
      });

      // Update last login
      await supabase
        .from("tenant_users")
        .update({
          last_login_at: new Date().toISOString(),
        })
        .eq("id", admin.id);

      return new Response(
        JSON.stringify({
          token,
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            tenant_id: tenant.id,
          },
          tenant: {
            id: tenant.id,
            business_name: tenant.business_name,
            slug: tenant.slug,
            subscription_plan: tenant.subscription_plan,
            subscription_status: tenant.subscription_status,
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
        .from("tenant_admin_sessions")
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

      // Get tenant admin user
      const { data: admin, error: adminError } = await supabase
        .from("tenant_users")
        .select("*")
        .eq("id", payload.tenant_admin_id)
        .eq("status", "active")
        .maybeSingle();

      if (adminError || !admin) {
        return new Response(
          JSON.stringify({ error: "User not found or inactive" }),
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
          JSON.stringify({ error: "Tenant not found or inactive" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            tenant_id: tenant.id,
          },
          tenant: {
            id: tenant.id,
            business_name: tenant.business_name,
            slug: tenant.slug,
            subscription_plan: tenant.subscription_plan,
            subscription_status: tenant.subscription_status,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "logout") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        await supabase.from("tenant_admin_sessions").delete().eq("token", token);
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
    console.error("Tenant admin auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Authentication failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

