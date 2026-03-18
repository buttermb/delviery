/**
 * Shared email utility for edge functions.
 * Uses Resend API when RESEND_API_KEY is configured, otherwise logs and returns gracefully.
 *
 * Usage:
 *   import { sendEmail, isEmailConfigured } from '../_shared/email.ts';
 *
 *   const result = await sendEmail({
 *     to: 'user@example.com',
 *     subject: 'Hello',
 *     html: '<p>Hello</p>',
 *     from: 'Store <orders@resend.dev>',
 *   });
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const DEFAULT_FROM = 'FloraIQ <noreply@resend.dev>';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface SendEmailResult {
  success: boolean;
  sent: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

/**
 * Send an email via Resend API. Gracefully degrades when RESEND_API_KEY is not set.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, from = DEFAULT_FROM } = params;
  const recipients = Array.isArray(to) ? to : [to];

  if (!RESEND_API_KEY) {
    console.error(`[EMAIL] No RESEND_API_KEY configured. Would send to ${recipients.join(', ')}: ${subject}`);
    return { success: true, sent: false };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[EMAIL] Resend API error:', errorData);
      return { success: false, sent: false, error: JSON.stringify(errorData) };
    }

    const result = await response.json();
    console.error(`[EMAIL] Sent to ${recipients.join(', ')}: ${subject} (id: ${result.id})`);
    return { success: true, sent: true, emailId: result.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EMAIL] Send failed:', message);
    return { success: false, sent: false, error: message };
  }
}
