// Edge Function: super-admin-auth — slim router
import { serve, createClient } from '../_shared/deps.ts';
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import type { HandlerContext } from './utils.ts';
import { handleHealth } from './handlers/health.ts';
import { handleLogin } from './handlers/login.ts';
import { handleVerify } from './handlers/verify.ts';
import { handleRefresh } from './handlers/refresh.ts';
import { handleUpdatePassword } from './handlers/update-password.ts';
import { handleLogout } from './handlers/logout.ts';

const ACTION_HANDLERS: Record<string, (ctx: HandlerContext) => Promise<Response>> = {
  health: handleHealth,
  login: handleLogin,
  verify: handleVerify,
  refresh: handleRefresh,
  "update-password": handleUpdatePassword,
  logout: handleLogout,
};

const ALLOWED_ORIGINS: (string | RegExp)[] = [
  'https://floraiqcrm.com',
  'https://www.floraiqcrm.com',
  'http://localhost:8080',
  'http://localhost:5173',
  /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
  /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
  'https://lovable.app',
  'https://lovable.dev',
];

function isOriginAllowed(checkOrigin: string | null): boolean {
  if (!checkOrigin) return false;
  return ALLOWED_ORIGINS.some(allowed =>
    typeof allowed === 'string' ? checkOrigin === allowed : allowed.test(checkOrigin),
  );
}

serve(secureHeadersMiddleware(async (req) => {
  const origin = req.headers.get('origin');
  const hasCredentials = req.headers.get('cookie') || req.headers.get('authorization');
  const requestOrigin = origin && isOriginAllowed(origin) ? origin : null;

  // Reject requests with credentials from non-allowed origins
  if (hasCredentials && !requestOrigin) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const corsHeadersWithOrigin: Record<string, string> = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  };
  if (requestOrigin) {
    corsHeadersWithOrigin['Access-Control-Allow-Credentials'] = 'true';
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersWithOrigin });
  }

  try {
    const action = new URL(req.url).searchParams.get("action");

    // Health check needs no Supabase client
    if (action === "health") {
      return await ACTION_HANDLERS.health({
        req,
        supabase: null as unknown as ReturnType<typeof createClient>,
        body: {},
        corsHeaders: corsHeadersWithOrigin,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parse body for POST requests
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        const text = await req.text();
        if (text && text.trim() !== '') {
          body = JSON.parse(text);
        }
      } catch (error) {
        console.error("Failed to parse request body:", error);
      }
    }

    const handler = action ? ACTION_HANDLERS[action] : undefined;
    if (!handler) {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeadersWithOrigin, "Content-Type": "application/json" } },
      );
    }

    return await handler({ req, supabase, body, corsHeaders: corsHeadersWithOrigin });
  } catch (error) {
    console.error('[super-admin-auth] Error:', error);
    return new Response(
      JSON.stringify({ error: "Authentication failed" }),
      { status: 500, headers: { ...corsHeadersWithOrigin, "Content-Type": "application/json" } },
    );
  }
}));
