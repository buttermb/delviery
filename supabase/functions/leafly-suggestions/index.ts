import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, type } = await req.json();

    if (!query || !type) {
      return new Response(
        JSON.stringify({ error: "Missing query or type parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Leafly doesn't have a public API, so we'll use a web scraping approach
    // Note: This is a fallback - we'll primarily use local database
    // For production, you'd want to contact Leafly at api@leafly.com for API access
    
    // For now, return empty array - we'll use local database
    // In the future, this could be enhanced with:
    // 1. Leafly API partnership (contact api@leafly.com)
    // 2. Web scraping with proper rate limiting
    // 3. Third-party cannabis data APIs
    
    return new Response(
      JSON.stringify({ suggestions: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

