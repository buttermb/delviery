import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";

/**
 * Bootstrap Tenant Owner
 * Creates a new user and links them to an existing tenant as owner.
 * Protected by a bootstrap secret header.
 */

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bootstrapSecret = Deno.env.get("BOOTSTRAP_SECRET") || "floraiq-bootstrap-2024";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    // Validate bootstrap secret (simple protection)
    const providedSecret = req.headers.get("x-bootstrap-secret");
    if (providedSecret !== bootstrapSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { tenantSlug, email, password, ownerName } = await req.json();

    if (!tenantSlug || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenantSlug, email, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Find tenant by slug
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, slug, business_name")
      .eq("slug", tenantSlug.toLowerCase())
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: `Tenant not found: ${tenantSlug}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bootstrap] Found tenant: ${tenant.business_name} (${tenant.id})`);

    // 2. Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      console.log(`[bootstrap] User already exists: ${existingUser.id}`);
      userId = existingUser.id;

      // Update password for existing user
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true,
      });

      if (updateError) {
        console.error("[bootstrap] Failed to update user password:", updateError);
        return new Response(
          JSON.stringify({ error: `Failed to update user: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[bootstrap] Updated password for user: ${userId}`);
    } else {
      // 3. Create new auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: ownerName || "Tenant Owner",
        },
      });

      if (createError || !newUser.user) {
        console.error("[bootstrap] Failed to create user:", createError);
        return new Response(
          JSON.stringify({ error: `Failed to create user: ${createError?.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
      console.log(`[bootstrap] Created new user: ${userId}`);
    }

    // 4. Check if tenant_users link already exists
    const { data: existingLink } = await supabase
      .from("tenant_users")
      .select("id, status")
      .eq("user_id", userId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (existingLink) {
      // Update existing link to active
      const { error: updateLinkError } = await supabase
        .from("tenant_users")
        .update({ status: "active", role: "owner" })
        .eq("id", existingLink.id);

      if (updateLinkError) {
        console.error("[bootstrap] Failed to update tenant link:", updateLinkError);
      } else {
        console.log(`[bootstrap] Updated existing tenant link to active`);
      }
    } else {
      // 5. Create tenant_users link with required email and name fields
      const { error: linkError } = await supabase
        .from("tenant_users")
        .insert({
          user_id: userId,
          tenant_id: tenant.id,
          email: email.toLowerCase(),
          name: ownerName || "Tenant Owner",
          role: "owner",
          status: "active",
          email_verified: true,
          accepted_at: new Date().toISOString(),
        });

      if (linkError) {
        console.error("[bootstrap] Failed to link user to tenant:", linkError);
        return new Response(
          JSON.stringify({ error: `Failed to link user to tenant: ${linkError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[bootstrap] Linked user ${userId} to tenant ${tenant.id}`);
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created and linked to tenant",
        user: {
          id: userId,
          email: email.toLowerCase(),
        },
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          business_name: tenant.business_name,
        },
        loginUrl: `/saas/login`,
        adminUrl: `/${tenant.slug}/admin/dashboard`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[bootstrap] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
