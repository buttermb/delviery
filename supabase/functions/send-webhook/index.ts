import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateSendWebhook } from './validation.ts';

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const rawBody = await req.json();
        const { webhook_id, payload } = validateSendWebhook(rawBody);

        // In a real implementation, fetch webhook URL from DB and POST payload
        console.error(`Sending webhook ${webhook_id} with payload`, payload);

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send webhook';
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
});
