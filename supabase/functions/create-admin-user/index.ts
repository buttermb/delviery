import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
      console.error("[create-admin-user] Caller authentication failed:", callerAuthError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- AUTHZ CHECK: Verify caller has admin or super_admin role ---
    const { data: callerRoles, error: callerRolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const callerRoleList = (callerRoles || []).map((r: { role: string }) => r.role);

    // Also check super_admin_users table as fallback for super_admin status
    let callerIsSuperAdmin = callerRoleList.includes("super_admin");
    if (!callerIsSuperAdmin) {
      const { data: saUser } = await supabase
        .from("super_admin_users")
        .select("id")
        .eq("email", callerUser.email?.toLowerCase())
        .eq("status", "active")
        .maybeSingle();
      callerIsSuperAdmin = !!saUser;
    }

    const callerIsAdmin = callerIsSuperAdmin || callerRoleList.includes("admin");

    if (!callerIsAdmin) {
      console.error("[create-admin-user] Caller lacks admin/super_admin role:", callerUser.id);
      return new Response(
        JSON.stringify({ error: "Forbidden: admin or super_admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, full_name, role, tenant_id } = await req.json();

    // Validate inputs
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- ROLE ESCALATION CHECK: Don't allow creating roles higher than caller's own ---
    const rolePriority: Record<string, number> = {
      super_admin: 4,
      owner: 3,
      admin: 2,
      member: 1,
      viewer: 0,
    };

    const requestedRole = role || "super_admin";
    const callerHighestRole = callerIsSuperAdmin ? "super_admin" : "admin";
    const callerPriority = rolePriority[callerHighestRole] ?? 0;
    const requestedPriority = rolePriority[requestedRole] ?? 0;

    if (requestedPriority > callerPriority) {
      console.error("[create-admin-user] Role escalation attempt:", {
        caller: callerUser.id,
        callerRole: callerHighestRole,
        requestedRole,
      });
      return new Response(
        JSON.stringify({ error: "Forbidden: cannot create a user with a higher role than your own" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- TENANT ISOLATION CHECK: Non-super-admins can only create admins for their own tenant ---
    if (!callerIsSuperAdmin && tenant_id) {
      // Verify caller belongs to the target tenant
      const { data: callerTenantUser } = await supabase
        .from("admin_users")
        .select("id, tenant_id")
        .eq("user_id", callerUser.id)
        .maybeSingle();

      const callerAdminData = callerTenantUser as { id: string; tenant_id?: string } | null;

      if (!callerAdminData || callerAdminData.tenant_id !== tenant_id) {
        console.error("[create-admin-user] Tenant isolation violation:", {
          caller: callerUser.id,
          callerTenant: callerAdminData?.tenant_id,
          targetTenant: tenant_id,
        });
        return new Response(
          JSON.stringify({ error: "Forbidden: cannot create admin users for a different tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // Step 2: Add 'admin' role to user_roles
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "admin",
      });

    if (roleError) {
      console.error("Role creation error:", roleError);
      // Cleanup: delete the auth user if role creation fails
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to assign admin role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Add entry to admin_users
    const { error: adminError } = await supabase
      .from("admin_users")
      .insert({
        user_id: userId,
        email,
        full_name: full_name || "Admin",
        role: requestedRole,
        is_active: true,
      });

    if (adminError) {
      console.error("Admin user creation error:", adminError);
      // Cleanup: delete the auth user and role if admin_users creation fails
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to create admin user record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          full_name: full_name || "Admin",
          role: requestedRole,
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
