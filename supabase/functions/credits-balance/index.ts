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

interface SubscriptionStatus {
  id: string;
  status: string;
  credits_per_period: number;
  period_type: string;
  current_period_start: string | null;
  current_period_end: string | null;
  credits_remaining_this_period: number | null;
  cancel_at_period_end: boolean;
}

interface CreditsBalanceResponse {
  balance: number;
  lifetime_stats: {
    purchased: number;
    used: number;
    expired: number;
    refunded: number;
  };
  last_purchase_at: string | null;
  last_used_at: string | null;
  pending_transactions: PendingTransaction[];
  subscription: SubscriptionStatus | null;
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

    const response: CreditsBalanceResponse = {
      balance: creditBalance.balance,
      lifetime_stats: {
        purchased: creditBalance.lifetime_purchased,
        used: creditBalance.lifetime_used,
        expired: creditBalance.lifetime_expired,
        refunded: creditBalance.lifetime_refunded,
      },
      last_purchase_at: creditBalance.last_purchase_at,
      last_used_at: creditBalance.last_used_at,
      pending_transactions: pendingTransactions ?? [],
      subscription: subscription ?? null,
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
