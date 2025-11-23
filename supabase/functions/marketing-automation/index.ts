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

        const { action, payload } = await req.json();

        if (action === "send_email") {
            // Placeholder for email sending logic (e.g., Resend)
            console.log("Sending email:", payload);
            // In a real app, you'd call Resend API here
            // await resend.emails.send({ ... })

            // Log the action
            await supabase.from("marketing_campaigns").update({
                status: "sent",
                sent_at: new Date().toISOString()
            }).eq("id", payload.campaign_id);

            return new Response(JSON.stringify({ success: true, message: "Email sent" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (action === "send_sms") {
            // Placeholder for SMS sending logic (e.g., Twilio)
            console.log("Sending SMS:", payload);

            await supabase.from("marketing_campaigns").update({
                status: "sent",
                sent_at: new Date().toISOString()
            }).eq("id", payload.campaign_id);

            return new Response(JSON.stringify({ success: true, message: "SMS sent" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        throw new Error(`Unknown action: ${action}`);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to execute marketing action';
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
