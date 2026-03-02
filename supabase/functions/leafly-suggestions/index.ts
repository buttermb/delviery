/**
 * Leafly Suggestions Edge Function
 * Provides strain/brand suggestions from Leafly API (when available)
 * Falls back to local database
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

// Request validation schema
const RequestSchema = z.object({
  query: z.string().min(1).max(255),
  type: z.enum(["brand", "strain"]),
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = RequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: (validationResult as { success: false; error: { errors: unknown[] } }).error.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { query, type } = validationResult.data;

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
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    // Handle validation errors separately
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

    // Handle other errors
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
});

