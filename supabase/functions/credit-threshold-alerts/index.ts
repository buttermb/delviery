// Credit Threshold Alerts
//
// Sends email and SMS notifications when credits reach certain thresholds.
// Supports configurable alert preferences per tenant.
//
// Can be triggered:
// 1. Via cron job (scheduled check)
// 2. Real-time after credit consumption (webhook)
//
// Schedule: Every 4 hours (0 */4 * * *)
//
// To deploy:
// supabase functions deploy credit-threshold-alerts --no-verify-jwt

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import type { RequestBody, AlertResult } from './thresholds.ts';
import { checkAndAlertTenant } from './alert-evaluation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      body = { mode: 'cron' };
    }

    const mode = body.mode || 'cron';
    console.error(`[CREDIT_ALERTS] Starting in ${mode} mode`);

    const results: AlertResult[] = [];

    if (mode === 'realtime' && body.tenant_id && body.new_balance !== undefined) {
      // Real-time check for a single tenant after credit consumption
      const result = await checkAndAlertTenant(
        supabase,
        body.tenant_id,
        body.new_balance
      );
      if (result) {
        results.push(result);
      }
    } else {
      // Cron mode - check all free tier tenants
      const { data: tenants, error: queryError } = await supabase
        .from('tenant_credits')
        .select(`
          tenant_id,
          balance,
          alerts_sent,
          tenants!inner (
            id,
            slug,
            is_free_tier,
            owner_email,
            owner_phone
          )
        `)
        .eq('tenants.is_free_tier', true)
        .lte('balance', 2000);

      if (queryError) {
        console.error('[CREDIT_ALERTS] Query error:', queryError);
        throw queryError;
      }

      console.error(`[CREDIT_ALERTS] Found ${tenants?.length || 0} tenants to check`);

      for (const record of tenants || []) {
        const result = await checkAndAlertTenant(
          supabase,
          record.tenant_id,
          record.balance,
          record.tenants as unknown as Record<string, unknown>,
          record.alerts_sent
        );
        if (result) {
          results.push(result);
        }
      }
    }

    console.error('[CREDIT_ALERTS] Job completed:', {
      mode,
      alerts_sent: results.filter(r => r.success).length,
      errors: results.filter(r => !r.success).length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        results,
        summary: {
          total_checked: results.length,
          alerts_sent: results.filter(r => r.success).length,
          errors: results.filter(r => !r.success).length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[CREDIT_ALERTS] Job failed:', error);
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
