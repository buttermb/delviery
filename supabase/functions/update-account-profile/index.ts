import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        const {
            data: { user },
        } = await supabaseClient.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        const { name, avatar_url } = await req.json();

        // 1. Update auth.users metadata
        const authUpdates: any = {};
        if (name) {
            authUpdates.full_name = name;
            authUpdates.name = name;
        }
        if (avatar_url) {
            authUpdates.avatar_url = avatar_url;
            authUpdates.picture = avatar_url;
        }

        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabaseClient.auth.updateUser({
                data: authUpdates,
            });
            if (authError) throw authError;
        }

        // 2. Update admin_users table
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const dbUpdates: any = {};
        if (name) dbUpdates.name = name;
        if (avatar_url) dbUpdates.avatar_url = avatar_url;

        let dbError = null;
        if (Object.keys(dbUpdates).length > 0) {
            const result = await supabaseAdmin
                .from("admin_users")
                .update(dbUpdates)
                .eq("user_id", user.id);
            dbError = result.error;
        }

        if (dbError) throw dbError;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
