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

// Alert thresholds configuration
const ALERT_THRESHOLDS = [
  { 
    id: 'warning_2000', 
    credits: 2000, 
    channels: ['in_app'], 
    severity: 'info',
    title: 'Credit Balance Update',
    message: 'You have 2,000 credits remaining',
  },
  { 
    id: 'warning_1000', 
    credits: 1000, 
    channels: ['in_app', 'email'], 
    severity: 'warning',
    title: 'Credits Running Low',
    message: 'Only 1,000 credits left',
  },
  { 
    id: 'warning_500', 
    credits: 500, 
    channels: ['in_app', 'email'], 
    severity: 'critical',
    title: 'Credits Almost Gone',
    message: 'Critical: 500 credits remaining',
  },
  { 
    id: 'warning_100', 
    credits: 100, 
    channels: ['in_app', 'email', 'sms'], 
    severity: 'urgent',
    title: 'Urgent: Almost Out',
    message: 'Almost out! Only 100 credits left',
  },
  { 
    id: 'warning_0', 
    credits: 0, 
    channels: ['in_app', 'email', 'sms'], 
    severity: 'depleted',
    title: 'Credits Depleted',
    message: 'Out of credits! Top up now',
  },
] as const;

interface RequestBody {
  mode?: 'cron' | 'realtime';
  tenant_id?: string;
  new_balance?: number;
}

interface AlertResult {
  tenant_id: string;
  threshold: string;
  channels_sent: string[];
  success: boolean;
  error?: string;
}

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
    console.log(`[CREDIT_ALERTS] Starting in ${mode} mode`);

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

      console.log(`[CREDIT_ALERTS] Found ${tenants?.length || 0} tenants to check`);

      for (const record of tenants || []) {
        const result = await checkAndAlertTenant(
          supabase,
          record.tenant_id,
          record.balance,
          record.tenants as Record<string, unknown>,
          record.alerts_sent
        );
        if (result) {
          results.push(result);
        }
      }
    }

    console.log('[CREDIT_ALERTS] Job completed:', {
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

/**
 * Check a single tenant and send alerts if needed
 */
async function checkAndAlertTenant(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  balance: number,
  tenantData?: { owner_email?: string; owner_phone?: string; slug?: string },
  alertsSent?: Record<string, boolean>
): Promise<AlertResult | null> {
  // Get tenant data if not provided
  if (!tenantData) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('owner_email, owner_phone, slug')
      .eq('id', tenantId)
      .single();
    
    tenantData = tenant || {};
  }

  // Get alerts already sent if not provided
  if (!alertsSent) {
    const { data: credits } = await supabase
      .from('tenant_credits')
      .select('alerts_sent')
      .eq('tenant_id', tenantId)
      .single();
    
    alertsSent = (credits?.alerts_sent as Record<string, boolean>) || {};
  }

  // Find applicable threshold
  const threshold = ALERT_THRESHOLDS.find(t => balance <= t.credits);
  if (!threshold) return null;

  // Check if already sent
  if (alertsSent[threshold.id]) {
    return null;
  }

  const channels_sent: string[] = [];
  const errors: string[] = [];

  try {
    // Send alerts through each channel
    for (const channel of threshold.channels) {
      try {
        switch (channel) {
          case 'in_app':
            await sendInAppNotification(supabase, tenantId, threshold, balance);
            channels_sent.push('in_app');
            break;

          case 'email':
            if (tenantData.owner_email) {
              await sendEmailAlert(
                supabase,
                tenantData.owner_email,
                tenantData.slug || 'your-business',
                threshold,
                balance
              );
              channels_sent.push('email');
            }
            break;

          case 'sms':
            if (tenantData.owner_phone) {
              await sendSmsAlert(
                supabase,
                tenantData.owner_phone,
                threshold,
                balance
              );
              channels_sent.push('sms');
            }
            break;
        }
      } catch (err) {
        console.error(`[CREDIT_ALERTS] ${channel} failed:`, err);
        errors.push(`${channel}: ${(err as Error).message}`);
      }
    }

    // Mark alert as sent
    await supabase
      .from('tenant_credits')
      .update({
        alerts_sent: {
          ...alertsSent,
          [threshold.id]: true,
        },
      })
      .eq('tenant_id', tenantId);

    // Track analytics
    await supabase
      .from('credit_analytics')
      .insert({
        tenant_id: tenantId,
        event_type: `credit_alert_${threshold.severity}`,
        credits_at_event: balance,
        metadata: {
          threshold_id: threshold.id,
          channels_sent,
          errors: errors.length > 0 ? errors : undefined,
        },
      });

    return {
      tenant_id: tenantId,
      threshold: threshold.id,
      channels_sent,
      success: channels_sent.length > 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };

  } catch (error) {
    return {
      tenant_id: tenantId,
      threshold: threshold.id,
      channels_sent,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  threshold: typeof ALERT_THRESHOLDS[number],
  balance: number
): Promise<void> {
  await supabase
    .from('notifications')
    .insert({
      tenant_id: tenantId,
      type: 'system',
      title: getNotificationTitle(threshold.severity),
      message: getNotificationMessage(threshold.severity, balance),
      metadata: {
        credit_alert: true,
        severity: threshold.severity,
        balance,
        threshold_id: threshold.id,
        action_url: '/settings/billing',
      },
    });
}

/**
 * Send email alert using send-notification function
 */
async function sendEmailAlert(
  supabase: ReturnType<typeof createClient>,
  email: string,
  tenantSlug: string,
  threshold: typeof ALERT_THRESHOLDS[number],
  balance: number
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const subject = getEmailSubject(threshold.severity);
  const html = getEmailHtml(threshold.severity, balance, tenantSlug);

  const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      type: 'email',
      to: email,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email send failed: ${response.status}`);
  }
}

/**
 * Send SMS alert
 */
async function sendSmsAlert(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  threshold: typeof ALERT_THRESHOLDS[number],
  balance: number
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const message = getSmsMessage(threshold.severity, balance);

  const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      to: phone,
      message,
    }),
  });

  if (!response.ok) {
    throw new Error(`SMS send failed: ${response.status}`);
  }
}

// Message templates
function getNotificationTitle(severity: string): string {
  switch (severity) {
    case 'depleted':
      return '🚨 Credits Depleted!';
    case 'urgent':
      return '⚠️ Credits Almost Gone!';
    case 'critical':
      return '⚠️ Credits Running Very Low';
    case 'warning':
      return '⚡ Credits Running Low';
    default:
      return '💡 Credit Balance Update';
  }
}

function getNotificationMessage(severity: string, balance: number): string {
  switch (severity) {
    case 'depleted':
      return `You've run out of credits. Some features are now unavailable. Upgrade for unlimited access, or purchase more credits.`;
    case 'urgent':
      return `Only ${balance} credits left! Actions may be blocked soon. Upgrade now for unlimited access.`;
    case 'critical':
      return `You have ${balance} credits remaining. Consider upgrading to a subscription for unlimited access.`;
    case 'warning':
      return `You have ${balance} credits remaining. Your credits will refresh soon, or upgrade for unlimited access.`;
    default:
      return `You have ${balance} credits remaining.`;
  }
}

function getEmailSubject(severity: string): string {
  switch (severity) {
    case 'depleted':
      return '[Action Required] Your credits have run out';
    case 'urgent':
      return '[Urgent] Almost out of credits!';
    case 'critical':
      return '[Warning] Your credits are almost gone';
    case 'warning':
      return 'Your credit balance is running low';
    default:
      return 'Credit balance update';
  }
}

function getEmailHtml(severity: string, balance: number, tenantSlug: string): string {
  const appUrl = Deno.env.get('APP_URL') || 'https://app.bigmikewholesale.com';
  const upgradeUrl = `${appUrl}/${tenantSlug}/admin/select-plan`;
  const billingUrl = `${appUrl}/${tenantSlug}/admin/settings/billing`;

  const urgencyColor = severity === 'depleted' || severity === 'urgent' 
    ? '#ef4444' 
    : severity === 'critical' 
    ? '#f97316' 
    : '#eab308';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: ${urgencyColor}; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ${severity === 'depleted' ? '🚨' : '⚠️'} Credit Alert
          </h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px;">
          <p style="font-size: 18px; color: #333; margin: 0 0 16px;">
            ${getNotificationMessage(severity, balance)}
          </p>
          
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <div style="text-align: center;">
              <span style="font-size: 48px; font-weight: bold; color: ${urgencyColor};">
                ${balance.toLocaleString()}
              </span>
              <p style="color: #666; margin: 8px 0 0;">credits remaining</p>
            </div>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${upgradeUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Upgrade for Unlimited Access
            </a>
            <p style="margin: 16px 0 0;">
              <a href="${billingUrl}" style="color: #666; text-decoration: underline;">Or buy more credits</a>
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #eee;">
            ${severity === 'depleted' || severity === 'urgent' 
              ? 'Some features may be unavailable until you add more credits or upgrade your plan.'
              : 'Avoid interruptions by upgrading to a paid plan with unlimited usage.'}
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            You're receiving this because you're on the free tier of BigMike Wholesale.
            <br>
            <a href="${billingUrl}" style="color: #666;">Manage alert preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getSmsMessage(severity: string, balance: number): string {
  switch (severity) {
    case 'depleted':
      return `[BigMike] You're out of credits! Features are limited. Upgrade now: ${Deno.env.get('APP_URL')}/select-plan`;
    case 'urgent':
      return `[BigMike] Only ${balance} credits left! Upgrade for unlimited: ${Deno.env.get('APP_URL')}/select-plan`;
    default:
      return `[BigMike] Credit alert: ${balance} credits remaining. Top up: ${Deno.env.get('APP_URL')}/billing`;
  }
}







