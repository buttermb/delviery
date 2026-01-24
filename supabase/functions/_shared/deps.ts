/**
 * Shared dependencies for all edge functions
 * Single source of truth to prevent version conflicts and reduce build times
 * 
 * IMPORTANT: All edge functions MUST use this file for imports.
 * Do NOT import directly from deno.land or esm.sh in edge functions.
 */

// Standard library
export { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Supabase client (standardized to latest stable version)
export { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Zod for validation (standardized version)
export { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// CORS headers (commonly used across all functions)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secure response headers (OWASP recommended)
export { secureHeaders, withSecureHeaders, secureHeadersMiddleware } from './secure-headers.ts';
