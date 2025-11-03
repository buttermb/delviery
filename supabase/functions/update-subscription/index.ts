/**
 * Update Subscription Edge Function
 * Handles subscription plan upgrades/downgrades
 * Can work with or without Stripe integration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Plan configuration
const PLAN_LIMITS = {
  starter: {
    customers: 50,
    menus: 3,
    products: 100,
    locations: 1,
    users: 3,
  },
  professional: {
    customers: 200,
    menus: 10,
    products: 500,
    locations: 10,
    users: 10,
  },
  enterprise: {
    customers: -1, // unlimited
    menus: -1,
    products: -1,
    locations: -1,
    users: -1,
  },
};

const PLAN_FEATURES = {
  starter: {
    api_access: false,
    custom_branding: false,
    white_label: false,
    advanced_analytics: false,
    sms_enabled: false,
  },
  professional: {
    api_access: true,
    custom_branding: true,
    white_label: false,
    advanced_analytics: true,
    sms_enabled: true,
  },
  enterprise: {
    api_access: true,
    custom_branding: true,
    white_label: true,
    advanced_analytics: true,
    sms_enabled: true,
  },
};

const PLAN_PRICES = {
  starter: 99,
  professional: 299,
  enterprise: 600,
};

const TIER_NAMES = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id, new_plan, use_stripe = false } = await req.json();

    if (!tenant_id || !new_plan) {
      return new Response(
        JSON.stringify({ error: 'Missing tenant_id or new_plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['starter', 'professional', 'enterprise'].includes(new_plan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Must be starter, professional, or enterprise' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has permission (must be owner or admin)
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('email', user.email)
      .maybeSingle();

    if (!tenantUser || (tenantUser.role !== 'owner' && tenantUser.role !== 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentPlan = tenant.subscription_plan as 'starter' | 'professional' | 'enterprise';
    const newPlan = new_plan as 'starter' | 'professional' | 'enterprise';
    
    // Plan hierarchy for comparison
    const planHierarchy = ['starter', 'professional', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const newIndex = planHierarchy.indexOf(newPlan);

    // If using Stripe, create checkout session
    if (use_stripe) {
      const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
      
      if (!STRIPE_SECRET_KEY) {
        return new Response(
          JSON.stringify({ error: 'Stripe not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Import Stripe SDK
      const stripe = await import('https://esm.sh/stripe@14.21.0?target=deno');
      const stripeClient = stripe.default(STRIPE_SECRET_KEY);

      // Create or get Stripe customer
      let stripeCustomerId = tenant.stripe_customer_id;
      
      if (!stripeCustomerId) {
        const customer = await stripeClient.customers.create({
          email: tenant.owner_email,
          name: tenant.business_name,
          metadata: {
            tenant_id: tenant.id,
          },
        });
        stripeCustomerId = customer.id;
      }

      // Calculate proration for mid-cycle changes
      let subscriptionParams: any = {
        customer: stripeCustomerId,
        items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)} Plan`,
              description: `Monthly subscription for ${newPlan} plan`,
            },
            unit_amount: PLAN_PRICES[newPlan] * 100,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        }],
        metadata: {
          tenant_id: tenant.id,
          plan_id: newPlan,
          from_plan: currentPlan,
        },
      };

      // If existing subscription, update it with proration
      if (tenant.stripe_subscription_id) {
        try {
          // Update existing subscription
          const subscription = await stripeClient.subscriptions.update(
            tenant.stripe_subscription_id,
            {
              items: [{
                id: (await stripeClient.subscriptions.retrieve(tenant.stripe_subscription_id)).items.data[0].id,
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)} Plan`,
                  },
                  unit_amount: PLAN_PRICES[newPlan] * 100,
                  recurring: { interval: 'month' },
                },
              }],
              proration_behavior: 'always_invoice', // Always prorate
              metadata: {
                tenant_id: tenant.id,
                plan_id: newPlan,
                from_plan: currentPlan,
              },
            }
          );

          // Return subscription update confirmation
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Subscription updated successfully',
              subscription_id: subscription.id,
              prorated: true,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (stripeError: any) {
          console.error('Stripe subscription update error:', stripeError);
          // Fall through to checkout session creation
        }
      }

      // Create checkout session for new subscription
      const session = await stripeClient.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: subscriptionParams.items,
        mode: 'subscription',
        success_url: `${Deno.env.get('SITE_URL') || 'https://app.example.com'}/admin/billing?success=true`,
        cancel_url: `${Deno.env.get('SITE_URL') || 'https://app.example.com'}/admin/billing?canceled=true`,
        metadata: subscriptionParams.metadata,
      });

      // Update tenant with Stripe customer ID
      await supabase.from('tenants').update({
        stripe_customer_id: stripeCustomerId,
      }).eq('id', tenant_id).catch(err => console.error('Error updating Stripe customer ID:', err));

      return new Response(
        JSON.stringify({
          success: true,
          checkout_url: session.url,
          session_id: session.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct plan update (without Stripe payment)
    const now = new Date();
    const nowISO = now.toISOString();
    
    // Calculate proration if mid-cycle upgrade/downgrade
    let prorationAmount = 0;
    let prorationDetails = null;
    
    const currentPeriodStart = tenant.subscription_current_period_start 
      ? new Date(tenant.subscription_current_period_start) 
      : new Date(tenant.created_at);
    const currentPeriodEnd = tenant.subscription_current_period_end 
      ? new Date(tenant.subscription_current_period_end) 
      : (() => {
          const end = new Date(currentPeriodStart);
          end.setMonth(end.getMonth() + 1);
          return end;
        })();
    
    const isMidCycle = now > currentPeriodStart && now < currentPeriodEnd && 
                       currentIndex !== newIndex && 
                       tenant.subscription_status === 'active';
    
    if (isMidCycle) {
      // Calculate days remaining in current period
      const totalDays = (currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24);
      const daysRemaining = (currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      const daysUsed = totalDays - daysRemaining;
      
      // Calculate prorated amounts
      const oldPlanDaily = PLAN_PRICES[currentPlan] / totalDays;
      const newPlanDaily = PLAN_PRICES[newPlan] / totalDays;
      
      // Credit for unused portion of old plan
      const credit = oldPlanDaily * daysRemaining;
      // Charge for remaining days on new plan
      const charge = newPlanDaily * daysRemaining;
      
      // Proration amount (positive = upgrade, negative = downgrade)
      prorationAmount = charge - credit;
      
      prorationDetails = {
        days_remaining: Math.floor(daysRemaining),
        days_used: Math.floor(daysUsed),
        total_days: Math.floor(totalDays),
        old_plan_daily_rate: oldPlanDaily,
        new_plan_daily_rate: newPlanDaily,
        credit_amount: credit,
        charge_amount: charge,
        proration_amount: prorationAmount,
      };
    }

    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

    const updateData: any = {
      subscription_plan: newPlan,
      subscription_status: 'active',
      mrr: PLAN_PRICES[newPlan],
      limits: PLAN_LIMITS[newPlan],
      features: PLAN_FEATURES[newPlan],
      subscription_current_period_start: nowISO,
      subscription_current_period_end: nextPeriodEnd.toISOString(),
      updated_at: nowISO,
    };

    // If upgrading from trial, set subscription start
    if (tenant.subscription_status === 'trial') {
      updateData.subscription_started_at = nowISO;
      updateData.trial_ends_at = null;
    }

    const { error: updateError } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenant_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message || 'Failed to update subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invoice for plan change
    if (currentIndex !== newIndex || prorationAmount !== 0) {
      const invoiceNumber = `INV-${tenant_id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days to pay

      const baseAmount = PLAN_PRICES[newPlan];
      const subtotal = prorationAmount !== 0 ? Math.abs(prorationAmount) : baseAmount;
      const tax = subtotal * 0.08; // 8% tax (adjust as needed)
      const total = subtotal + tax;

      const lineItems = [{
        description: `${TIER_NAMES[newPlan]} Plan - ${prorationAmount !== 0 ? 'Prorated' : 'Full Period'}`,
        quantity: 1,
        unit_price: subtotal,
        total: subtotal,
      }];

      if (prorationAmount !== 0 && prorationDetails) {
        if (prorationAmount > 0) {
          lineItems.unshift({
            description: `Credit - Unused portion of ${TIER_NAMES[currentPlan]} Plan`,
            quantity: 1,
            unit_price: -prorationDetails.credit_amount,
            total: -prorationDetails.credit_amount,
          });
        }
        lineItems.push({
          description: `Proration Adjustment (${prorationDetails.days_remaining} days remaining)`,
          quantity: 1,
          unit_price: prorationAmount > 0 ? prorationDetails.charge_amount : prorationDetails.credit_amount,
          total: prorationAmount > 0 ? prorationDetails.charge_amount : prorationDetails.credit_amount,
        });
      }

      // Create invoice in database
      const { error: invoiceError } = await supabase.from('invoices').insert({
        tenant_id: tenant_id,
        invoice_number: invoiceNumber,
        subtotal: subtotal,
        tax: tax,
        total: total,
        amount_due: total,
        amount_paid: 0,
        line_items: lineItems,
        billing_period_start: currentPeriodStart.toISOString().split('T')[0],
        billing_period_end: currentPeriodEnd.toISOString().split('T')[0],
        issue_date: invoiceDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'open',
      }).catch(err => {
        console.error('Error creating invoice:', err);
        return { error: err };
      });

      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
        // Don't fail the subscription update if invoice creation fails
      }
    }

    // Log subscription event
    const eventType = currentIndex === newIndex 
      ? 'plan_unchanged' 
      : newIndex > currentIndex 
        ? 'plan_upgraded' 
        : 'plan_downgraded';
    
    await supabase.from('subscription_events').insert({
      tenant_id: tenant_id,
      event_type: eventType,
      from_plan: currentPlan,
      to_plan: newPlan,
      amount: PLAN_PRICES[newPlan],
      metadata: {
        changed_at: now,
      },
    }).catch(err => console.error('Error logging subscription event:', err));

    const actionMessage = currentIndex === newIndex 
      ? 'updated' 
      : newIndex > currentIndex 
        ? 'upgraded' 
        : 'downgraded';

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully ${actionMessage} to ${newPlan} plan`,
        tenant: {
          id: tenant_id,
          subscription_plan: newPlan,
          subscription_status: 'active',
          mrr: PLAN_PRICES[newPlan],
        },
        proration: prorationDetails ? {
          amount: prorationAmount,
          details: prorationDetails,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

