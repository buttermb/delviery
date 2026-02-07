/**
 * Unified API Router
 * 
 * Single entry point for all edge function requests.
 * Routes requests to appropriate handlers based on path and method.
 * 
 * Benefits:
 * - Single deployment instead of 115+ functions
 * - Shared middleware (auth, rate limiting, logging)
 * - Easier to trace and debug
 * - Consistent error handling
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { ordersRouter } from './routes/orders.ts';
import { contactsRouter } from './routes/contacts.ts';
import { menusRouter } from './routes/menus.ts';
import { inventoryRouter } from './routes/inventory.ts';

// Type definitions
type RequestHandler = (req: Request, params: Record<string, string>) => Promise<Response>;

interface RouteConfig {
  pattern: RegExp;
  handler: RequestHandler;
}

// Build route table from all routers
const routes: Record<string, RouteConfig[]> = {
  'GET': [],
  'POST': [],
  'PUT': [],
  'PATCH': [],
  'DELETE': [],
};

// Helper to convert path pattern to regex
function pathToRegex(path: string): RegExp {
  const pattern = path
    .replace(/:\w+/g, '([^/]+)')  // Convert :param to capture group
    .replace(/\//g, '\\/');        // Escape slashes
  return new RegExp(`^${pattern}$`);
}

// Register routes from routers
function registerRoutes(router: Record<string, RequestHandler>) {
  for (const [key, handler] of Object.entries(router)) {
    const [method, path] = key.split(' ');
    if (routes[method]) {
      routes[method].push({
        pattern: pathToRegex(path),
        handler,
      });
    }
  }
}

// Register all routers
registerRoutes(ordersRouter);
registerRoutes(contactsRouter);
registerRoutes(menusRouter);
registerRoutes(inventoryRouter);

// Middleware: Extract user from JWT
async function extractUser(req: Request): Promise<{ userId: string | null; tenantId: string | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, tenantId: null };
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { userId: null, tenantId: null };
  }

  // Get tenant from tenant_users
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  return {
    userId: user.id,
    tenantId: tenantUser?.tenant_id ?? null,
  };
}

// Middleware: Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Extract path (remove /api prefix if present)
    const url = new URL(req.url);
    let path = url.pathname.replace(/^\/api/, '');
    if (!path.startsWith('/')) path = '/' + path;

    // Rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find matching route
    const methodRoutes = routes[req.method];
    if (!methodRoutes) {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    for (const route of methodRoutes) {
      const match = path.match(route.pattern);
      if (match) {
        // Extract path parameters
        const params: Record<string, string> = {};
        // This is a simplified param extraction - in real impl, map capture groups to param names
        if (match.length > 1) {
          params['id'] = match[1];
        }

        // Add request context
        const enhancedReq = new Request(req.url, {
          method: req.method,
          headers: new Headers({
            ...Object.fromEntries(req.headers),
            'x-request-id': requestId,
          }),
          body: req.body,
        });

        // Execute handler
        const response = await route.handler(enhancedReq, params);
        
        // Add standard headers to response
        const responseHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });
        responseHeaders.set('x-request-id', requestId);
        responseHeaders.set('x-response-time', `${Date.now() - startTime}ms`);

        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }
    }

    // No route matched
    return new Response(
      JSON.stringify({ 
        error: 'Not found', 
        path,
        method: req.method,
        availableRoutes: Object.keys(routes).flatMap(method => 
          routes[method].map(r => `${method} ${r.pattern.source}`)
        )
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('API Router Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        requestId,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

