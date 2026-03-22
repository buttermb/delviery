/**
 * Shared error response helpers for edge functions.
 *
 * Consistent error format across ALL edge functions:
 *
 *   { error: string }                          — minimal
 *   { error: string, code: string }            — with machine-readable code
 *   { error: string, details: unknown }        — with validation/extra info
 *   { error: string, code: string, details: unknown } — full
 *
 * Optional metadata fields (rate-limiting, locks, etc.) can be passed via
 * `details` so consumers always know where to look.
 *
 * Usage:
 *   import { errorResponse, errorJson } from '../_shared/error-response.ts';
 *
 *   return errorResponse(401, 'Unauthorized');
 *   return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', fieldErrors);
 *   return errorResponse(429, 'Too many requests', 'RATE_LIMITED', { retryAfter: 60 });
 */

import { corsHeaders } from './deps.ts';

/** JSON headers shared by every response. */
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' } as const;

/**
 * Build a standardised error JSON body.
 *
 * The envelope is always `{ error }` with optional `code` and `details`.
 */
export function errorJson(
  message: string,
  code?: string,
  details?: unknown,
): Record<string, unknown> {
  const body: Record<string, unknown> = { error: message };
  if (code) body.code = code;
  if (details !== undefined) body.details = details;
  return body;
}

/**
 * Return a `Response` with the standard error envelope, CORS headers, and the
 * appropriate status code.
 */
export function errorResponse(
  status: number,
  message: string,
  code?: string,
  details?: unknown,
): Response {
  return new Response(
    JSON.stringify(errorJson(message, code, details)),
    { status, headers: jsonHeaders },
  );
}
