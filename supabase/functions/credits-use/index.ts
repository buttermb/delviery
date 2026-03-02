/**
 * Credits Use Edge Function
 *
 * Internal endpoint for consuming credits. Called by other features
 * that need to deduct credits from a user's balance.
 *
 * Requires authentication. Validates sufficient balance before deducting.
 * Calls update_credit_balance with type 'usage'.
 *
 * POST /credits-use
 * Body: { amount, reference_type, reference_id, description }
 * Returns: { success, new_balance, transaction_id }
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const RequestSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer'),
  reference_type: z.string().min(1, 'reference_type is required'),
  reference_id: z.string().min(1, 'reference_id is required'),
  description: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify authentication - extract user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'MISSING_AUTH' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          code: 'INVALID_REQUEST',
          details: (parseResult as { success: false; error: { errors: unknown[] } }).error.errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, reference_type, reference_id, description } = parseResult.data;

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantError || !tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found for user', code: 'NO_TENANT' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Call update_credit_balance with type 'usage'
    const { data: result, error: rpcError } = await supabase
      .rpc('update_credit_balance', {
        p_user_id: user.id,
        p_tenant_id: tenantId,
        p_amount: amount,
        p_transaction_type: 'usage',
        p_description: description || `Credit usage: ${reference_type}/${reference_id}`,
        p_reference_type: reference_type,
        p_reference_id: reference_id,
      });

    if (rpcError) {
      console.error('[CREDITS_USE] RPC error:', rpcError);
      return new Response(
        JSON.stringify({
          error: 'Failed to process credit usage',
          code: 'RPC_ERROR',
          message: rpcError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the operation was successful
    if (!result || !result.success) {
      const errorCode = result?.error === 'Insufficient credits'
        ? 'INSUFFICIENT_CREDITS'
        : 'USAGE_FAILED';

      return new Response(
        JSON.stringify({
          error: result?.error || 'Credit usage failed',
          code: errorCode,
          current_balance: result?.current_balance ?? 0,
          required: amount,
          shortfall: result?.shortfall ?? 0,
        }),
        {
          status: errorCode === 'INSUFFICIENT_CREDITS' ? 402 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[CREDITS_USE] Used ${amount} credits for tenant ${tenantId} (${reference_type}/${reference_id})`);

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: result.new_balance,
        transaction_id: result.transaction_id,
        amount_used: amount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CREDITS_USE] Error:', error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', code: 'VALIDATION_ERROR', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
