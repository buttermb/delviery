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
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('credit-warning-emails');

const FREE_CREDITS_AMOUNT = 10000;
const WARNING_THRESHOLDS = [
  { percent: 25, credits: 2500, column: 'warning_25_sent', severity: 'info' },
  { percent: 10, credits: 1000, column: 'warning_10_sent', severity: 'warning' },
  { percent: 5, credits: 500, column: 'warning_5_sent', severity: 'critical' },
  { percent: 0, credits: 0, column: 'warning_0_sent', severity: 'depleted' },
] as const;

interface TenantRecord {
  tenant_id: string;
  balance: number;
  next_free_grant_at: string | null;
  tenants: {
    id: string;
    slug: string;
    is_free_tier: boolean;
    owner_email: string;
  } | null;
}

interface JobResults {
  checked: number;
  warnings_sent: number;
  emails_sent: number;
  by_severity: Record<string, number>;
  errors: string[];
}

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

    logger.info('Starting credit warning email job');

    const results: JobResults = {
      checked: 0,
      warnings_sent: 0,
      emails_sent: 0,
      by_severity: { info: 0, warning: 0, critical: 0, depleted: 0 },
      errors: [],
    };

    // Process each warning threshold
    for (const threshold of WARNING_THRESHOLDS) {
      logger.info('Checking threshold', { threshold_percent: threshold.percent });

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
        logger.error('Query error for threshold', {
          threshold_percent: threshold.percent,
          error: queryError.message,
        });
        results.errors.push(`${threshold.percent}% query: ${queryError.message}`);
        continue;
      }

      logger.info('Found tenants at threshold', {
        threshold_percent: threshold.percent,
        count: tenants?.length ?? 0,
      });

      for (const record of (tenants ?? []) as unknown as TenantRecord[]) {
        results.checked++;
        const tenant = record.tenants;

        if (!tenant?.owner_email) {
          logger.warn('No email for tenant', { tenantId: record.tenant_id });
          continue;
        }

        try {
          // Create in-app notification
          await createInAppNotification(supabase, record.tenant_id, record.balance, threshold);

          // Send email via send-notification function
          const emailSent = await sendWarningEmail(
            supabaseUrl,
            supabaseServiceKey,
            record.tenant_id,
            tenant.owner_email,
            tenant.slug,
            record.balance,
            record.next_free_grant_at,
            threshold
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
          logger.info('Sent warning', {
            tenantId: record.tenant_id,
            severity: threshold.severity,
            slug: tenant.slug,
            emailSent,
          });
        } catch (err) {
          const errorMessage = (err as Error).message;
          logger.error('Error processing tenant', {
            tenantId: record.tenant_id,
            error: errorMessage,
          });
          results.errors.push(`${record.tenant_id}: ${errorMessage}`);
        }
      }
    }

    logger.info('Credit warning email job completed', {
      checked: results.checked,
      warnings_sent: results.warnings_sent,
      emails_sent: results.emails_sent,
      errors_count: results.errors.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Credit warning job completed',
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Credit warning email job failed', {
      error: (error as Error).message,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Create in-app notification for a credit warning
 */
async function createInAppNotification(
  supabase: SupabaseClient,
  tenantId: string,
  balance: number,
  threshold: typeof WARNING_THRESHOLDS[number]
): Promise<void> {
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
        action_url: '/settings/billing',
      },
    });
}

/**
 * Send warning email via the send-notification edge function
 */
async function sendWarningEmail(
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  email: string,
  slug: string,
  balance: number,
  nextFreeGrantAt: string | null,
  threshold: typeof WARNING_THRESHOLDS[number]
): Promise<boolean> {
  const subject = getEmailSubject(threshold.severity);
  const html = generateWarningEmailHtml(slug, balance, nextFreeGrantAt, threshold);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        type: 'system',
        title: subject,
        message: getNotificationMessage(balance, threshold),
        channels: ['email'],
        metadata: {
          email_to: email,
          email_subject: subject,
          email_html: html,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('Email send failed', {
        tenantId,
        status: response.status,
        error: errorText,
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error('Email send error', {
      tenantId,
      error: (err as Error).message,
    });
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
  threshold: typeof WARNING_THRESHOLDS[number]
): string {
  switch (threshold.severity) {
    case 'depleted':
      return `You've run out of credits. Some features are now unavailable. Upgrade to a subscription for unlimited access, or purchase more credits.`;
    case 'critical':
      return `You only have ${balance} credits left (${threshold.percent}%). Consider upgrading to a subscription for unlimited access.`;
    case 'warning':
      return `You have ${balance} credits remaining (${threshold.percent}%). Upgrade for unlimited access.`;
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
  const grantDate = new Date(nextFreeGrantAt);
  const diffMs = grantDate.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

/**
 * Generate HTML email for credit warning
 */
function generateWarningEmailHtml(
  slug: string,
  balance: number,
  nextFreeGrantAt: string | null,
  threshold: typeof WARNING_THRESHOLDS[number]
): string {
  const appUrl = Deno.env.get('APP_URL') || 'https://app.floraiq.com';
  const upgradeUrl = `${appUrl}/${escapeHtml(slug)}/admin/select-plan`;
  const billingUrl = `${appUrl}/${escapeHtml(slug)}/admin/settings/billing`;
  const daysUntilRefresh = getDaysUntilRefresh(nextFreeGrantAt);

  const urgencyColor =
    threshold.severity === 'depleted'
      ? '#ef4444'
      : threshold.severity === 'critical'
      ? '#f97316'
      : threshold.severity === 'warning'
      ? '#eab308'
      : '#3b82f6';

  const refreshText = daysUntilRefresh !== null
    ? daysUntilRefresh === 0
      ? 'Your free credits will refresh soon.'
      : `Your free credits will refresh in ${daysUntilRefresh} day${daysUntilRefresh === 1 ? '' : 's'}.`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: ${urgencyColor}; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">
        ${threshold.severity === 'depleted' ? 'Credits Depleted' : 'Credit Alert'}
      </h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 18px; color: #333; margin: 0 0 16px;">
        ${escapeHtml(getNotificationMessage(balance, threshold))}
      </p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <span style="font-size: 48px; font-weight: bold; color: ${urgencyColor};">
          ${balance.toLocaleString()}
        </span>
        <p style="color: #666; margin: 8px 0 0;">credits remaining</p>
      </div>
      ${refreshText ? `<p style="color: #666; font-size: 14px; text-align: center; margin: 0 0 24px;">${refreshText}</p>` : ''}
      <div style="text-align: center; margin: 32px 0;">
        <a href="${upgradeUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Upgrade for Unlimited Access
        </a>
        <p style="margin: 16px 0 0;">
          <a href="${billingUrl}" style="color: #666; text-decoration: underline;">Or buy more credits</a>
        </p>
      </div>
      <p style="color: #666; font-size: 14px; margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #eee;">
        ${threshold.severity === 'depleted' || threshold.severity === 'critical'
          ? 'Some features may be unavailable until you add more credits or upgrade your plan.'
          : 'Avoid interruptions by upgrading to a paid plan with unlimited usage.'}
      </p>
    </div>
    <div style="background: #f9fafb; padding: 16px 24px; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        You're receiving this because you're on the free tier of FloraIQ.
        <br>
        <a href="${billingUrl}" style="color: #666;">Manage alert preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
