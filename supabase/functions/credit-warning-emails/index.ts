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
import type { SupabaseClient } from '../_shared/deps.ts';

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

    console.error('[CREDIT_WARNINGS] Starting credit warning job');

    const results = {
      checked: 0,
      warnings_sent: 0,
      emails_sent: 0,
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
      console.error(`[CREDIT_WARNINGS] Checking ${threshold.percent}% threshold`);

      // Find tenants at this threshold who haven't been warned
      const { data: tenants, error: queryError } = await supabase
        .from('tenant_credits')
        .select(`
          tenant_id,
          balance,
          next_free_grant_at,
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

      console.error(`[CREDIT_WARNINGS] Found ${tenants?.length || 0} tenants at ${threshold.percent}%`);

      for (const record of tenants || []) {
        results.checked++;
        const tenant = record.tenants as unknown as {
          id: string;
          slug: string;
          is_free_tier: boolean;
          owner_email: string | null;
        } | null;

        if (!tenant?.owner_email) {
          console.error(`[CREDIT_WARNINGS] No email for tenant ${record.tenant_id}`);
          continue;
        }

        try {
          const daysUntilRefresh = getDaysUntilRefresh(record.next_free_grant_at);

          // Create in-app notification
          await supabase
            .from('notifications')
            .insert({
              tenant_id: record.tenant_id,
              type: 'system',
              title: getNotificationTitle(threshold.severity),
              message: getNotificationMessage(record.balance, threshold, daysUntilRefresh),
              metadata: {
                credit_warning: true,
                severity: threshold.severity,
                balance: record.balance,
                threshold_percent: threshold.percent,
              },
            });

          // Send email notification
          const emailSent = await sendEmailNotification(
            supabaseUrl,
            supabaseServiceKey,
            tenant.owner_email,
            tenant.slug,
            record.balance,
            threshold,
            daysUntilRefresh
          );

          if (emailSent) {
            results.emails_sent++;
          }

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
                email_sent: emailSent,
              },
            });

          results.warnings_sent++;
          results.by_severity[threshold.severity]++;
          console.error(`[CREDIT_WARNINGS] Sent ${threshold.severity} warning to ${tenant.slug}`);

        } catch (err) {
          console.error(`[CREDIT_WARNINGS] Error for ${record.tenant_id}:`, err);
          results.errors.push(`${record.tenant_id}: ${(err as Error).message}`);
        }
      }
    }

    console.error('[CREDIT_WARNINGS] Job completed:', results);

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
 * Send email notification via the send-notification edge function
 */
async function sendEmailNotification(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  tenantSlug: string,
  balance: number,
  threshold: typeof WARNING_THRESHOLDS[number],
  daysUntilRefresh: number | null
): Promise<boolean> {
  try {
    const subject = getEmailSubject(threshold.severity);
    const html = getEmailHtml(threshold.severity, balance, tenantSlug, daysUntilRefresh);

    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: 'system',
        title: subject,
        message: getNotificationMessage(balance, threshold, daysUntilRefresh),
        channels: ['email'],
        metadata: {
          to_email: email,
          html,
          credit_warning: true,
          severity: threshold.severity,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CREDIT_WARNINGS] Email send failed: ${response.status} - ${errorText}`);
      return false;
    }

    console.error(`[CREDIT_WARNINGS] Email sent to ${email} (${threshold.severity})`);
    return true;
  } catch (err) {
    console.error(`[CREDIT_WARNINGS] Email error for ${email}:`, err);
    return false;
  }
}

function getNotificationTitle(severity: string): string {
  switch (severity) {
    case 'depleted':
      return 'Credits Depleted!';
    case 'critical':
      return 'Credits Running Very Low';
    case 'warning':
      return 'Credits Running Low';
    default:
      return 'Credit Balance Update';
  }
}

function getNotificationMessage(
  balance: number,
  threshold: typeof WARNING_THRESHOLDS[number],
  daysUntilRefresh: number | null
): string {
  switch (threshold.severity) {
    case 'depleted':
      return `You've run out of credits. Some features are now unavailable. Upgrade to a subscription for unlimited access, or purchase more credits.`;
    case 'critical':
      return `You only have ${balance} credits left (${threshold.percent}%). Consider upgrading to a subscription for unlimited access.`;
    case 'warning': {
      const refreshNote = daysUntilRefresh !== null
        ? `Your credits will refresh in ${daysUntilRefresh} day${daysUntilRefresh !== 1 ? 's' : ''}, or upgrade for unlimited access.`
        : 'Upgrade for unlimited access.';
      return `You have ${balance} credits remaining (${threshold.percent}%). ${refreshNote}`;
    }
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

function getDaysUntilRefresh(nextFreeGrantAt: string | null): number | null {
  if (!nextFreeGrantAt) return null;
  const now = new Date();
  const refreshDate = new Date(nextFreeGrantAt);
  const diffMs = refreshDate.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getEmailHtml(
  severity: string,
  balance: number,
  tenantSlug: string,
  daysUntilRefresh: number | null
): string {
  const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://app.floraiq.com';
  const upgradeUrl = `${appUrl}/${tenantSlug}/admin/select-plan`;
  const billingUrl = `${appUrl}/${tenantSlug}/admin/settings/billing`;

  const urgencyColor = severity === 'depleted'
    ? '#dc2626'
    : severity === 'critical'
    ? '#ea580c'
    : severity === 'warning'
    ? '#d97706'
    : '#2563eb';

  const refreshNote = daysUntilRefresh !== null && daysUntilRefresh > 0
    ? `<p style="color: #666; font-size: 14px; margin: 16px 0 0;">Your free credits will refresh in <strong>${daysUntilRefresh} day${daysUntilRefresh !== 1 ? 's' : ''}</strong>.</p>`
    : '';

  const footerNote = severity === 'depleted'
    ? 'Some features may be unavailable until you add more credits or upgrade your plan.'
    : 'Avoid interruptions by upgrading to a paid plan with unlimited usage.';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: ${urgencyColor}; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">
        ${getNotificationTitle(severity)}
      </h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #333; margin: 0 0 16px; line-height: 1.5;">
        ${getNotificationMessage(balance, WARNING_THRESHOLDS.find(t => t.severity === severity) ?? WARNING_THRESHOLDS[0], daysUntilRefresh)}
      </p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <span style="font-size: 48px; font-weight: bold; color: ${urgencyColor};">
          ${balance.toLocaleString()}
        </span>
        <p style="color: #666; margin: 8px 0 0;">credits remaining</p>
      </div>
      ${refreshNote}
      <div style="text-align: center; margin: 32px 0;">
        <a href="${upgradeUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Upgrade for Unlimited Access
        </a>
        <p style="margin: 16px 0 0;">
          <a href="${billingUrl}" style="color: #666; text-decoration: underline;">Or buy more credits</a>
        </p>
      </div>
      <p style="color: #666; font-size: 14px; margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #eee;">
        ${footerNote}
      </p>
    </div>
    <div style="background: #f9fafb; padding: 16px 24px; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        You're receiving this because you're on the free tier.
        <br>
        <a href="${billingUrl}" style="color: #666;">Manage billing</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
