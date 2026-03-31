import { createClient } from '../_shared/deps.ts';
import type { SupabaseClient } from '../_shared/deps.ts';

/**
 * Shared types and utilities for tenant-admin-auth handlers
 */

export interface CorsHeaders {
  readonly 'Access-Control-Allow-Origin': string;
  readonly 'Access-Control-Allow-Headers': string;
  readonly 'Access-Control-Allow-Methods': string;
  readonly 'Access-Control-Allow-Credentials'?: string;
}

export type HandlerContext = {
  readonly req: Request;
  readonly supabase: SupabaseClient;
  readonly body: Record<string, unknown>;
  readonly corsHeaders: CorsHeaders;
};

/**
 * Creates a Supabase service role client (bypasses RLS)
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

/**
 * Creates a JSON error response with the given status and CORS headers
 */
export function errorResponse(
  corsHeaders: CorsHeaders,
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error, ...extra }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Creates a JSON success response with the given data and CORS headers
 */
export function jsonResponse(
  corsHeaders: CorsHeaders,
  data: Record<string, unknown>,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
    }
  );
}
