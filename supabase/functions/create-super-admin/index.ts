import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- AUTH CHECK: Verify caller is authenticated ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: callerAuthError } = await supabase.auth.getUser(jwt);

    if (callerAuthError || !callerUser) {
      console.error("Caller authentication failed:", callerAuthError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- AUTHZ CHECK: Verify caller is an existing super_admin ---
    const { data: callerSuperAdmin, error: callerRoleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (callerRoleError || !callerSuperAdmin) {
      // Also check super_admin_users table as fallback
      const { data: callerSuperAdminUser, error: saError } = await supabase
        .from("super_admin_users")
        .select("id, email, status")
        .eq("email", callerUser.email?.toLowerCase())
        .eq("status", "active")
        .maybeSingle();

      if (saError || !callerSuperAdminUser) {
        console.error("Caller is not a super_admin:", callerUser.id);
        return new Response(
          JSON.stringify({ error: "Forbidden: super_admin role required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { email, password, full_name } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Password complexity validation for super admin accounts
    const passwordErrors: string[] = [];
    if (password.length < 12) {
      passwordErrors.push("at least 12 characters");
    }
    if (!/[A-Z]/.test(password)) {
      passwordErrors.push("at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      passwordErrors.push("at least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
      passwordErrors.push("at least one digit");
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      passwordErrors.push("at least one special character");
    }
    if (passwordErrors.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Password does not meet complexity requirements",
          requirements: passwordErrors,
          message: `Password must contain: ${passwordErrors.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error(`[create-super-admin] Creating super admin user: ${email}`);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;
    console.error(`[create-super-admin] User created with ID: ${userId}`);

    // Add super_admin role to user_roles
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "super_admin",
      });

    if (roleError) {
      console.error("Role creation error:", roleError);
      // Cleanup: delete the auth user if role creation fails
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to assign super_admin role", details: roleError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error(`[create-super-admin] Super admin role assigned to user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          full_name: full_name || email,
          role: "super_admin",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
