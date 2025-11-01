import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-in-production";

interface JWTPayload {
  customer_user_id: string;
  customer_id: string;
  tenant_id: string;
  type: "customer";
  exp: number;
  iat: number;
}

function encodeJWT(payload: Omit<JWTPayload, "exp" | "iat">): string {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JWTPayload = {
    ...payload,
    exp: now + 30 * 24 * 60 * 60, // 30 days
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

    if (payload.type !== "customer") return null;
    
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

      // Find customer user
      const { data: customerUser, error: customerError } = await supabase
        .from("customer_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .maybeSingle();

      if (customerError || !customerUser) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const validPassword = await comparePassword(password, customerUser.password_hash);
      if (!validPassword) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get linked customer record if exists
      let customer = null;
      if (customerUser.customer_id) {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("id", customerUser.customer_id)
          .maybeSingle();
        customer = data;
      }

      // Generate JWT token
      const token = encodeJWT({
        customer_user_id: customerUser.id,
        customer_id: customerUser.customer_id || customerUser.id,
        tenant_id: tenant.id,
        type: "customer",
      });

      // Create session record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      await supabase.from("customer_sessions").insert({
        customer_user_id: customerUser.id,
        tenant_id: tenant.id,
        token,
        ip_address: clientIp,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
      });

      return new Response(
        JSON.stringify({
          token,
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
          customerRecord: customer,
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

    if (action === "logout") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        await supabase.from("customer_sessions").delete().eq("token", token);
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
    console.error("Customer auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Authentication failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

