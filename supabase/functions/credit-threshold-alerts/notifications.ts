/**
 * Notification sending functions for credit alerts:
 * in-app, email, and SMS channels.
 */

import type { AlertThreshold } from './thresholds.ts';
import {
  getNotificationTitle,
  getNotificationMessage,
  getEmailSubject,
  getEmailHtml,
  getSmsMessage,
} from './message-templates.ts';

/**
 * Send in-app notification
 */
export async function sendInAppNotification(
  supabase: any,
  tenantId: string,
  threshold: AlertThreshold,
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
export async function sendEmailAlert(
  supabase: any,
  email: string,
  tenantSlug: string,
  threshold: AlertThreshold,
  balance: number,
  tenantId?: string
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const subject = getEmailSubject(threshold.severity);
  const html = getEmailHtml(threshold.severity, balance, tenantSlug);

  const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      type: 'system',
      tenant_id: tenantId,
      title: subject,
      message: `Credit balance: ${balance} credits remaining. ${threshold.severity === 'critical' ? 'Immediate action required.' : 'Consider purchasing more credits.'}`,
      channels: ['email'],
      metadata: { recipient_email: email, balance, severity: threshold.severity, html },
    }),
  });

  if (!response.ok) {
    throw new Error(`Email send failed: ${response.status}`);
  }
}

/**
 * Send SMS alert
 */
export async function sendSmsAlert(
  supabase: any,
  phone: string,
  threshold: AlertThreshold,
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
