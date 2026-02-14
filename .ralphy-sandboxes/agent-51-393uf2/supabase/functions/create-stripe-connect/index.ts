/**
 * Create Stripe Connect Edge Function
 * Creates a Stripe Connect account link for platform onboarding
 */

import { serve, corsHeaders } from '../_shared/deps.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@18.5.0';

// Helper logging function
const logStep = (step: string, details?: any) => {
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`[CREATE-STRIPE-CONNECT] ${step}${detailsStr}`);
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        logStep('Function started');

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        if (!supabaseUrl || !supabaseServiceKey) {
            logStep('ERROR: Missing Supabase configuration');
            return new Response(
                JSON.stringify({ error: 'Missing Supabase configuration' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get auth token from request
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            logStep('ERROR: Missing authorization header');
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verify user is authenticated
        logStep('Verifying user authentication');
        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            logStep('ERROR: Authentication failed', { error: authError?.message });
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { tenant_id } = await req.json();

        if (!tenant_id) {
            logStep('ERROR: Missing tenant_id');
            return new Response(
                JSON.stringify({ error: 'Missing tenant_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get tenant
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tenant_id)
            .single();

        if (tenantError || !tenant) {
            logStep('ERROR: Tenant not found');
            return new Response(
                JSON.stringify({ error: 'Tenant not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verify user has permission (must be owner or admin)
        const isOwner = tenant.owner_email?.toLowerCase() === user.email?.toLowerCase();

        const { data: tenantUser } = await supabase
            .from('tenant_users')
            .select('role')
            .eq('tenant_id', tenant_id)
            .eq('user_id', user.id)
            .maybeSingle();

        const isAdmin = tenantUser?.role === 'admin' || tenantUser?.role === 'owner';

        if (!isOwner && !isAdmin) {
            logStep('ERROR: Insufficient permissions');
            return new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

        if (!STRIPE_SECRET_KEY) {
            logStep('ERROR: Stripe not configured');
            return new Response(
                JSON.stringify({ error: 'Stripe not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Stripe SDK
        const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
            apiVersion: '2025-08-27.basil',
            httpClient: Stripe.createFetchHttpClient(),
        });

        // Check if tenant already has a connect account
        let connectAccountId = tenant.stripe_connect_id;

        if (!connectAccountId) {
            logStep('Creating new Connect account');
            const account = await stripeClient.accounts.create({
                type: 'express',
                email: tenant.owner_email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                metadata: {
                    tenant_id: tenant.id,
                },
            });
            connectAccountId = account.id;

            // Update tenant
            await supabase.from('tenants').update({
                stripe_connect_id: connectAccountId,
            }).eq('id', tenant_id);

            logStep('Connect account created', { connectAccountId });
        } else {
            logStep('Using existing Connect account', { connectAccountId });
        }

        // Create account link
        const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://app.example.com';
        const refreshUrl = `${siteUrl}/${tenant.slug}/admin/settings?tab=integrations&connect_refresh=true`;
        const returnUrl = `${siteUrl}/${tenant.slug}/admin/settings?tab=integrations&connect_success=true`;

        const accountLink = await stripeClient.accountLinks.create({
            account: connectAccountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: 'account_onboarding',
        });

        logStep('Account link created', { url: accountLink.url });

        return new Response(
            JSON.stringify({
                success: true,
                url: accountLink.url,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        logStep('CRITICAL ERROR', { message: error.message });
        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
