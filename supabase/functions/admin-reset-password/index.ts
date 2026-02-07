import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, newPassword } = await req.json();
    
    if (!email || !newPassword) {
      throw new Error("Email and newPassword are required");
    }

    console.log(`[admin-reset-password] Attempting to reset password for: ${email}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error(`[admin-reset-password] Error listing users:`, listError);
      throw listError;
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
      console.error(`[admin-reset-password] User not found: ${email}`);
      throw new Error("User not found");
    }

    console.log(`[admin-reset-password] Found user: ${user.id}`);

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error(`[admin-reset-password] Error updating password:`, updateError);
      throw updateError;
    }

    console.log(`[admin-reset-password] Password updated successfully for: ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Password updated successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[admin-reset-password] Error:`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
