// Edge Function: polar-checkout
// Generates Polar checkout URLs for FloraIQ subscriptions

import { serve } from '../_shared/deps.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Polar API configuration
const POLAR_API_BASE = 'https://api.polar.sh/v1';
const POLAR_ACCESS_TOKEN = Deno.env.get('POLAR_ACCESS_TOKEN');

// Product IDs from Polar dashboard (you'll get these after creating products)
const PRODUCT_IDS = {
    starter: 'prod_starter_79',     // $79/month
    professional: 'prod_pro_199',   // $199/month
    enterprise: 'prod_ent_499',     // $499/month
};

interface CheckoutRequest {
    plan: 'starter' | 'professional' | 'enterprise';
    tenant_id: string;
    success_url?: string;
    customer_email?: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        if (!POLAR_ACCESS_TOKEN) {
            throw new Error('POLAR_ACCESS_TOKEN not configured');
        }

        const body: CheckoutRequest = await req.json();
        const { plan, tenant_id, success_url, customer_email } = body;

        if (!plan || !tenant_id) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: plan, tenant_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const productId = PRODUCT_IDS[plan];
        if (!productId) {
            return new Response(
                JSON.stringify({ error: 'Invalid plan. Choose: starter, professional, enterprise' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create Polar checkout session
        const checkoutResponse = await fetch(`${POLAR_API_BASE}/checkouts/custom`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${POLAR_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_id: productId,
                success_url: success_url || `${Deno.env.get('SITE_URL') || 'https://floraiqcrm.com'}/billing/success?checkout_id={CHECKOUT_ID}`,
                customer_email: customer_email,
                metadata: {
                    tenant_id: tenant_id,
                    plan: plan,
                },
            }),
        });

        if (!checkoutResponse.ok) {
            const errorData = await checkoutResponse.text();
            console.error('Polar API error:', errorData);
            throw new Error('Failed to create checkout session');
        }

        const checkoutData = await checkoutResponse.json();

        return new Response(
            JSON.stringify({
                checkout_url: checkoutData.url,
                checkout_id: checkoutData.id,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Polar checkout error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Checkout creation failed' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
