/**
 * Edge Function Template
 * 
 * Copy this template when creating new Edge Functions.
 * Follows all established rules and best practices.
 * 
 * File: supabase/functions/your-function-name/index.ts
 */

// 1. Import from shared deps
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// 2. Define Zod schema (MANDATORY!)
const RequestSchema = z.object({
  tenant_id: z.string().uuid(),
  // Add your fields here
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

type _RequestBody = z.infer<typeof RequestSchema>;

// 3. Wrap with withZenProtection
serve(withZenProtection(async (req) => {
  // 4. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 5. Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables");
    }

    // 6. Parse and validate request body
    const rawBody = await req.json();
    const body = RequestSchema.parse(rawBody);

    // 7. Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 8. Extract JWT user (if verify_jwt = true)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // 9. Verify tenant_id matches user's tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", body.tenant_id)
      .eq("status", "active")
      .maybeSingle();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized tenant access" }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // 10. Business logic here
    // ✅ ALWAYS filter queries by tenant_id
    const { data, error } = await supabase
      .from("table_name")
      .insert({
        ...body,
        tenant_id: body.tenant_id, // ✅ Required!
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // 11. Return success response
    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    // 12. Error handling
    console.error("Error in your-function-name:", error);

    // Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: "Validation failed", 
          details: error.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Generic error
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
}));

