import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { trigger_type, payload } = await req.json();

        // Fetch enabled rules for this trigger
        const { data: rules, error } = await supabase
            .from("automation_rules")
            .select("*")
            .eq("trigger_type", trigger_type)
            .eq("enabled", true);

        if (error) throw error;

        const results = [];

        for (const rule of rules) {
            // Execute rule action
            console.log(`Executing rule ${rule.name} for trigger ${trigger_type}`);

            // Log execution
            await supabase.from("automation_rules").update({
                last_run_at: new Date().toISOString()
            }).eq("id", rule.id);

            results.push({ rule_id: rule.id, status: "executed" });
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to execute workflow';
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
