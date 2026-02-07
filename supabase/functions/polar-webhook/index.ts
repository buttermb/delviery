// Edge Function: polar-webhook
// Handles Polar.sh webhooks for subscription events

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, polar-signature',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const body = await req.json();
        const eventType = body.type;

        console.log('Polar webhook received:', eventType);

        switch (eventType) {
            case 'checkout.completed': {
                const { customer_email, metadata, subscription_id } = body.data;
                const tenantId = metadata?.tenant_id;
                const plan = metadata?.plan;

                if (tenantId && plan) {
                    // Update tenant subscription status
                    await supabase
                        .from('tenants')
                        .update({
                            subscription_status: 'active',
                            subscription_plan: plan,
                            subscription_id: subscription_id,
                            is_free_tier: false,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', tenantId);

                    // Log the subscription event
                    await supabase.from('subscription_events').insert({
                        tenant_id: tenantId,
                        event_type: 'subscription_started',
                        plan: plan,
                        metadata: body.data,
                    });

                    console.log(`Tenant ${tenantId} upgraded to ${plan}`);
                }
                break;
            }

            case 'subscription.updated': {
                const { subscription_id, status, plan } = body.data;

                // Find tenant by subscription_id
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('id')
                    .eq('subscription_id', subscription_id)
                    .single();

                if (tenant) {
                    await supabase
                        .from('tenants')
                        .update({
                            subscription_status: status,
                            subscription_plan: plan?.name || plan,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', tenant.id);
                }
                break;
            }

            case 'subscription.canceled': {
                const { subscription_id } = body.data;

                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('id')
                    .eq('subscription_id', subscription_id)
                    .single();

                if (tenant) {
                    // Downgrade to free tier
                    await supabase
                        .from('tenants')
                        .update({
                            subscription_status: 'canceled',
                            is_free_tier: true,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', tenant.id);

                    // Reset credits for free tier
                    await supabase
                        .from('tenant_credits')
                        .update({ balance: 10000 })
                        .eq('tenant_id', tenant.id);

                    console.log(`Tenant ${tenant.id} downgraded to free tier`);
                }
                break;
            }

            default:
                console.log('Unhandled Polar event:', eventType);
        }

        return new Response(
            JSON.stringify({ received: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Polar webhook error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
