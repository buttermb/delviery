// Edge Function: customer-auth
import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import { handleHealth } from './handlers/health.ts';
import { handleSignup } from './handlers/signup.ts';
import { handleLogin } from './handlers/login.ts';
import { handleVerify } from './handlers/verify.ts';
import { handleLogout } from './handlers/logout.ts';
import { handleUpdatePassword } from './handlers/update-password.ts';
import { handleUpdateProfile } from './handlers/update-profile.ts';
import type { HandlerContext } from './handlers/types.ts';

serve(secureHeadersMiddleware(async (req) => {
  // Get origin from request for CORS
  const origin = req.headers.get('origin');
  const hasCredentials = req.headers.get('cookie') || req.headers.get('authorization');

  // Allowed origins for CORS
  const allowedOrigins: (string | RegExp)[] = [
    'https://floraiqcrm.com',
    'https://www.floraiqcrm.com',
    'http://localhost:8080',
    'http://localhost:5173',
    // Lovable preview domains
    /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
    'https://lovable.app',
    'https://lovable.dev',
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

  // Determine the origin to use in response
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

  const corsHeadersWithOrigin: Record<string, string> = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  };

  // Add credentials header when we have a valid origin
  if (requestOrigin) {
    corsHeadersWithOrigin['Access-Control-Allow-Credentials'] = 'true';
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersWithOrigin });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Health check needs no Supabase client or body parsing
    if (action === 'health') {
      return handleHealth({ req, supabase: null as unknown as HandlerContext['supabase'], supabaseUrl: '', supabaseKey: '', requestBody: {}, corsHeaders: corsHeadersWithOrigin });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse body for actions that use requestBody from the router level.
    // update-password and update-profile parse their own body internally.
    let requestBody: Record<string, unknown> = {};
    if (req.method === 'POST' && (action === 'signup' || action === 'login')) {
      try {
        requestBody = await req.json();
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        requestBody = {};
      }
    }

    const ctx: HandlerContext = { req, supabase, supabaseUrl, supabaseKey, requestBody, corsHeaders: corsHeadersWithOrigin };

    switch (action) {
      case "signup":
        return handleSignup(ctx);
      case "login":
        return handleLogin(ctx);
      case "verify":
        return handleVerify(ctx);
      case "logout":
        return handleLogout(ctx);
      case "update-password":
        return handleUpdatePassword(ctx);
      case "update-profile":
        return handleUpdateProfile(ctx);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Customer auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Authentication failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
