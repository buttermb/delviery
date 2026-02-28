// Credit Warning Emails
// 
// Cron job that sends warning emails when credits are low.
// Triggers at 25%, 10%, 5%, and 0% thresholds.
// 
// Schedule: Every 6 hours (0 */6 * * *)
// 
// To deploy:
// supabase functions deploy credit-warning-emails --no-verify-jwt

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

const FREE_CREDITS_AMOUNT = 10000;
const WARNING_THRESHOLDS = [
  { percent: 25, credits: 2500, column: 'warning_25_sent', severity: 'info' },
  { percent: 10, credits: 1000, column: 'warning_10_sent', severity: 'warning' },
  { percent: 5, credits: 500, column: 'warning_5_sent', severity: 'critical' },
  { percent: 0, credits: 0, column: 'warning_0_sent', severity: 'depleted' },
] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify this is an internal/cron call
  const authHeader = req.headers.get('Authorization');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  if (authHeader?.replace('Bearer ', '') !== supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[CREDIT_WARNINGS] Starting credit warning job');

    const results = {
      checked: 0,
      warnings_sent: 0,
      by_severity: {
        info: 0,
        warning: 0,
        critical: 0,
        depleted: 0,
      },
      errors: [] as string[],
    };

    // Process each warning threshold
    for (const threshold of WARNING_THRESHOLDS) {
      console.log(`[CREDIT_WARNINGS] Checking ${threshold.percent}% threshold`);

      // Find tenants at this threshold who haven't been warned
      const { data: tenants, error: queryError } = await supabase
        .from('tenant_credits')
        .select(`
          tenant_id,
          balance,
          ${threshold.column},
          tenants!inner (
            id,
            slug,
            is_free_tier,
            owner_email
          )
        `)
        .eq('tenants.is_free_tier', true)
        .lte('balance', threshold.credits)
        .eq(threshold.column, false);

      if (queryError) {
        console.error(`[CREDIT_WARNINGS] Query error for ${threshold.percent}%:`, queryError);
        results.errors.push(`${threshold.percent}% query: ${queryError.message}`);
        continue;
      }

      console.log(`[CREDIT_WARNINGS] Found ${tenants?.length || 0} tenants at ${threshold.percent}%`);

      for (const record of tenants || []) {
        results.checked++;
        const tenant = record.tenants as Record<string, unknown> | null;

        if (!tenant?.owner_email) {
          console.log(`[CREDIT_WARNINGS] No email for tenant ${record.tenant_id}`);
          continue;
        }

        try {
          // Send warning notification
          await sendWarningNotification(
            supabase,
            record.tenant_id,
            tenant.owner_email,
            tenant.slug,
            record.balance,
            threshold
          );

          // Mark warning as sent
          await supabase
            .from('tenant_credits')
            .update({ [threshold.column]: true })
            .eq('tenant_id', record.tenant_id);

          // Track analytics
          await supabase
            .from('credit_analytics')
            .insert({
              tenant_id: record.tenant_id,
              event_type: `credit_warning_${threshold.severity}`,
              credits_at_event: record.balance,
              metadata: {
                threshold_percent: threshold.percent,
                threshold_credits: threshold.credits,
              },
            });

          results.warnings_sent++;
          results.by_severity[threshold.severity]++;
          console.log(`[CREDIT_WARNINGS] Sent ${threshold.severity} warning to ${tenant.slug}`);

        } catch (err) {
          console.error(`[CREDIT_WARNINGS] Error for ${record.tenant_id}:`, err);
          results.errors.push(`${record.tenant_id}: ${(err as Error).message}`);
        }
      }
    }

    console.log('[CREDIT_WARNINGS] Job completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Credit warning job completed',
        results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[CREDIT_WARNINGS] Job failed:', error);
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

/**
 * Send warning notification to tenant
 */
async function sendWarningNotification(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  email: string,
  slug: string,
  balance: number,
  threshold: typeof WARNING_THRESHOLDS[number]
): Promise<void> {
  // Create in-app notification
  await supabase
    .from('notifications')
    .insert({
      tenant_id: tenantId,
      type: 'system',
      title: getNotificationTitle(threshold.severity),
      message: getNotificationMessage(balance, threshold),
      metadata: {
        credit_warning: true,
        severity: threshold.severity,
        balance,
        threshold_percent: threshold.percent,
      },
    });

  // TODO: Send email notification
  // Integrate with your email service (Resend, SendGrid, etc.)
  console.log(`[CREDIT_WARNINGS] Would send email to ${email}:`, {
    subject: getEmailSubject(threshold.severity),
    balance,
    slug,
  });
}

function getNotificationTitle(severity: string): string {
  switch (severity) {
    case 'depleted':
      return '🚨 Credits Depleted!';
    case 'critical':
      return '⚠️ Credits Running Very Low';
    case 'warning':
      return '⚡ Credits Running Low';
    default:
      return '💡 Credit Balance Update';
  }
}

function getNotificationMessage(balance: number, threshold: typeof WARNING_THRESHOLDS[number]): string {
  switch (threshold.severity) {
    case 'depleted':
      return `You've run out of credits. Some features are now unavailable. Upgrade to a subscription for unlimited access, or purchase more credits.`;
    case 'critical':
      return `You only have ${balance} credits left (${threshold.percent}%). Consider upgrading to a subscription for unlimited access.`;
    case 'warning':
      return `You have ${balance} credits remaining (${threshold.percent}%). Your credits will refresh in ${getDaysUntilRefresh()} days, or upgrade for unlimited access.`;
    default:
      return `You have ${balance} credits remaining (${threshold.percent}% of your monthly allowance).`;
  }
}

function getEmailSubject(severity: string): string {
  switch (severity) {
    case 'depleted':
      return '[Action Required] Your credits have run out';
    case 'critical':
      return '[Warning] Your credits are almost gone';
    case 'warning':
      return 'Your credit balance is running low';
    default:
      return 'Credit balance update';
  }
}

function getDaysUntilRefresh(): number {
  // Rough estimate - actual value would come from tenant_credits.next_free_grant_at
  return Math.floor(Math.random() * 20) + 5; // Placeholder
}







