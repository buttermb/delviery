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

        const { report_id, format } = await req.json();

        // Fetch report definition
        const { data: report, error } = await supabase
            .from("custom_reports")
            .select("*")
            .eq("id", report_id)
            .single();

        if (error) throw error;

        // Execute SQL query (Security Warning: This executes raw SQL from DB. Ensure only admins can create reports)
        // In a real app, you might want to restrict this or use a read-only user
        const { data: results, error: queryError } = await supabase.rpc("execute_sql", {
            sql_query: report.sql_query
        });

        if (queryError) throw queryError;

        // Format results
        let output = "";
        if (format === "csv") {
            // Simple CSV conversion
            if (results.length > 0) {
                const headers = Object.keys(results[0]);
                output = headers.join(",") + "\n";
                output += results.map(row => headers.map(h => JSON.stringify(row[h])).join(",")).join("\n");
            }
        } else {
            output = JSON.stringify(results);
        }

        return new Response(JSON.stringify({ success: true, url: "https://example.com/report.csv" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
