/**
 * CORS utility with origin validation
 *
 * Public endpoints (menus, webhooks, signup) use wildcard CORS.
 * Authenticated endpoints validate the Origin header against an allowlist.
 */

// Known production domains
const DEFAULT_ALLOWED_ORIGINS = [
  'https://floraiqcrm.com',
  'https://www.floraiqcrm.com',
  'https://app.floraiq.com',
  'https://app.floraiqcrm.com',
  'http://localhost:5173',   // Vite dev server
  'http://localhost:3000',   // Alternative dev
  'http://localhost:8080',
];

// Vercel preview URL pattern
const VERCEL_PREVIEW_PATTERN = /^https:\/\/floraiq[a-z0-9-]*\.vercel\.app$/;

/**
 * Get the list of allowed origins from defaults + ALLOWED_ORIGINS env var
 */
function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return [...DEFAULT_ALLOWED_ORIGINS, ...envOrigins.split(',').map(o => o.trim())];
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (getAllowedOrigins().includes(origin)) return true;
  if (VERCEL_PREVIEW_PATTERN.test(origin)) return true;
  return false;
}

/**
 * Get CORS headers for authenticated endpoints (validates origin)
 * Returns origin-specific headers if allowed, or restrictive headers if not.
 */
export function getAuthenticatedCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');

  if (origin && isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };
  }

  // No valid origin — return restrictive headers (no wildcard)
  return {
    'Access-Control-Allow-Origin': getAllowedOrigins()[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

/**
 * Public CORS headers (wildcard — for menus, webhooks, signup, etc.)
 * Use this for endpoints that must be accessible from any origin.
 */
export const publicCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
