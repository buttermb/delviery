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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate JWT and extract claims
    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = data.claims.sub;

    // Get user's tenant from tenant_users
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', userId)
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
    // Paid plans (professional, enterprise) are NEVER free tier
    // If credits are disabled for tenant, they are NOT free tier (they're paid)
    const isPaidPlan = tenantData?.subscription_plan === 'professional' ||
                       tenantData?.subscription_plan === 'enterprise';

    // Active subscription statuses (including 'trialing')
    const hasActiveSubscription = tenantData?.subscription_status === 'active' ||
                                   tenantData?.subscription_status === 'trial' ||
                                   tenantData?.subscription_status === 'trialing';

    // Credits disabled means they're on a paid plan that doesn't use credits
    const creditsDisabled = tenantData?.credits_enabled === false;

    // User is NOT free tier if:
    // 1. Credits are disabled for their tenant
    // 2. They have a paid plan
    // 3. They have an active subscription
    const isFreeTier = creditsDisabled ? false : !(isPaidPlan || hasActiveSubscription);

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
      .select('id, type, amount, description, reference_type, reference_id, created_at')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('type', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (pendingError) {
      console.error('Error fetching pending transactions:', pendingError);
      // Non-fatal: continue with empty pending list
    }

    // Fetch active subscription if any
    const { data: subscription, error: subscriptionError } = await supabase
      .from('credit_subscriptions')
      .select('id, status, credits_per_period, period_type, current_period_start, current_period_end, credits_remaining_this_period, cancel_at_period_end')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (subscriptionError) {
      console.error('Error fetching subscription:', subscriptionError);
      // Non-fatal: continue with null subscription
    }

    // Build subscription response in frontend-expected format (camelCase)
    const subscriptionResponse: SubscriptionInfo = subscription
      ? {
          status: subscription.status as SubscriptionInfo['status'],
          isFreeTier,
          creditsPerPeriod: subscription.credits_per_period ?? 0,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        }
      : {
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
