// Edge Function: tenant-admin-auth
import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import { handleLogin } from './handlers/login.ts';
import { handleRefresh } from './handlers/refresh.ts';
import { handleLogout } from './handlers/logout.ts';
import { handleSetupPassword } from './handlers/setup-password.ts';
import { handleImpersonate } from './handlers/impersonate.ts';
import { handleVerify } from './handlers/verify.ts';
import type { CorsHeaders } from './utils.ts';

serve(secureHeadersMiddleware(async (req) => {
  // Get origin from request for CORS (required when credentials are included)
  const origin = req.headers.get('origin');
  const hasCredentials = req.headers.get('cookie') || req.headers.get('authorization');

  // When credentials are included, must return specific origin, not wildcard
  const allowedOrigins: (string | RegExp)[] = [
    'https://floraiqcrm.com',
    'https://www.floraiqcrm.com',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
    // Lovable preview domains
    /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
    'https://lovable.app',
    'https://lovable.app',
    'https://lovable.dev',
    // Vercel domains
    /^https:\/\/.*\.vercel\.app$/,
  ];

  const isOriginAllowed = (checkOrigin: string | null): boolean => {
    if (!checkOrigin) return false;
    return allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return checkOrigin === allowed;
      }
      return allowed.test(checkOrigin);
    });
  };

  const requestOrigin = origin && isOriginAllowed(origin) ? origin : null;

  // Reject requests with credentials from non-allowed origins
  if (hasCredentials && !requestOrigin) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const corsHeadersWithOrigin: CorsHeaders = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    ...(requestOrigin ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeadersWithOrigin });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Health check endpoint - no auth required
    if (action === 'health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          function: 'tenant-admin-auth',
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Only parse JSON body for actions that need it
    let requestBody: Record<string, unknown> = {};
    if (action !== 'verify' && action !== 'logout' && req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        requestBody = {};
      }
    }

    // Route to the appropriate handler
    switch (action) {
      case 'login':
        return await handleLogin(req, supabase, requestBody, corsHeadersWithOrigin);
      case 'refresh':
        return await handleRefresh(req, supabase, requestBody, corsHeadersWithOrigin);
      case 'logout':
        return await handleLogout(req, supabase, corsHeadersWithOrigin);
      case 'setup-password':
        return await handleSetupPassword(req, supabase, requestBody, corsHeadersWithOrigin);
      case 'impersonate':
        return await handleImpersonate(req, supabase, requestBody, corsHeadersWithOrigin);
      case 'verify':
        return await handleVerify(req, supabase, corsHeadersWithOrigin);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    console.error('Error in tenant-admin-auth:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
    );
  }
}));
