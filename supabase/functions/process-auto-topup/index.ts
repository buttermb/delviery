// @ts-nocheck
/**
 * Process Auto Top-Up
 * 
 * Automatically charges the user's payment method and adds credits
 * when their balance falls below the configured threshold.
 * 
 * Can be triggered:
 * 1. Real-time after credit consumption
 * 2. Via scheduled check
 * 
 * To deploy:
 * supabase functions deploy process-auto-topup
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

// Credit package pricing (must match creditCosts.ts)
const CREDIT_PACKAGES = [
  { credits: 2500, priceCents: 1500 },
  { credits: 7500, priceCents: 4000 },
  { credits: 20000, priceCents: 9900 },
];

interface RequestBody {
  tenant_id: string;
  force?: boolean; // Force top-up even if above threshold (for manual trigger)
}

interface AutoTopUpConfig {
  id: string;
  tenant_id: string;
  enabled: boolean;
  trigger_threshold: number;
  topup_amount: number;
  max_per_month: number;
  topups_this_month: number;
  payment_method_id: string | null;
  stripe_customer_id: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { tenant_id, force = false } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTO_TOPUP] Processing for tenant: ${tenant_id}`);

    // Get auto top-up config
    const { data: config, error: configError } = await supabase
      .from('credit_auto_topup')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Auto top-up not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const topupConfig = config as AutoTopUpConfig;

    // Validate config
    if (!topupConfig.enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'Auto top-up is disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!topupConfig.payment_method_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No payment method configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check monthly limit
    if (topupConfig.topups_this_month >= topupConfig.max_per_month) {
      return new Response(
        JSON.stringify({ success: false, error: 'Monthly top-up limit reached' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current balance
    const { data: credits, error: creditsError } = await supabase
      .from('tenant_credits')
      .select('balance')
      .eq('tenant_id', tenant_id)
      .single();

    if (creditsError || !credits) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credits record not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if below threshold (unless forced)
    if (!force && credits.balance > topupConfig.trigger_threshold) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Above threshold',
          balance: credits.balance,
          threshold: topupConfig.trigger_threshold,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the package matching the configured amount
    const packageInfo = CREDIT_PACKAGES.find(p => p.credits === topupConfig.topup_amount) 
      || CREDIT_PACKAGES[0]; // Default to smallest package

    console.log(`[AUTO_TOPUP] Charging ${packageInfo.priceCents} cents for ${packageInfo.credits} credits`);

    // Process payment with Stripe
    let paymentIntent;
    try {
      const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'amount': packageInfo.priceCents.toString(),
          'currency': 'usd',
          'customer': topupConfig.stripe_customer_id || '',
          'payment_method': topupConfig.payment_method_id,
          'off_session': 'true',
          'confirm': 'true',
          'description': `Auto top-up: ${packageInfo.credits} credits`,
          'metadata[tenant_id]': tenant_id,
          'metadata[auto_topup]': 'true',
          'metadata[credits_amount]': packageInfo.credits.toString(),
        }),
      });

      if (!stripeResponse.ok) {
        const stripeError = await stripeResponse.json();
        console.error('[AUTO_TOPUP] Stripe error:', stripeError);
        
        // If payment fails, disable auto top-up to prevent repeated failures
        await supabase
          .from('credit_auto_topup')
          .update({ enabled: false })
          .eq('tenant_id', tenant_id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Payment failed - auto top-up disabled',
            stripe_error: stripeError.error?.message,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      paymentIntent = await stripeResponse.json();
    } catch (stripeErr) {
      console.error('[AUTO_TOPUP] Stripe request failed:', stripeErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Payment processing error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentIntent.status !== 'succeeded') {
      console.error('[AUTO_TOPUP] Payment not succeeded:', paymentIntent.status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment not completed',
          status: paymentIntent.status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTO_TOPUP] Payment succeeded: ${paymentIntent.id}`);

    // Add credits to balance
    const newBalance = credits.balance + packageInfo.credits;

    const { error: updateError } = await supabase
      .from('tenant_credits')
      .update({
        balance: newBalance,
        purchased_credits_balance: (credits.purchased_credits_balance || 0) + packageInfo.credits,
        lifetime_earned: (credits.lifetime_earned || 0) + packageInfo.credits,
      })
      .eq('tenant_id', tenant_id);

    if (updateError) {
      console.error('[AUTO_TOPUP] Failed to update balance:', updateError);
      // Payment was successful but balance update failed - log for manual resolution
      await supabase
        .from('credit_transactions')
        .insert({
          tenant_id,
          amount: packageInfo.credits,
          balance_after: newBalance,
          transaction_type: 'purchase',
          description: 'Auto top-up - BALANCE UPDATE FAILED',
          metadata: {
            auto_topup: true,
            stripe_payment_intent_id: paymentIntent.id,
            error: 'balance_update_failed',
          },
        });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment succeeded but balance update failed - support notified',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the transaction
    await supabase
      .from('credit_transactions')
      .insert({
        tenant_id,
        amount: packageInfo.credits,
        balance_after: newBalance,
        transaction_type: 'purchase',
        description: 'Auto top-up',
        metadata: {
          auto_topup: true,
          stripe_payment_intent_id: paymentIntent.id,
          price_cents: packageInfo.priceCents,
          trigger_threshold: topupConfig.trigger_threshold,
          balance_before: credits.balance,
        },
      });

    // Update auto top-up record
    await supabase
      .from('credit_auto_topup')
      .update({
        topups_this_month: topupConfig.topups_this_month + 1,
        last_topup_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant_id);

    // Track analytics
    await supabase
      .from('credit_analytics')
      .insert({
        tenant_id,
        event_type: 'auto_topup_success',
        credits_at_event: credits.balance,
        metadata: {
          credits_added: packageInfo.credits,
          price_cents: packageInfo.priceCents,
          new_balance: newBalance,
          topups_this_month: topupConfig.topups_this_month + 1,
        },
      });

    // Create notification for user
    await supabase
      .from('notifications')
      .insert({
        tenant_id,
        type: 'system',
        title: '✨ Credits Added',
        message: `Auto top-up added ${packageInfo.credits.toLocaleString()} credits to your account. New balance: ${newBalance.toLocaleString()}`,
        metadata: {
          auto_topup: true,
          credits_added: packageInfo.credits,
          price: packageInfo.priceCents / 100,
        },
      });

    console.log(`[AUTO_TOPUP] Success! Added ${packageInfo.credits} credits. New balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        credits_added: packageInfo.credits,
        new_balance: newBalance,
        price_cents: packageInfo.priceCents,
        payment_intent_id: paymentIntent.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AUTO_TOPUP] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});







