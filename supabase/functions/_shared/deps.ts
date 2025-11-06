/**
 * Shared dependencies for all edge functions
 * Single source of truth to prevent version conflicts and reduce build times
 */

// Standard library
export { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Supabase client (standardized to latest stable version)
export { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Bcrypt for password hashing
export { hash, compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// CORS headers (commonly used across all functions)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
