/**
 * Credit Usage Reset
 * 
 * Scheduled job that resets daily and weekly credit usage counters.
 * 
 * Schedule: 
 * - Daily reset: 0 0 * * * (midnight UTC)
 * - Weekly reset: 0 0 * * 0 (Sunday midnight UTC)
 * 
 * To deploy:
 * supabase functions deploy credit-usage-reset --no-verify-jwt
 * 
 * To set up cron jobs via pg_cron:
 * 
 * -- Daily reset at midnight
 * SELECT cron.schedule(
 *   'credit-usage-daily-reset',
 *   '0 0 * * *',
 *   $$SELECT net.http_post(
 *     url := 'https://<project-ref>.supabase.co/functions/v1/credit-usage-reset',
 *     body := '{"resetType": "daily"}'::jsonb,
 *     headers := '{"Authorization": "Bearer <service-role-key>", "Content-Type": "application/json"}'::jsonb
 *   );$$
 * );
 * 
 * -- Weekly reset on Sundays at midnight
 * SELECT cron.schedule(
 *   'credit-usage-weekly-reset',
 *   '0 0 * * 0',
 *   $$SELECT net.http_post(
 *     url := 'https://<project-ref>.supabase.co/functions/v1/credit-usage-reset',
 *     body := '{"resetType": "weekly"}'::jsonb,
 *     headers := '{"Authorization": "Bearer <service-role-key>", "Content-Type": "application/json"}'::jsonb
 *   );$$
 * );
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

type ResetType = 'daily' | 'weekly' | 'both';

interface ResetRequest {
  resetType: ResetType;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify this is an internal/cron call
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!authHeader?.includes(supabaseServiceKey)) {
    const token = authHeader?.replace('Bearer ', '');
    if (token !== supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - service role key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let resetType: ResetType = 'daily';
    try {
      const body = await req.json() as ResetRequest;
      resetType = body.resetType || 'daily';
    } catch {
      // Default to daily if no body
    }

    console.log(`[CREDIT_USAGE_RESET] Starting ${resetType} reset job`);

    const results = {
      resetType,
      dailyReset: 0,
      weeklyReset: 0,
      errors: [] as string[],
    };

    // Daily reset
    if (resetType === 'daily' || resetType === 'both') {
      const { data, error } = await supabase.rpc('reset_daily_credits');

      if (error) {
        console.error('[CREDIT_USAGE_RESET] Daily reset error:', error);
        results.errors.push(`Daily reset: ${error.message}`);
      } else {
        results.dailyReset = data || 0;
        console.log(`[CREDIT_USAGE_RESET] Daily reset completed: ${data} tenants updated`);
      }
    }

    // Weekly reset (also resets daily)
    if (resetType === 'weekly' || resetType === 'both') {
      const { data, error } = await supabase.rpc('reset_weekly_credits');

      if (error) {
        console.error('[CREDIT_USAGE_RESET] Weekly reset error:', error);
        results.errors.push(`Weekly reset: ${error.message}`);
      } else {
        results.weeklyReset = data || 0;
        console.log(`[CREDIT_USAGE_RESET] Weekly reset completed: ${data} tenants updated`);
      }
    }

    // Log the reset event
    await supabase
      .from('credit_analytics')
      .insert({
        tenant_id: null, // Platform-wide event
        event_type: `usage_reset_${resetType}`,
        credits_at_event: 0,
        metadata: {
          daily_resets: results.dailyReset,
          weekly_resets: results.weeklyReset,
          timestamp: new Date().toISOString(),
        },
      });

    console.log('[CREDIT_USAGE_RESET] Job completed:', results);

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        message: `Credit usage ${resetType} reset completed`,
        results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[CREDIT_USAGE_RESET] Job failed:', error);
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







