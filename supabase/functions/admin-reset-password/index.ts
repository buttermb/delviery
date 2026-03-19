import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Resolve tenant_id from an authenticated user.
 * Checks tenant_users first, then falls back to tenant owner_email.
 */
async function resolveTenantId(supabase: any, userId: string, userEmail: string | undefined): Promise<string | null> {
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (tenantUser) {
    return tenantUser.tenant_id;
  }

  if (userEmail) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_email', userEmail)
      .maybeSingle();

    if (tenant) {
      return tenant.id;
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerToken = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(callerToken);
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is an admin
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('id, is_active')
      .eq('user_id', callerUser.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminUser) {
      console.error('[admin-reset-password] Non-admin attempted password reset', callerUser.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve caller's tenant
    const callerTenantId = await resolveTenantId(supabaseAdmin, callerUser.id, callerUser.email);
    if (!callerTenantId) {
      console.error('[admin-reset-password] Admin has no tenant association');
      return new Response(
        JSON.stringify({ error: 'Tenant not found or user not authorized' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Email and new password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error('[admin-reset-password] Password reset requested');

    // Find user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('[admin-reset-password] Error listing users:', listError);
      throw listError;
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
      console.error('[admin-reset-password] User not found');
      throw new Error("User not found");
    }

    // Verify the target user belongs to the same tenant
    const targetTenantId = await resolveTenantId(supabaseAdmin, user.id, user.email);

    // Also check if target is a customer in this tenant via profiles
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', callerTenantId)
      .maybeSingle();

    if (targetTenantId !== callerTenantId && !targetProfile) {
      console.error('[admin-reset-password] Target user not in admin tenant');
      return new Response(
        JSON.stringify({ error: 'Target user not found in your tenant' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error('[admin-reset-password] Found user, updating password');

    // Update password (service role used only after authorization confirmed)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('[admin-reset-password] Error updating password:', updateError);
      throw updateError;
    }

    console.error('[admin-reset-password] Password updated successfully');

    return new Response(
      JSON.stringify({ success: true, message: "Password updated successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('[admin-reset-password] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Password reset failed' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
