/**
 * Shared utilities for storefront checkout handlers.
 */

import { corsHeaders } from "../_shared/deps.ts";

/** Build a JSON response with CORS headers and optional extra headers. */
export const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });

/** Extract client IP from request headers (Supabase/Cloudflare standard). */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Extract ZIP from delivery address string (last 5-digit group). */
export function extractZipFromAddress(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}
