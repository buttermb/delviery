import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { rewardId, customerId } = await req.json();

    if (!rewardId || !customerId) {
      throw new Error('Reward ID and Customer ID are required');
    }

    // Get reward details
    const { data: reward, error: rewardError } = await supabaseClient
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError) throw rewardError;

    // Get customer points balance
    const { data: points, error: pointsError } = await supabaseClient
      .from('loyalty_points')
      .select('balance, lifetime_redeemed')
      .eq('client_id', customerId)
      .single();

    if (pointsError) throw pointsError;

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
