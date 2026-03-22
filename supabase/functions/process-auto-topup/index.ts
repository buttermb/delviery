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
 * Rate limiting: Max 3 top-ups per hour to prevent runaway charges.
 *
 * To deploy:
 * supabase functions deploy process-auto-topup
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { errorResponse } from '../_shared/error-response.ts';

// Credit package pricing (must match creditCosts.ts CREDIT_PACKAGES)
const CREDIT_PACKAGES = [
  { credits: 500, priceCents: 1999 },    // Quick Boost
  { credits: 1500, priceCents: 4999 },   // Starter Pack
  { credits: 5000, priceCents: 12999 },  // Growth Pack
  { credits: 15000, priceCents: 29999 }, // Power Pack
];

// Rate limiting: max top-ups per hour
const MAX_TOPUPS_PER_HOUR = 3;

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
  last_topup_at: string | null;
}

/**
 * Check if the tenant has exceeded the hourly rate limit for top-ups.
 * Returns the count of top-ups in the last hour.
 */
async function getTopUpsInLastHour(
  supabase: any,
  tenantId: string
): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('transaction_type', 'purchase')
    .gte('created_at', oneHourAgo)
    .contains('metadata', { auto_topup: true });

  if (error) {
    console.error('[AUTO_TOPUP] Error checking hourly rate limit:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Send a failure notification to the tenant.
 */
async function sendFailureNotification(
  supabase: any,
  tenantId: string,
  errorMessage: string
): Promise<void> {
  await supabase.from('notifications').insert({
    tenant_id: tenantId,
    type: 'system',
    title: '⚠️ Auto Top-Up Failed',
    message: `Auto top-up could not be processed: ${errorMessage}. Please check your payment method.`,
    metadata: {
      auto_topup: true,
      error: true,
      error_message: errorMessage,
    },
  });
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

    // --- Auth check ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(401, 'Unauthorized');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse(401, 'Invalid token');
    }

    // Resolve tenant from authenticated user
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return errorResponse(403, 'Forbidden: no tenant membership');
    }
    // --- End auth check ---

    const body: RequestBody = await req.json();
    const { tenant_id, force = false } = body;

    if (!tenant_id) {
      return errorResponse(400, 'tenant_id is required');
    }

    // Verify the request tenant_id matches the authenticated user's tenant
    if (tenant_id !== tenantUser.tenant_id) {
      return errorResponse(403, 'Forbidden: tenant mismatch');
    }

    console.error(`[AUTO_TOPUP] Processing for tenant: ${tenant_id}`);

    // Get auto top-up config
    const { data: config, error: configError } = await supabase
      .from('credit_auto_topup')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (configError || !config) {
      return errorResponse(200, 'Auto top-up not configured');
    }

    const topupConfig = config as AutoTopUpConfig;

    // Validate config
    if (!topupConfig.enabled) {
      return errorResponse(200, 'Auto top-up is disabled');
    }

    if (!topupConfig.payment_method_id) {
      return errorResponse(200, 'No payment method configured');
    }

    // Check monthly limit
    if (topupConfig.topups_this_month >= topupConfig.max_per_month) {
      return errorResponse(200, 'Monthly top-up limit reached');
    }

    // Check hourly rate limit (max 3 top-ups per hour)
    const topUpsInLastHour = await getTopUpsInLastHour(supabase, tenant_id);
    if (topUpsInLastHour >= MAX_TOPUPS_PER_HOUR) {
      console.error(`[AUTO_TOPUP] Hourly rate limit reached for tenant ${tenant_id}: ${topUpsInLastHour} top-ups in last hour`);
      return errorResponse(429, 'Hourly rate limit reached', 'RATE_LIMITED', {
        topups_this_hour: topUpsInLastHour,
        max_per_hour: MAX_TOPUPS_PER_HOUR,
      });
    }

    // Get current balance
    const { data: credits, error: creditsError } = await supabase
      .from('tenant_credits')
      .select('balance')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (creditsError || !credits) {
      return errorResponse(200, 'Credits record not found');
    }

    // Check if below threshold (unless forced)
    if (!force && credits.balance > topupConfig.trigger_threshold) {
      return errorResponse(200, 'Above threshold', undefined, {
        balance: credits.balance,
        threshold: topupConfig.trigger_threshold,
      });
    }

    // Find the package matching the configured amount
    const packageInfo = CREDIT_PACKAGES.find(p => p.credits === topupConfig.topup_amount) 
      || CREDIT_PACKAGES[0]; // Default to smallest package

    console.error(`[AUTO_TOPUP] Charging ${packageInfo.priceCents} cents for ${packageInfo.credits} credits`);

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

        const errorMessage = stripeError.error?.message || 'Payment failed';

        // If payment fails, disable auto top-up to prevent repeated failures
        await supabase
          .from('credit_auto_topup')
          .update({ enabled: false })
          .eq('tenant_id', tenant_id);

        // Send failure notification
        await sendFailureNotification(supabase, tenant_id, errorMessage);

        // Track analytics for failure
        await supabase.from('credit_analytics').insert({
          tenant_id,
          event_type: 'auto_topup_failed',
          credits_at_event: credits.balance,
          metadata: {
            error: errorMessage,
            stripe_error_code: stripeError.error?.code,
            auto_topup_disabled: true,
          },
        });

        return errorResponse(200, 'Payment failed - auto top-up disabled', undefined, {
          stripe_error: errorMessage,
        });
      }

      paymentIntent = await stripeResponse.json();
    } catch (stripeErr) {
      console.error('[AUTO_TOPUP] Stripe request failed:', stripeErr);
      return errorResponse(500, 'Payment processing error');
    }

    if (paymentIntent.status !== 'succeeded') {
      console.error('[AUTO_TOPUP] Payment not succeeded:', paymentIntent.status);
      return errorResponse(200, 'Payment not completed', undefined, {
        payment_status: paymentIntent.status,
      });
    }

    console.error(`[AUTO_TOPUP] Payment succeeded: ${paymentIntent.id}`);

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

      return errorResponse(500, 'Payment succeeded but balance update failed - support notified');
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

    console.error(`[AUTO_TOPUP] Success! Added ${packageInfo.credits} credits. New balance: ${newBalance}`);

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
    return errorResponse(500, (error as Error).message || 'Internal server error');
  }
});







