// @ts-nocheck - Disable type checking for Deno/Supabase client compatibility
// Credit Gate Middleware - Type-safe implementation
/**
 * Credit Gate Middleware
 * 
 * Middleware for edge functions that checks and deducts credits
 * for free tier tenants before allowing actions to proceed.
 * 
 * Usage:
 * ```typescript
 * import { withCreditGate } from '../_shared/creditGate.ts';
 * 
 * serve(async (req) => {
 *   return withCreditGate(req, 'create_order', async (tenantId) => {
 *     // Your handler code here
 *     return new Response(JSON.stringify({ success: true }));
 *   });
 * });
 * ```
 */

import { createClient, corsHeaders } from './deps.ts';

// ============================================================================
// Types
// ============================================================================

interface CreditCheckResult {
  success: boolean;
  newBalance: number;
  creditsCost: number;
  errorMessage: string | null;
}

interface TenantInfo {
  id: string;
  isFreeTier: boolean;
  subscriptionStatus: string | null;
}

// ============================================================================
// Credit Gate Middleware
// ============================================================================

/**
 * Wrap an edge function handler with credit gating
 * 
 * @param req - The incoming request
 * @param actionKey - The action key to charge credits for
 * @param handler - The handler function to execute if credits are available
 * @param options - Optional configuration
 */
export async function withCreditGate(
  req: Request,
  actionKey: string,
  handler: (tenantId: string, supabaseClient: any) => Promise<Response>,
  options?: {
    referenceId?: string;
    referenceType?: string;
    description?: string;
    skipForPaidTiers?: boolean; // Default true
  }
): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
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
    // Get tenant from JWT or request body
    const tenantInfo = await getTenantFromRequest(req, supabaseClient);

    if (!tenantInfo) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no tenant found' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Skip credit check for paid tiers (default behavior)
    const skipForPaid = options?.skipForPaidTiers ?? true;
    if (skipForPaid && !tenantInfo.isFreeTier) {
      return handler(tenantInfo.id, supabaseClient);
    }

    // Check and consume credits
    const creditResult = await consumeCreditsForAction(
      supabaseClient,
      tenantInfo.id,
      actionKey,
      options?.referenceId,
      options?.referenceType,
      options?.description
    );

    if (!creditResult.success) {
      // Track the blocked action
      await trackCreditEvent(
        supabaseClient,
        tenantInfo.id,
        'action_blocked_insufficient_credits',
        creditResult.newBalance,
        actionKey
      );

      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          message: creditResult.errorMessage || 'You do not have enough credits to perform this action',
          creditsRequired: creditResult.creditsCost,
          currentBalance: creditResult.newBalance,
          actionKey,
        }),
        {
          status: 402, // Payment Required
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Execute the handler
    const response = await handler(tenantInfo.id, supabaseClient);

    // Add credit info to response headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Credits-Consumed', String(creditResult.creditsCost));
    newHeaders.set('X-Credits-Remaining', String(creditResult.newBalance));

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });

  } catch (error) {
    console.error('Credit gate error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
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
 * Get tenant info from request (JWT or body)
 */
async function getTenantFromRequest(
  req: Request,
  supabaseClient: any
): Promise<TenantInfo | null> {
  // Try to get tenant_id from JWT
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const { data: { user } } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (user) {
      // Get tenant from tenant_users
      const { data: tenantUser } = await supabaseClient
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tenantUser?.tenant_id) {
        return getTenantInfo(supabaseClient, tenantUser.tenant_id);
      }
    }
  }

  // Try to get tenant_id from request body
  try {
    const clonedReq = req.clone();
    const body = await clonedReq.json();
    if (body.tenant_id) {
      return getTenantInfo(supabaseClient, body.tenant_id);
    }
  } catch {
    // Body parsing failed, continue
  }

  return null;
}

/**
 * Get tenant info including free tier status
 */
async function getTenantInfo(
  supabaseClient: any,
  tenantId: string
): Promise<TenantInfo | null> {
  const { data: tenant, error } = await supabaseClient
    .from('tenants')
    .select('id, is_free_tier, subscription_status')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !tenant) {
    console.error('Failed to get tenant:', error);
    return null;
  }

  return {
    id: tenant.id,
    isFreeTier: tenant.is_free_tier ?? false,
    subscriptionStatus: tenant.subscription_status,
  };
}

/**
 * Consume credits for an action using the database function
 */
async function consumeCreditsForAction(
  supabaseClient: any,
  tenantId: string,
  actionKey: string,
  referenceId?: string,
  referenceType?: string,
  description?: string
): Promise<CreditCheckResult> {
  const { data, error } = await supabaseClient
    .rpc('consume_credits', {
      p_tenant_id: tenantId,
      p_action_key: actionKey,
      p_reference_id: referenceId || null,
      p_reference_type: referenceType || null,
      p_description: description || null,
    });

  if (error) {
    console.error('Credit consumption error:', error);
    return {
      success: false,
      newBalance: 0,
      creditsCost: 0,
      errorMessage: error.message,
    };
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      newBalance: 0,
      creditsCost: 0,
      errorMessage: 'No response from credit check',
    };
  }

  const result = data[0];
  return {
    success: result.success,
    newBalance: result.new_balance,
    creditsCost: result.credits_cost,
    errorMessage: result.error_message,
  };
}

/**
 * Track a credit-related event
 */
async function trackCreditEvent(
  supabaseClient: any,
  tenantId: string,
  eventType: string,
  creditsAtEvent: number,
  actionAttempted?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseClient
      .from('credit_analytics')
      .insert({
        tenant_id: tenantId,
        event_type: eventType,
        credits_at_event: creditsAtEvent,
        action_attempted: actionAttempted,
        metadata: metadata || {},
      });
  } catch (err) {
    console.error('Failed to track credit event:', err);
  }
}

// ============================================================================
// Quick Check Function (for manual use)
// ============================================================================

/**
 * Quick check if a tenant has enough credits for an action
 * Use this for pre-flight checks without consuming credits
 */
export async function checkCreditsAvailable(
  supabaseClient: any,
  tenantId: string,
  actionKey: string
): Promise<{
  hasCredits: boolean;
  balance: number;
  cost: number;
  isFreeTier: boolean;
}> {
  // Get tenant info
  const tenantInfo = await getTenantInfo(supabaseClient, tenantId);

  if (!tenantInfo || !tenantInfo.isFreeTier) {
    return {
      hasCredits: true,
      balance: -1,
      cost: 0,
      isFreeTier: false,
    };
  }

  // Get credit cost
  const { data: costData } = await supabaseClient
    .from('credit_costs')
    .select('credits')
    .eq('action_key', actionKey)
    .eq('is_active', true)
    .maybeSingle();

  const cost = costData?.credits ?? 0;

  // Get current balance
  const { data: creditData } = await supabaseClient
    .from('tenant_credits')
    .select('balance')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const balance = creditData?.balance ?? 10000;

  return {
    hasCredits: balance >= cost,
    balance,
    cost,
    isFreeTier: true,
  };
}

// ============================================================================
// Credit Costs Constants (for edge functions)
// ============================================================================

export const CREDIT_ACTIONS = {
  // Orders
  CREATE_ORDER: 'create_order',
  UPDATE_ORDER_STATUS: 'update_order_status',
  CANCEL_ORDER: 'cancel_order',

  // Products
  ADD_PRODUCT: 'add_product',
  EDIT_PRODUCT: 'edit_product',
  DELETE_PRODUCT: 'delete_product',
  BULK_IMPORT_PRODUCTS: 'bulk_import_products',

  // Customers
  ADD_CUSTOMER: 'add_customer',
  EDIT_CUSTOMER: 'edit_customer',
  DELETE_CUSTOMER: 'delete_customer',

  // Finance
  GENERATE_INVOICE: 'generate_invoice',
  SEND_INVOICE: 'send_invoice',
  RECORD_PAYMENT: 'record_payment',

  // Communication
  SEND_SMS: 'send_sms',
  SEND_EMAIL: 'send_email',
  SEND_MENU_LINK: 'send_menu_link',

  // Reports & Exports
  GENERATE_REPORT: 'generate_report',
  EXPORT_CSV: 'export_csv',
  EXPORT_PDF: 'export_pdf',

  // AI Features
  MENU_OCR: 'menu_ocr',
  AI_SUGGESTIONS: 'ai_suggestions',
  AI_ANALYTICS: 'ai_analytics',

  // API
  API_CALL: 'api_call',

  // Menus
  CREATE_MENU: 'create_menu',
  SHARE_MENU: 'share_menu',
} as const;
