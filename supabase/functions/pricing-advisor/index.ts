import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const { orderVolume } = await req.json();
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY"); // Or generic LLM key

        // Mock AI logic if no API key present (safe fallback)
        if (!LOVABLE_API_KEY) {
            let recommendation = "";
            if (orderVolume === 'light') recommendation = "We recommend starting with the **FREE TIER**. It includes 500 monthly credits, which is perfect for 1-5 orders/day. No credit card required to start.";
            else if (orderVolume === 'medium') recommendation = "The **STARTER PLAN ($79/mo)** is our top pick for you. With 5-20 orders/day, you'll benefit from unlimited usage and 2 location support. Try it free for 14 days.";
            else recommendation = "For high volume (20+ orders/day), the **PROFESSIONAL PLAN ($150/mo)** offers the automation and advanced CRM features your business needs to scale. Start your 14-day free trial today.";

            return new Response(JSON.stringify({ recommendation }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const systemPrompt = `You are a helpful pricing advisor for FloraIQ, a cannabis distribution software.
    FREE TIER: 500 credits/month, no credit card required. Good for ~5 orders/day, small startups.
    STARTER ($79/mo): Unlimited usage, 14-day trial, credit card required. Best for active businesses with 1-2 locations.
    PROFESSIONAL ($150/mo): Advanced automation, best for growing teams, 500+ customers.

    Based on the user's order volume, recommend the SINGLE best starting point. Be encouraging and concise (2-3 sentences max).`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `User order volume: ${orderVolume}` }
                ],
            }),
        });

        const data = await response.json();
        const recommendation = data.choices?.[0]?.message?.content || "We recommend starting with the free tier to explore!";

        return new Response(JSON.stringify({ recommendation }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
