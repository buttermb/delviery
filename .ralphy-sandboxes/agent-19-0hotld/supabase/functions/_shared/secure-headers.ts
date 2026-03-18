/**
 * Secure HTTP response headers for all edge functions.
 * Implements OWASP recommended security headers to prevent:
 * - MIME type sniffing attacks (X-Content-Type-Options)
 * - Clickjacking (X-Frame-Options)
 * - XSS attacks (X-XSS-Protection, Content-Security-Policy)
 * - Referrer information leakage (Referrer-Policy)
 */

export const secureHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Adds secure headers to an existing headers object.
 * Merges with any existing headers (e.g., CORS headers).
 */
export function withSecureHeaders(
  headers: Record<string, string>
): Record<string, string> {
  return { ...headers, ...secureHeaders };
}

/**
 * Wraps a handler to automatically apply secure headers to all responses.
 * Use this middleware to ensure every response includes security headers.
 *
 * @example
 * ```ts
 * import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
 *
 * serve(secureHeadersMiddleware(async (req) => {
 *   // Your handler logic - responses automatically get secure headers
 *   return new Response(JSON.stringify({ ok: true }), {
 *     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
 *   });
 * }));
 * ```
 */
export function secureHeadersMiddleware(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const response = await handler(req);

    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(secureHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}
