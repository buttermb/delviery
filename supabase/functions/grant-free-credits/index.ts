// @ts-nocheck
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

// Reduced from 1,000 to 500 for aggressive monetization
// 500 credits provides ~1 day of active business use
// Maintains "free" illusion while driving upgrades
const FREE_CREDITS_AMOUNT = 500;
const ROLLOVER_PERCENTAGE = 0; // Set to 0.1 for 10% rollover, 0 for no rollover

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify this is an internal/cron call
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')) {
    // Allow requests with valid bearer token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const tempClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader?.replace('Bearer ', '');
    if (token !== supabaseServiceKey) {
      // Verify it's a valid admin user
      const { data: { user }, error } = await tempClient.auth.getUser(token || '');
      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - only admins can trigger this job' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[GRANT_FREE_CREDITS] Starting daily credit grant job');

    // Find all free tier tenants whose credits need refreshing
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
          subscription_status,
          owner_email
        )
      `)
      .eq('tenants.is_free_tier', true)
      .lte('next_free_grant_at', new Date().toISOString());

    if (queryError) {
      console.error('[GRANT_FREE_CREDITS] Query error:', queryError);
      throw queryError;
    }

    console.log(`[GRANT_FREE_CREDITS] Found ${eligibleTenants?.length || 0} eligible tenants`);

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
      const tenant = record.tenants as any;

      try {
        // Skip if tenant is no longer on free tier
        if (!tenant?.is_free_tier) {
          console.log(`[GRANT_FREE_CREDITS] Skipping ${tenantId} - no longer free tier`);
          results.skipped++;
          continue;
        }

        // Calculate new balance with rollover
        const previousBalance = record.balance;
        const rolloverAmount = Math.floor(previousBalance * ROLLOVER_PERCENTAGE);
        const newBalance = FREE_CREDITS_AMOUNT + rolloverAmount;

        // Reset free credits balance, expire old ones, add new ones
        const { error: updateError } = await supabase
          .from('tenant_credits')
          .update({
            balance: newBalance,
            free_credits_balance: FREE_CREDITS_AMOUNT,
            free_credits_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            lifetime_earned: (record.lifetime_earned || 0) + FREE_CREDITS_AMOUNT,
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
          console.error(`[GRANT_FREE_CREDITS] Update error for ${tenantId}:`, updateError);
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
            amount: FREE_CREDITS_AMOUNT,
            balance_after: newBalance,
            transaction_type: 'free_grant',
            action_type: 'monthly_refresh',
            reference_id: idempotencyKey,
            description: 'Monthly credit refresh',
            metadata: {
              previous_balance: previousBalance,
              expired_credits: previousBalance - rolloverAmount,
              rollover_amount: rolloverAmount,
              grant_date: grantDate,
            },
          });
        
        // If duplicate key error, this grant was already processed
        if (txError?.code === '23505') {
          console.log(`[GRANT_FREE_CREDITS] Skipping ${tenantId} - already granted today`);
          results.skipped++;
          continue;
        }

        console.log(`[GRANT_FREE_CREDITS] Granted ${FREE_CREDITS_AMOUNT} credits to ${tenant.slug} (rollover: ${rolloverAmount})`);
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
              granted_amount: FREE_CREDITS_AMOUNT,
            },
          });

        // Send notification email (optional - integrate with email service)
        if (tenant.owner_email) {
          // TODO: Integrate with email service (Resend, SendGrid, etc.)
          console.log(`[GRANT_FREE_CREDITS] Would send email to ${tenant.owner_email}`);
        }

      } catch (err) {
        console.error(`[GRANT_FREE_CREDITS] Error processing ${tenantId}:`, err);
        results.errors.push(`${tenantId}: ${(err as Error).message}`);
      }
    }

    // Also check for tenants without a credit record that should have one
    const { data: tenantsWithoutCredits, error: missingError } = await supabase
      .from('tenants')
      .select('id, slug')
      .eq('is_free_tier', true)
      .not('id', 'in', `(${(eligibleTenants || []).map(t => `'${t.tenant_id}'`).join(',') || "''"})`)
      .limit(100);

    if (!missingError && tenantsWithoutCredits?.length) {
      console.log(`[GRANT_FREE_CREDITS] Found ${tenantsWithoutCredits.length} tenants without credit records`);
      
      for (const tenant of tenantsWithoutCredits) {
        try {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          
          // Create credit record with initial free credits
          const { error: createError } = await supabase
            .from('tenant_credits')
            .insert({
              tenant_id: tenant.id,
              balance: FREE_CREDITS_AMOUNT,
              free_credits_balance: FREE_CREDITS_AMOUNT,
              purchased_credits_balance: 0,
              free_credits_expires_at: expiresAt,
              lifetime_earned: FREE_CREDITS_AMOUNT,
              lifetime_spent: 0,
              last_free_grant_at: new Date().toISOString(),
              next_free_grant_at: expiresAt,
              credits_used_today: 0,
              rollover_enabled: false,
            });

          if (!createError) {
            console.log(`[GRANT_FREE_CREDITS] Created credit record for ${tenant.slug}`);
            
            // Log the initial grant transaction with idempotency
            const initKey = `initial_grant:${tenant.id}`;
            await supabase
              .from('credit_transactions')
              .insert({
                tenant_id: tenant.id,
                amount: FREE_CREDITS_AMOUNT,
                balance_after: FREE_CREDITS_AMOUNT,
                transaction_type: 'free_grant',
                action_type: 'initial_grant',
                reference_id: initKey,
                description: 'Initial free credits',
              });
            
            results.granted++;
          }
        } catch (err) {
          console.error(`[GRANT_FREE_CREDITS] Error creating credit record for ${tenant.id}:`, err);
        }
      }
    }

    console.log('[GRANT_FREE_CREDITS] Job completed:', results);

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
    console.error('[GRANT_FREE_CREDITS] Job failed:', error);
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







