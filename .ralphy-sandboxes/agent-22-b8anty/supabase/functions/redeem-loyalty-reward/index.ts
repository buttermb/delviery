import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateRedeemLoyaltyReward, type RedeemLoyaltyRewardInput } from './validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const rawBody = await req.json();
    const { rewardId, customerId }: RedeemLoyaltyRewardInput = validateRedeemLoyaltyReward(rawBody);

    // SECURITY: Get authenticated user's tenant
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantUserError } = await supabaseClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantUserError || !tenantUser) {
      return new Response(
        JSON.stringify({ error: 'User not associated with a tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userTenantId = tenantUser.tenant_id;

    // SECURITY: Verify reward belongs to user's tenant
    const { data: reward, error: rewardError } = await supabaseClient
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .eq('tenant_id', userTenantId) // Enforce tenant isolation
      .single();

    if (rewardError || !reward) {
      return new Response(
        JSON.stringify({ error: 'Reward not found or not available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify customer belongs to same tenant
    const { data: customer, error: customerError } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('tenant_id', userTenantId) // Enforce tenant isolation
      .single();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get customer points balance (also enforce tenant)
    const { data: points, error: pointsError } = await supabaseClient
      .from('loyalty_points')
      .select('balance, lifetime_redeemed')
      .eq('client_id', customerId)
      .single();

    if (pointsError || !points) {
      return new Response(
        JSON.stringify({ error: 'Points balance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if customer has enough points
    if (points.balance < reward.points_required) {
      throw new Error('Insufficient points');
    }

    // Deduct points
    const { error: deductError } = await supabaseClient
      .from('loyalty_point_adjustments')
      .insert({
        tenant_id: reward.tenant_id,
        customer_id: customerId,
        points: -reward.points_required,
        adjustment_type: 'redeemed',
        reason: `Redeemed: ${reward.name}`,
      });

    if (deductError) throw deductError;

    // Update balance
    const { error: updateError } = await supabaseClient
      .from('loyalty_points')
      .update({
        balance: points.balance - reward.points_required,
        lifetime_redeemed: (points.lifetime_redeemed || 0) + reward.points_required,
      })
      .eq('client_id', customerId);

    if (updateError) throw updateError;

    // Generate redemption code
    const redemptionCode = `RWD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    return new Response(
      JSON.stringify({
        success: true,
        redemptionCode,
        reward: reward.name,
        pointsDeducted: reward.points_required,
        remainingBalance: points.balance - reward.points_required,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error redeeming reward:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
