/**
 * set-free-tier Edge Function
 *
 * Atomically sets a tenant to free tier:
 * 1. Validates authenticated user owns the tenant
 * 2. Updates tenant flags (is_free_tier, credits_enabled, subscription_status, subscription_plan)
 * 3. Grants initial free credits via RPC
 *
 * Returns { success, slug } on success for client redirect.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { validateSetFreeTier } from './validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse and validate request
    const body = await req.json();
    const { tenant_id: clientTenantId } = validateSetFreeTier(body);

    // 3. Verify user owns this tenant (never trust client-supplied tenant_id)
    const { data: tenantUser, error: tenantUserError } = await supabaseClient
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const resolvedTenantId = tenantUser?.tenant_id;

    if (tenantUserError || !resolvedTenantId) {
      return new Response(
        JSON.stringify({ error: 'No tenant associated with user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (resolvedTenantId !== clientTenantId) {
      console.error('[SET-FREE-TIER] Tenant ID mismatch: caller does not own requested tenant');
      return new Response(
        JSON.stringify({ error: 'Not authorized for this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = resolvedTenantId;
    console.error('[SET-FREE-TIER] Processing:', { tenantId, userId: user.id });

    // 4. Check if already on free tier (idempotent)
    const { data: existingTenant } = await supabaseClient
      .from('tenants')
      .select('is_free_tier, slug')
      .eq('id', tenantId)
      .maybeSingle();

    if (existingTenant?.is_free_tier) {
      console.error('[SET-FREE-TIER] Already on free tier, returning success');
      return new Response(
        JSON.stringify({ success: true, slug: existingTenant.slug, already_free: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Update tenant to free tier
    const { error: updateError } = await supabaseClient
      .from('tenants')
      .update({
        is_free_tier: true,
        credits_enabled: true,
        subscription_status: 'active',
        subscription_plan: 'free',
      })
      .eq('id', tenantId);

    if (updateError) {
      console.error('[SET-FREE-TIER] Failed to update tenant:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to set free tier status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Grant initial credits (10000 = FREE_TIER_MONTHLY_CREDITS)
    const { data: creditResult, error: creditError } = await supabaseClient
      .rpc('grant_free_credits', {
        p_tenant_id: tenantId,
        p_amount: 10000,
      });

    if (creditError) {
      // Credit grant failed — roll back tenant update
      console.error('[SET-FREE-TIER] Credit grant failed, rolling back:', creditError);
      await supabaseClient
        .from('tenants')
        .update({
          is_free_tier: false,
          credits_enabled: false,
          subscription_status: 'pending',
          subscription_plan: null,
        })
        .eq('id', tenantId);

      return new Response(
        JSON.stringify({ error: 'Failed to grant initial credits. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Get slug for redirect
    const { data: tenant } = await supabaseClient
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .maybeSingle();

    console.error('[SET-FREE-TIER] Success:', { tenantId, slug: tenant?.slug });

    return new Response(
      JSON.stringify({
        success: true,
        slug: tenant?.slug,
        credits_granted: 10000,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[SET-FREE-TIER] Error:', error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
