import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

interface CreditBalance {
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  lifetime_expired: number;
  lifetime_refunded: number;
  last_purchase_at: string | null;
  last_used_at: string | null;
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

    // Extract user from JWT - never trust client data
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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
    // Note: is_free_tier column may not exist in all deployments
    const { data: tenantData, error: tenantInfoError } = await supabase
      .from('tenants')
      .select('subscription_status, subscription_plan')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantInfoError) {
      console.error('Error fetching tenant info:', tenantInfoError);
      // Non-fatal: continue with default free tier assumption
    }

    // Determine if user is on free tier
    // Paid plans (professional, enterprise) are NEVER free tier
    const isPaidPlan = tenantData?.subscription_plan === 'professional' ||
                       tenantData?.subscription_plan === 'enterprise';

    // Active subscription statuses (including 'trialing')
    const hasActiveSubscription = tenantData?.subscription_status === 'active' ||
                                   tenantData?.subscription_status === 'trial' ||
                                   tenantData?.subscription_status === 'trialing';

    // User is NOT free tier if they have a paid plan OR active subscription
    const isFreeTier = !(isPaidPlan || hasActiveSubscription);

    // Fetch credit balance
    const { data: credits, error: creditsError } = await supabase
      .from('credits')
      .select('balance, lifetime_purchased, lifetime_used, lifetime_expired, lifetime_refunded, last_purchase_at, last_used_at, created_at, updated_at')
      .eq('user_id', user.id)
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
    const creditBalance: CreditBalance = credits ?? {
      balance: 0,
      lifetime_purchased: 0,
      lifetime_used: 0,
      lifetime_expired: 0,
      lifetime_refunded: 0,
      last_purchase_at: null,
      last_used_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Fetch pending transactions (transactions not yet fully processed)
    const { data: pendingTransactions, error: pendingError } = await supabase
      .from('credit_transactions')
      .select('id, type, amount, description, reference_type, reference_id, created_at')
      .eq('user_id', user.id)
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
      .eq('user_id', user.id)
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
        earned: creditBalance.lifetime_purchased, // earned = total credits received
        spent: creditBalance.lifetime_used,
        purchased: creditBalance.lifetime_purchased,
        expired: creditBalance.lifetime_expired,
        refunded: creditBalance.lifetime_refunded,
      },
      subscription: subscriptionResponse,
      nextFreeGrantAt: null, // TODO: Calculate from tenant data if needed
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
