/**
 * Core alert evaluation logic: checks a tenant's credit balance against
 * thresholds and dispatches notifications through configured channels.
 */

import { ALERT_THRESHOLDS, type AlertResult } from './thresholds.ts';
import { sendInAppNotification, sendEmailAlert, sendSmsAlert } from './notifications.ts';

/**
 * Check a single tenant and send alerts if needed
 */
export async function checkAndAlertTenant(
  supabase: any,
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
      .maybeSingle();

    tenantData = tenant || {};
  }

  // Get alerts already sent if not provided
  if (!alertsSent) {
    const { data: credits } = await supabase
      .from('tenant_credits')
      .select('alerts_sent')
      .eq('tenant_id', tenantId)
      .maybeSingle();

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
                balance,
                tenantId
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
