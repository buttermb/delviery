import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, firstName, lastName, email, phone, borough } = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Check if profile already exists
    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "Profile already exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate user ID code
    const { data: userIdCode } = await supabaseClient
      .rpc("generate_user_id_code", {
        p_user_id: userId,
        p_borough: borough || "Manhattan",
      });

    // Create profile
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert({
        user_id: userId,
        user_id_code: userIdCode,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        email: email,
        phone: phone,
      });

    if (profileError) throw profileError;

    // Log account creation
    await supabaseClient.from("account_logs").insert({
      user_id: userId,
      action_type: "account_created",
      description: "Account created",
    });

    return new Response(
      JSON.stringify({
        success: true,
        userIdCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Profile creation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});