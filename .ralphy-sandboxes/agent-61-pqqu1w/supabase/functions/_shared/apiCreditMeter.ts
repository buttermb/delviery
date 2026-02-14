// API Credit Metering Middleware - Type-safe implementation
/**
 * API Credit Metering Middleware
 * 
 * Specialized middleware for the public API that meters credit usage
 * based on HTTP method and endpoint.
 * 
 * Usage:
 * ```typescript
 * import { withApiCreditMeter } from '../_shared/apiCreditMeter.ts';
 * 
 * serve(async (req) => {
 *   return withApiCreditMeter(req, async (tenantId, supabase) => {
 *     // Your API handler code here
 *     return new Response(JSON.stringify({ data: [] }));
 *   });
 * });
 * ```
 */

import { createClient, corsHeaders } from './deps.ts';

// ============================================================================
// API Credit Costs Configuration
// ============================================================================

/**
 * Credit costs per API endpoint and method
 * Format: { 'METHOD /endpoint': credits }
 */
export const API_CREDIT_COSTS: Record<string, number> = {
  // Read operations - low cost
  'GET /orders': 1,
  'GET /orders/:id': 1,
  'GET /products': 1,
  'GET /products/:id': 1,
  'GET /customers': 1,
  'GET /customers/:id': 1,
  'GET /inventory': 1,
  'GET /menus': 1,
  'GET /menus/:id': 1,

  // Create operations - higher cost
  'POST /orders': 25,
  'POST /products': 10,
  'POST /customers': 5,
  'POST /inventory': 10,
  'POST /menus': 100,

  // Bulk operations - highest cost
  'POST /orders/bulk': 100,
  'POST /products/bulk': 50,
  'POST /customers/bulk': 50,
  'POST /inventory/bulk': 25,

  // Update operations - moderate cost
  'PUT /orders/:id': 10,
  'PATCH /orders/:id': 5,
  'PUT /products/:id': 5,
  'PATCH /products/:id': 3,
  'PUT /customers/:id': 3,
  'PATCH /customers/:id': 2,
  'PUT /inventory/:id': 3,
  'PATCH /inventory/:id': 2,

  // Delete operations - low cost (cleanup)
  'DELETE /orders/:id': 1,
  'DELETE /products/:id': 1,
  'DELETE /customers/:id': 1,

  // Communication endpoints - high cost
  'POST /sms/send': 25,
  'POST /email/send': 10,
  'POST /notifications/send': 15,

  // Analytics/Reports - moderate cost
  'GET /reports/:type': 25,
  'POST /reports/generate': 75,
  'GET /analytics/:type': 10,

  // Default fallbacks
  'GET *': 1,
  'POST *': 10,
  'PUT *': 5,
  'PATCH *': 3,
  'DELETE *': 1,
};

// ============================================================================
// Types
// ============================================================================

interface ApiCreditResult {
  success: boolean;
  creditsCost: number;
  newBalance: number;
  errorMessage?: string;
}

interface TenantInfo {
  id: string;
  isFreeTier: boolean;
  apiKey?: string;
}

// ============================================================================
// Main Middleware
// ============================================================================

/**
 * Wrap an API handler with credit metering
 */
export async function withApiCreditMeter(
  req: Request,
  handler: (tenantId: string, supabase: ReturnType<typeof createClient>) => Promise<Response>,
  options?: {
    customCost?: number;
    skipForPaidTiers?: boolean;
  }
): Promise<Response> {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    // Get tenant from API key
    const tenantInfo = await getTenantFromApiKey(req, supabase);

    if (!tenantInfo) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid or missing API key'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Skip credit check for paid tiers if option is set
    const skipForPaid = options?.skipForPaidTiers ?? true;
    if (skipForPaid && !tenantInfo.isFreeTier) {
      return handler(tenantInfo.id, supabase);
    }

    // Calculate credit cost for this request
    const creditCost = options?.customCost ?? getApiCreditCost(req);

    // Consume credits
    const result = await consumeApiCredits(supabase, tenantInfo.id, req, creditCost);

    if (!result.success) {
      // Log the blocked request
      await logApiUsage(supabase, tenantInfo.id, req, creditCost, false, result.errorMessage);

      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          message: result.errorMessage || 'You do not have enough credits for this API request',
          creditsRequired: result.creditsCost,
          currentBalance: result.newBalance,
          endpoint: getEndpointKey(req),
        }),
        {
          status: 402,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Credits-Required': String(result.creditsCost),
            'X-Credits-Balance': String(result.newBalance),
          }
        }
      );
    }

    // Execute the handler
    const response = await handler(tenantInfo.id, supabase);

    // Log successful usage
    await logApiUsage(supabase, tenantInfo.id, req, creditCost, true);

    // Add credit info to response headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Credits-Consumed', String(result.creditsCost));
    newHeaders.set('X-Credits-Remaining', String(result.newBalance));

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });

  } catch (error) {
    console.error('API credit meter error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: (error as Error).message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get tenant from API key header
 */
async function getTenantFromApiKey(
  req: Request,
  supabase: ReturnType<typeof createClient>
): Promise<TenantInfo | null> {
  // Try X-API-Key header
  const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return null;
  }

  // Look up tenant by API key
  const { data: apiKeyRecord, error } = await supabase
    .from('api_keys')
    .select('tenant_id, is_active')
    .eq('key_hash', await hashApiKey(apiKey))
    .eq('is_active', true)
    .maybeSingle();

  if (error || !apiKeyRecord) {
    // Try looking up by JWT if not found as API key
    const { data: { user } } = await supabase.auth.getUser(apiKey);
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.tenant_id) {
        return getTenantInfo(supabase, profile.tenant_id);
      }
    }
    return null;
  }

  return getTenantInfo(supabase, apiKeyRecord.tenant_id);
}

/**
 * Hash API key for lookup
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get tenant info including free tier status
 */
async function getTenantInfo(
  supabase: ReturnType<typeof createClient>,
  tenantId: string
): Promise<TenantInfo | null> {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, is_free_tier')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !tenant) {
    return null;
  }

  return {
    id: tenant.id,
    isFreeTier: tenant.is_free_tier ?? false,
  };
}

/**
 * Get endpoint key from request
 */
function getEndpointKey(req: Request): string {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/v\d+/, '').replace(/\/[a-f0-9-]{36}/g, '/:id');
  return `${req.method} ${path}`;
}

/**
 * Get credit cost for an API request
 */
function getApiCreditCost(req: Request): number {
  const endpointKey = getEndpointKey(req);

  // Try exact match first
  if (API_CREDIT_COSTS[endpointKey]) {
    return API_CREDIT_COSTS[endpointKey];
  }

  // Try wildcard match
  const wildcardKey = `${req.method} *`;
  if (API_CREDIT_COSTS[wildcardKey]) {
    return API_CREDIT_COSTS[wildcardKey];
  }

  // Default based on method
  switch (req.method) {
    case 'GET': return 1;
    case 'POST': return 10;
    case 'PUT': return 5;
    case 'PATCH': return 3;
    case 'DELETE': return 1;
    default: return 5;
  }
}

/**
 * Consume credits for an API request
 */
async function consumeApiCredits(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  req: Request,
  creditCost: number
): Promise<ApiCreditResult> {
  const endpointKey = getEndpointKey(req);

  const { data, error } = await supabase
    .rpc('consume_credits', {
      p_tenant_id: tenantId,
      p_action_key: 'api_call',
      p_reference_id: null,
      p_reference_type: 'api',
      p_description: `API: ${endpointKey}`,
      p_custom_cost: creditCost,
    });

  if (error) {
    console.error('API credit consumption error:', error);
    return {
      success: false,
      creditsCost: creditCost,
      newBalance: 0,
      errorMessage: error.message,
    };
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      creditsCost: creditCost,
      newBalance: 0,
      errorMessage: 'No response from credit system',
    };
  }

  const result = data[0];
  return {
    success: result.success,
    creditsCost: result.credits_cost || creditCost,
    newBalance: result.new_balance,
    errorMessage: result.error_message,
  };
}

/**
 * Log API usage for analytics
 */
async function logApiUsage(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  req: Request,
  creditCost: number,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    const url = new URL(req.url);

    await supabase
      .from('api_usage_logs')
      .insert({
        tenant_id: tenantId,
        method: req.method,
        endpoint: url.pathname,
        credits_cost: creditCost,
        success,
        error_message: error,
        ip_address: req.headers.get('X-Forwarded-For')?.split(',')[0] || null,
        user_agent: req.headers.get('User-Agent'),
      });
  } catch (err) {
    console.error('Failed to log API usage:', err);
  }
}

// ============================================================================
// Rate Limiting (optional enhancement)
// ============================================================================

/**
 * Check API rate limit (calls per minute)
 */
export async function checkApiRateLimit(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  maxRequestsPerMinute: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60000);

  const { count, error } = await supabase
    .from('api_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', minuteAgo.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: maxRequestsPerMinute, resetAt: new Date(now.getTime() + 60000) };
  }

  const requestCount = count || 0;
  const remaining = Math.max(0, maxRequestsPerMinute - requestCount);
  const resetAt = new Date(now.getTime() + 60000);

  return {
    allowed: requestCount < maxRequestsPerMinute,
    remaining,
    resetAt,
  };
}







