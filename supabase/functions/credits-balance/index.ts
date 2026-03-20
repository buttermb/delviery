import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

interface TenantCredits {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  free_credits_balance: number;
  purchased_credits_balance: number;
  free_credits_expires_at: string | null;
  last_free_grant_at: string | null;
  next_free_grant_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PendingTransaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

// Frontend-expected subscription format (camelCase)
interface SubscriptionInfo {
  status: 'active' | 'trial' | 'trialing' | 'cancelled' | 'past_due' | 'none';
  isFreeTier: boolean;
  creditsPerPeriod: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

// Frontend-expected response format (camelCase)
interface CreditsBalanceResponse {
  balance: number;
  lifetimeStats: {
    earned: number;
    spent: number;
    purchased: number;
    expired: number;
    refunded: number;
  };
  subscription: SubscriptionInfo;
  nextFreeGrantAt: string | null;
  pendingTransactions: number;
}

serve(async (req: Request) => {
  console.error('[credits-balance] === New request ===', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    console.error('[credits-balance] Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.error('[credits-balance] Processing request...');
    
    const authHeader = req.headers.get('Authorization');
    console.error('[credits-balance] Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[credits-balance] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client to bypass RLS for user validation
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract JWT token and validate it - never trust client data
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant from tenant_users
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantError) {
      console.error('Error fetching tenant user:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Failed to resolve tenant' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser?.tenant_id;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'No tenant found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch tenant info to determine free tier status
    const { data: tenantData, error: tenantInfoError } = await supabase
      .from('tenants')
      .select('subscription_status, subscription_plan, credits_enabled, is_free_tier')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantInfoError) {
      console.error('Error fetching tenant info:', tenantInfoError);
      // Non-fatal: continue with default free tier assumption
    }

    // Determine if user is on free tier
    // is_free_tier flag is the source of truth — set on free signup, cleared by stripe-webhook on paid subscription
    // Fallback to heuristics only when the flag is null/undefined (legacy tenants)
    const isPaidPlan = tenantData?.subscription_plan === 'professional' ||
                       tenantData?.subscription_plan === 'enterprise';
    const creditsDisabled = tenantData?.credits_enabled === false;

    const isFreeTier = tenantData?.is_free_tier != null
      ? tenantData.is_free_tier === true
      : creditsDisabled ? false : !isPaidPlan;

    // Fetch credit balance from tenant_credits table
    const { data: credits, error: creditsError } = await supabase
      .from('tenant_credits')
      .select('balance, lifetime_earned, lifetime_spent, free_credits_balance, purchased_credits_balance, free_credits_expires_at, last_free_grant_at, next_free_grant_at, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (creditsError) {
      console.error('Error fetching credits:', creditsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch credit balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no credits row exists, return zero balance
    const creditBalance: TenantCredits = credits ?? {
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      free_credits_balance: 0,
      purchased_credits_balance: 0,
      free_credits_expires_at: null,
      last_free_grant_at: null,
      next_free_grant_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Fetch pending transactions (transactions not yet fully processed)
    const { data: pendingTransactions, error: pendingError } = await supabase
      .from('credit_transactions')
      .select('id, transaction_type, amount, description, reference_type, reference_id, created_at')
      .eq('tenant_id', tenantId)
      .eq('transaction_type', 'debit')
      .order('created_at', { ascending: false })
      .limit(50);

    if (pendingError) {
      console.error('Error fetching pending transactions:', pendingError);
      // Non-fatal: continue with empty pending list
    }

    // Build subscription response in frontend-expected format (camelCase)
    const subscriptionResponse: SubscriptionInfo = {
      status: 'none',
      isFreeTier,
      creditsPerPeriod: 0,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };

    // Build response in frontend-expected format (camelCase)
    const response: CreditsBalanceResponse = {
      balance: creditBalance.balance,
      lifetimeStats: {
        earned: creditBalance.lifetime_earned,
        spent: creditBalance.lifetime_spent,
        purchased: creditBalance.purchased_credits_balance,
        expired: 0, // Not tracked in tenant_credits
        refunded: 0, // Not tracked in tenant_credits
      },
      subscription: subscriptionResponse,
      nextFreeGrantAt: creditBalance.next_free_grant_at,
      pendingTransactions: (pendingTransactions ?? []).length,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('credits-balance error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
