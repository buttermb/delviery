/**
 * Grant Free Credits
 * 
 * Cron job that runs daily to grant free monthly credits to eligible tenants.
 * 
 * Schedule: Daily at 00:00 UTC (midnight)
 * Cron: 0 0 * * *
 * 
 * To deploy:
 * supabase functions deploy grant-free-credits --no-verify-jwt
 * 
 * To set up cron job via pg_cron:
 * SELECT cron.schedule(
 *   'grant-free-credits-daily',
 *   '0 0 * * *',
 *   $$SELECT net.http_post(
 *     url := 'https://<project-ref>.supabase.co/functions/v1/grant-free-credits',
 *     headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
 *   );$$
 * );
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { createRequestLogger } from '../_shared/logger.ts';

// Plan-based credit amounts per specification
// These are the MONTHLY refresh amounts for existing tenants
// Initial signup amounts are handled by create_tenant_atomic
// Free tier: 500 credits/month (matches FREE_TIER_MONTHLY_CREDITS and grant_free_credits SQL cap)
const PLAN_CREDIT_AMOUNTS: Record<string, number> = {
  free: 500,         // Free tier monthly refresh (matches FREE_TIER_MONTHLY_CREDITS)
  starter: 25000,    // Starter plan monthly refresh
  pro: 100000,       // Pro plan monthly refresh
  professional: 100000,
  enterprise: 500000, // Enterprise plan monthly refresh
};

// Default for unknown plans - use free tier amount for safety
const DEFAULT_CREDITS_AMOUNT = 500;
const ROLLOVER_PERCENTAGE = 0; // Set to 0.1 for 10% rollover, 0 for no rollover

// Helper to get plan credit amount
function getPlanCredits(plan: string | null | undefined): number {
  if (!plan) return DEFAULT_CREDITS_AMOUNT;
  return PLAN_CREDIT_AMOUNTS[plan.toLowerCase()] || DEFAULT_CREDITS_AMOUNT;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = createRequestLogger('grant-free-credits', req);

  // Verify this is an internal/cron call or super-admin
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Allow service role key directly (for cron jobs) - use exact match, not includes
  const token = authHeader?.replace('Bearer ', '') ?? '';
  if (token !== supabaseServiceKey) {
    const tempClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader?.replace('Bearer ', '');

    if (token !== supabaseServiceKey) {
      // Verify it's a valid user first
      const { data: { user }, error } = await tempClient.auth.getUser(token || '');
      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // SECURITY: Verify user is a super-admin (not just any authenticated user)
      const { data: superAdmin, error: superAdminError } = await tempClient
        .from('super_admin_users')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();

      if (superAdminError || !superAdmin) {
        logger.warn('Unauthorized attempt', { email: user.email });
        return new Response(
          JSON.stringify({ error: 'Super admin access required for manual trigger' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logger.info('Authorized super-admin', { email: user.email });
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info('Starting daily credit grant job');

    // Find all tenants whose credits need refreshing
    // Note: We now query ALL tenants (not just free tier) to support plan-based amounts
    const { data: eligibleTenants, error: queryError } = await supabase
      .from('tenant_credits')
      .select(`
        tenant_id,
        balance,
        lifetime_earned,
        next_free_grant_at,
        tenants!inner (
          id,
          slug,
          is_free_tier,
          subscription_plan,
          subscription_status,
          owner_email
        )
      `)
      .lte('next_free_grant_at', new Date().toISOString());

    if (queryError) {
      logger.error('Query error', { error: queryError.message });
      throw queryError;
    }

    logger.info('Found eligible tenants', { count: eligibleTenants?.length || 0 });

    const results = {
      processed: 0,
      granted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each eligible tenant
    for (const record of eligibleTenants || []) {
      results.processed++;
      const tenantId = record.tenant_id;
      const tenant = record.tenants as Record<string, unknown> | null;

      try {
        // Get the plan-based credit amount
        const planCredits = getPlanCredits(tenant?.subscription_plan);

        // Calculate new balance with rollover
        const previousBalance = record.balance || 0;
        const rolloverAmount = Math.floor(previousBalance * ROLLOVER_PERCENTAGE);
        const newBalance = planCredits + rolloverAmount;

        // Reset credits balance, expire old ones, add new ones
        const { error: updateError } = await supabase
          .from('tenant_credits')
          .update({
            balance: newBalance,
            free_credits_balance: tenant?.is_free_tier ? planCredits : 0,
            free_credits_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            lifetime_earned: (record.lifetime_earned || 0) + planCredits,
            last_free_grant_at: new Date().toISOString(),
            next_free_grant_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            // Reset warning flags so they can trigger again
            warning_25_sent: false,
            warning_10_sent: false,
            warning_5_sent: false,
            warning_0_sent: false,
            alerts_sent: '{}',
            credits_used_today: 0,
          })
          .eq('tenant_id', tenantId);

        if (updateError) {
          logger.error('Update error', { tenantId, error: updateError.message });
          results.errors.push(`${tenantId}: ${updateError.message}`);
          continue;
        }

        // Log the transaction with idempotency key
        const grantDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const idempotencyKey = `free_grant:${tenantId}:${grantDate}`;

        const { error: txError } = await supabase
          .from('credit_transactions')
          .insert({
            tenant_id: tenantId,
            amount: planCredits,
            balance_after: newBalance,
            transaction_type: 'free_grant',
            action_type: 'monthly_refresh',
            reference_id: idempotencyKey,
            description: `Monthly credit refresh (${tenant?.subscription_plan || 'free'} plan)`,
            metadata: {
              previous_balance: previousBalance,
              expired_credits: previousBalance - rolloverAmount,
              rollover_amount: rolloverAmount,
              grant_date: grantDate,
              plan: tenant?.subscription_plan || 'free',
            },
          });

        // If duplicate key error, this grant was already processed
        if (txError?.code === '23505') {
          logger.info('Skipping tenant - already granted today', { tenantId });
          results.skipped++;
          continue;
        }

        logger.info('Granted credits', { tenantId, slug: tenant.slug, credits: planCredits, plan: tenant?.subscription_plan || 'free', rollover: rolloverAmount });
        results.granted++;

        // Track analytics event
        await supabase
          .from('credit_analytics')
          .insert({
            tenant_id: tenantId,
            event_type: 'monthly_credit_refresh',
            credits_at_event: newBalance,
            metadata: {
              previous_balance: record.balance,
              granted_amount: planCredits,
              plan: tenant?.subscription_plan || 'free',
            },
          });

        // Send notification email (optional - integrate with email service)
        if (tenant.owner_email) {
          // TODO: Integrate with email service (Resend, SendGrid, etc.)
          logger.info('Would send email notification', { email: tenant.owner_email });
        }

      } catch (err) {
        logger.error('Error processing tenant', { tenantId, error: (err as Error).message });
        results.errors.push(`${tenantId}: ${(err as Error).message}`);
      }
    }

    // Also check for tenants without a credit record that should have one
    const excludeIds = (eligibleTenants || []).map(t => t.tenant_id);
    let tenantsQuery = supabase
      .from('tenants')
      .select('id, slug, subscription_plan, is_free_tier')
      .limit(100);

    // Only apply filter if there are IDs to exclude
    if (excludeIds.length > 0) {
      tenantsQuery = tenantsQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: tenantsWithoutCredits, error: missingError } = await tenantsQuery;

    if (!missingError && tenantsWithoutCredits?.length) {
      logger.info('Found tenants without credit records', { count: tenantsWithoutCredits.length });

      for (const tenant of tenantsWithoutCredits) {
        try {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const planCredits = getPlanCredits(tenant.subscription_plan);

          // Create credit record with plan-based credits
          const { error: createError } = await supabase
            .from('tenant_credits')
            .insert({
              tenant_id: tenant.id,
              balance: planCredits,
              free_credits_balance: tenant.is_free_tier ? planCredits : 0,
              purchased_credits_balance: 0,
              free_credits_expires_at: expiresAt,
              lifetime_earned: planCredits,
              lifetime_spent: 0,
              last_free_grant_at: new Date().toISOString(),
              next_free_grant_at: expiresAt,
              credits_used_today: 0,
              rollover_enabled: false,
              tier_status: tenant.is_free_tier ? 'free' : 'paid',
            });

          if (!createError) {
            logger.info('Created credit record', { tenantId: tenant.id, slug: tenant.slug, credits: planCredits, plan: tenant.subscription_plan || 'free' });

            // Log the initial grant transaction with idempotency
            const initKey = `initial_grant:${tenant.id}`;
            await supabase
              .from('credit_transactions')
              .insert({
                tenant_id: tenant.id,
                amount: planCredits,
                balance_after: planCredits,
                transaction_type: 'free_grant',
                action_type: 'initial_grant',
                reference_id: initKey,
                description: `Initial credits (${tenant.subscription_plan || 'free'} plan)`,
                metadata: {
                  plan: tenant.subscription_plan || 'free',
                },
              });

            results.granted++;
          }
        } catch (err) {
          logger.error('Error creating credit record', { tenantId: tenant.id, error: (err as Error).message });
        }
      }
    }

    logger.info('Job completed', { results });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Credit grant job completed',
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('Job failed', { error: (error as Error).message });
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});







