// Low Stock Email Digest
//
// Daily scheduled edge function that sends email digests to tenant admins
// about products below their reorder threshold.
//
// Features:
// - Queries products below threshold per tenant
// - Formats email with product name, current stock, reorder point, days until stockout
// - Sends to admin email configured in tenant settings
// - Configurable in tenant alert_settings (email_digest_enabled, digest_time)
// - Caches results for efficiency
//
// Schedule: Daily at 8 AM UTC (0 8 * * *)
//
// To deploy:
// supabase functions deploy low-stock-email-digest --no-verify-jwt

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import { errorResponse } from '../_shared/error-response.ts';
import { verifyAuth } from './auth.ts';
import { processTenant } from './process-tenant.ts';
import type { DigestResult } from './types.ts';

const logger = createLogger('low-stock-email-digest');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResponse = await verifyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info('Starting daily low stock email digest job');

    const results: DigestResult[] = [];
    const summary = {
      tenants_checked: 0,
      emails_sent: 0,
      total_products_flagged: 0,
      credits_deducted: 0,
      skipped_insufficient_credits: 0,
      errors: [] as string[],
    };

    // Get all active tenants with their settings
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select(`
        id,
        slug,
        name,
        owner_email,
        is_active,
        alert_settings
      `)
      .eq('is_active', true);

    if (tenantsError) {
      logger.error('Failed to fetch tenants', { error: tenantsError.message });
      throw tenantsError;
    }

    logger.info('Found active tenants', { count: tenants?.length || 0 });

    for (const tenant of tenants || []) {
      summary.tenants_checked++;

      try {
        const result = await processTenant(supabase, tenant, summary);
        if (result) {
          results.push(result);
        }
      } catch (err) {
        const errorMessage = (err as Error).message;
        logger.error('Error processing tenant', {
          tenantId: tenant.id,
          error: errorMessage,
        });
        summary.errors.push(`${tenant.slug}: ${errorMessage}`);

        results.push({
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          products_count: 0,
          email_sent: false,
          error: errorMessage,
        });
      }
    }

    logger.info('Low stock email digest job completed', summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Low stock email digest job completed',
        summary,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    logger.error('Low stock email digest job failed', {
      error: (error as Error).message
    });

    return errorResponse(500, (error as Error).message || 'Internal server error');
  }
});
