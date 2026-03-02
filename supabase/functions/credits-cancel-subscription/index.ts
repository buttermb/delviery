/**
 * Credits Cancel Subscription
 *
 * Cancels a credit subscription either immediately or at the end of the
 * current billing period. If cancelled immediately, optionally prorates
 * remaining credits. Updates both Stripe and local credit_subscriptions.
 *
 * Requires authentication - user must own the subscription.
 *
 * To deploy:
 * supabase functions deploy credits-cancel-subscription
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const requestSchema = z.object({
  subscription_id: z.string().uuid('subscription_id must be a valid UUID'),
  cancel_immediately: z.boolean().default(false),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stripe is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const body = await req.json();
    const parseResult = requestSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: (parseResult as { success: false; error: { issues: { message: string }[] } }).error.issues.map(i => i.message),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { subscription_id, cancel_immediately } = parseResult.data;

    // Fetch the credit subscription and verify ownership
    const { data: subscription, error: subError } = await supabase
      .from('credit_subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (subError) {
      console.error('[CREDITS_CANCEL_SUB] Error fetching subscription:', subError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscription) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check subscription is in a cancellable state
    if (subscription.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: false, error: 'Subscription is already cancelled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No Stripe subscription associated' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CREDITS_CANCEL_SUB] Cancelling subscription ${subscription_id} for user ${user.id}, immediately: ${cancel_immediately}`);

    // Update Stripe subscription
    if (cancel_immediately) {
      // Cancel immediately via Stripe API
      const stripeResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!stripeResponse.ok) {
        const stripeError = await stripeResponse.json();
        console.error('[CREDITS_CANCEL_SUB] Stripe cancel error:', stripeError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to cancel Stripe subscription',
            stripe_error: stripeError.error?.message,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Cancel at period end - update subscription
      const stripeResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'cancel_at_period_end': 'true',
          }),
        }
      );

      if (!stripeResponse.ok) {
        const stripeError = await stripeResponse.json();
        console.error('[CREDITS_CANCEL_SUB] Stripe update error:', stripeError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to update Stripe subscription',
            stripe_error: stripeError.error?.message,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate prorated credits to remove if cancelling immediately
    let creditsRemoved = 0;
    if (cancel_immediately && subscription.credits_remaining_this_period > 0) {
      const periodStart = new Date(subscription.current_period_start).getTime();
      const periodEnd = new Date(subscription.current_period_end).getTime();
      const now = Date.now();

      if (periodEnd > periodStart && periodEnd > now) {
        const totalPeriodMs = periodEnd - periodStart;
        const elapsedMs = now - periodStart;
        const remainingFraction = Math.max(0, 1 - (elapsedMs / totalPeriodMs));

        // Prorate: remove the fraction of credits for the unused period
        creditsRemoved = Math.floor(subscription.credits_remaining_this_period * remainingFraction);

        if (creditsRemoved > 0) {
          // Deduct prorated credits from user's balance
          const { data: currentCredits } = await supabase
            .from('credits')
            .select('balance')
            .eq('user_id', user.id)
            .eq('tenant_id', subscription.tenant_id)
            .maybeSingle();

          if (currentCredits && currentCredits.balance >= creditsRemoved) {
            const newBalance = currentCredits.balance - creditsRemoved;

            await supabase
              .from('credits')
              .update({
                balance: newBalance,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.id)
              .eq('tenant_id', subscription.tenant_id);

            // Log the proration transaction
            await supabase
              .from('credit_transactions')
              .insert({
                user_id: user.id,
                tenant_id: subscription.tenant_id,
                type: 'adjustment',
                amount: -creditsRemoved,
                balance_before: currentCredits.balance,
                balance_after: newBalance,
                description: 'Prorated credits removed due to immediate subscription cancellation',
                reference_type: 'subscription',
                reference_id: subscription.id,
                metadata: {
                  subscription_id: subscription.id,
                  stripe_subscription_id: subscription.stripe_subscription_id,
                  proration_fraction: remainingFraction,
                  period_start: subscription.current_period_start,
                  period_end: subscription.current_period_end,
                },
              });
          }
        }
      }
    }

    // Update credit_subscriptions record
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      cancel_at_period_end: !cancel_immediately,
      cancelled_at: now,
      updated_at: now,
    };

    if (cancel_immediately) {
      updateData.status = 'cancelled';
      updateData.credits_remaining_this_period = 0;
    }

    const { error: updateError } = await supabase
      .from('credit_subscriptions')
      .update(updateData)
      .eq('id', subscription_id);

    if (updateError) {
      console.error('[CREDITS_CANCEL_SUB] Error updating subscription record:', updateError);
      // Stripe was already updated, log the inconsistency
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Stripe cancelled but local update failed - please contact support',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log cancellation event to credit_analytics
    await supabase
      .from('credit_analytics')
      .insert({
        tenant_id: subscription.tenant_id,
        event_type: 'subscription_cancelled',
        metadata: {
          subscription_id: subscription.id,
          stripe_subscription_id: subscription.stripe_subscription_id,
          cancel_immediately,
          credits_removed: creditsRemoved,
          cancelled_by: user.id,
          previous_status: subscription.status,
          credits_per_period: subscription.credits_per_period,
          period_type: subscription.period_type,
        },
      });

    // Log to credit_transactions as an event record (if not already logged via proration)
    if (!cancel_immediately || creditsRemoved === 0) {
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          tenant_id: subscription.tenant_id,
          type: 'adjustment',
          amount: 0,
          balance_before: 0,
          balance_after: 0,
          description: cancel_immediately
            ? 'Credit subscription cancelled immediately'
            : 'Credit subscription set to cancel at period end',
          reference_type: 'subscription',
          reference_id: subscription.id,
          metadata: {
            event: 'subscription_cancelled',
            cancel_immediately,
            stripe_subscription_id: subscription.stripe_subscription_id,
          },
        });
    }

    console.log(`[CREDITS_CANCEL_SUB] Successfully cancelled subscription ${subscription_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id,
        cancel_immediately,
        status: cancel_immediately ? 'cancelled' : 'active',
        cancel_at_period_end: !cancel_immediately,
        credits_removed: creditsRemoved,
        current_period_end: subscription.current_period_end,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CREDITS_CANCEL_SUB] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
